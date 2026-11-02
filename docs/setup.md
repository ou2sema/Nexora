# Setup and verification

Everything below assumes Windows 11 with PowerShell 7 and a clone of this repository.
Commands are copy-pasteable; paths are relative to the repository root.

## Prerequisites

| Tool    | Version                       | Notes                                   |
| ------- | ----------------------------- | --------------------------------------- |
| Node.js | >= 22.12 (developed on 26.13) | `node --version`                        |
| npm     | >= 10 (repo pins npm 11)      | `npm --version`                         |
| Edge    | any recent build              | Local E2E reuses the installed browser  |
| Java    | 17+ (developed on 27)         | Only needed for `npm run report:allure` |
| Git     | any recent version            |                                         |

A Supabase project **is** required from Phase 2 onward: the app authenticates users and the
API reads its database. The automated suites still need no hosted credentials — they run on
PGlite with locally generated keys — but running the app locally requires a real project.

## First-time setup

```powershell
cd C:\dev\mystock
npm install
Copy-Item .env.example .env
```

Fill `.env` with your Supabase project URL, anon key, database URL, and the JWT issuer:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_JWT_ISSUER=https://<project-ref>.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
# Session pooler (port 5432), which works on an IPv4-only network. The direct host
# db.<project-ref>.supabase.co is IPv6-only for this project.
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
```

`.env.example` is the reference for every variable: the value each one accepts, which are
validated at API boot, why `DATABASE_SSL` must stay `true` in production, why the 6543
transaction pooler must not be used, and the order `.env` files are loaded in.

`SUPABASE_SERVICE_ROLE_KEY` is not required by, or used in, the API runtime; do not put it in
the API environment. If a separate operator tool requires a service-role key, provide it only
to that tool and never expose it through a `VITE_` variable. The API verifies tokens against
the project's public JWKS (`/auth/v1/.well-known/jwks.json`), so no JWT secret is needed.

The web app validates its own environment at startup and reads a git-ignored file:

```powershell
@"
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_BASE_URL=http://localhost:4100/api/v1
"@ | Set-Content apps/web/.env.local
```

## Run the apps

Use two terminals from the repository root.

```powershell
# Terminal 1 — API on http://localhost:4100
npm run dev --workspace @mystock/api
```

```powershell
# Terminal 2 — web on http://localhost:5173
npm run dev --workspace @mystock/web
```

| Service | URL                          | Expected response                             |
| ------- | ---------------------------- | --------------------------------------------- |
| API     | http://localhost:4100/health | `{"status":"ok","service":"mystock-api",...}` |
| Web     | http://localhost:5173        | Redirects to the sign-in page                 |

The web app cannot show any workspace before authentication. Create a user in the Supabase
dashboard (Authentication → Users → Add user) or use the sign-up form, then sign in at
http://localhost:5173/sign-in. Confirmation emails must be handled according to your project
settings; with "Confirm email" disabled, sign-up returns a session immediately.

The first signed-in user sees the organization onboarding form, because no membership exists
yet. Creating an organization makes the caller its owner.

The Vite dev server proxies `/api` to the API, but the SPA calls `VITE_API_BASE_URL`
directly, so both processes must be running. CORS on the API allows `WEB_ORIGIN` only.

Port 4100 is a deliberate choice: 3000 is commonly occupied by other local Node
processes, which silently produces HTML 404s instead of API responses.

## Health probes

Three public GET routes answer without a bearer token and skip the rate limiter, so infrastructure
polling does not spend the budget that belongs to users:

| Route               | Meaning                                             | Needs the database |
| ------------------- | --------------------------------------------------- | ------------------ |
| `GET /health`       | process is up (kept as the dashboard status source) | no                 |
| `GET /health/live`  | liveness: the event loop answers                    | no                 |
| `GET /health/ready` | readiness: `select 1` went through the pool         | yes                |

`/health/ready` returns `200` with
`database: { "status": "up", "latencyMs": <number>, "timeoutMs": 2000 }`, or `503`
`service_unavailable` whose `error.details.database` is `unreachable`, `timeout`, or `error` when
the pool cannot answer within 2 seconds. The failure body carries only that classification, never
the driver message, so no host, port, or credential can leak. All three routes live outside the
`api/v1` prefix (`/api/v1/health/live` and `/api/v1/health/ready` are 404), and the local E2E stack
now waits on `/health/ready` before it declares itself usable.

The boot-time schema guard remains the authority on migrations: a process that started is a process
whose schema was complete, so readiness proves connectivity rather than re-running the guard.

Verification (2026-11-01): 10 new Vitest tests cover the probe contract — 5 service-level cases
(`up`, `unreachable`, `timeout` on a stuck pool with a 25 ms deadline, `error`, and the default
deadline) and 5 HTTP cases against an app whose database is PGlite (liveness shape, readiness latency,
both probes 404 under `api/v1`, all three probes reachable without a token, and a `503` whose body
reports `unreachable` without leaking the driver message). The headed shell suite gained a probe test
and passed 18/18 (9 tests × desktop/mobile); the headed local-stack suite still passes 40/40 and now
starts only after `/health/ready` answers. Probes were also exercised against the hosted project over
the session pooler: `/health/live` returned `200`, `/health/ready` returned `200` with
`database.status = "up"`, and `/api/v1/health/ready` returned `404`. From this machine the hosted
pool round trip measured 718 ms cold and 772 ms warm, so the reported latency is dominated by the
network distance to `aws-0-eu-west-1` rather than by connection setup; the 2-second deadline leaves
about 1.2 seconds of headroom from here, and a probe running inside the same region will measure
materially less.

## API authentication

Every route except the health probes requires `Authorization: Bearer <supabase-access-token>`. The
API verifies signature, issuer, audience, and expiry against the project JWKS, then opens a
transaction that sets the `authenticated` role and the caller's claims before touching data.
RLS therefore evaluates for the real user even though the process connects as the project
owner.

`GET /api/v1/me` returns the caller and their memberships. Organization-scoped routes take
the organization id in the path (`/api/v1/organizations/:organizationId/...`); membership is
re-checked on every request, and a missing membership returns `404` rather than `403` so the
API does not confirm that an organization exists.

The database connection role must be allowed to `SET ROLE authenticated`. The Supabase
`postgres` role is; a custom migration role needs `authenticated` granted to it.

Stock and device mutations are POSTs that require an `Idempotency-Key` header (8–120
characters). A retry with the same key and payload returns the first result with
`duplicate: true`; the same key with a different payload returns `409 idempotency_conflict`.
Stock postings (`receipt`, `issue`, `adjustment`) are idempotent per key, transfers commit
both legs in one transaction, and reservations reduce `available` without moving stock.
Reconciliation is restricted to owner and admin; all reads require membership.

Serialized-device writes follow a fixed status graph and append a `device_events` row for
every change. Products must have `isSerialized = true` before a device can be registered
against them. Standalone `register_device` records the device identity and its initial lifecycle
event but does not post a quantity movement. For serialized products received against a purchase
order, `receive_purchase_order` registers the devices and their `registered` events inline in the
same transaction as the receipt; it posts no quantity movement for those lines. Quantity-tracked
products use the stock RPCs.

Scan lookups (`GET .../scan?code=`) are available to every member and resolve a device serial
or IMEI before a product barcode, SKU, or internal code. Barcode assignment and every count
mutation require owner, admin, or manager. Labels are a PDF download; the SPA requests them
with the bearer token and saves the blob, so the token never appears in a URL. Count posting
requires `Idempotency-Key` like the other stock mutations.

## Barcode workflow verification

The Phase 4 API and database suites run without a hosted project:

```powershell
npm run test --workspace @mystock/api -- test/db/barcode-workflows.test.ts test/api/scanning.test.ts
```

Expected: 17 passing tests (11 database, 6 API). They cover generated barcode format and
idempotency, check-digit rejection, cross-tenant isolation and viewer denial, every scan
resolution tier, a label PDF response, and the full count lifecycle including duplicate
posting and reservation protection.

To exercise the same flows by hand, start both apps (see above), sign in, and use the
Scanning page:

1. **Catalog → Assign barcode** on a product without one. It receives an EAN-13 starting
   with `2`; clicking again returns the same value.
2. **Scanning → Receive**, scan or type that barcode, choose a location, enter a quantity,
   and post. The product card shows the updated on-hand quantity and stock line.
3. Type the same code twice quickly in manual entry. The second attempt is ignored with
   "Duplicate scan ignored".
4. **Count** tab: start a count for a location, scan products to add counted quantities,
   then post. The detail view shows live variance; posting writes adjustments and the
   location's stock matches the count. Replaying with the same idempotency key returns the
   original result.
5. **Print label** on a product or device row downloads a PDF. Open it and confirm the
   barcode is legible and the printed code matches the record.
6. Deny camera permission, or use a browser without `BarcodeDetector`, and confirm manual
   entry still works. The camera panel states which engine is active.

Hosted runs now have the Phase 4 schema. A signed-in pass against the hosted project on
2026-10-30 exercised the console end to end: SKU and serial scans resolved, a duplicate scan
inside the guard window was ignored, a denied camera permission left manual entry usable, a
1-unit scan receipt posted, product and device labels downloaded as 1-page A4 PDFs, and an
inventory count at `MAIN / A-01` recorded `CABLE-01` at 9 and posted with 0 adjustments
(on-hand unchanged). No defects surfaced.

## Reporting and realtime verification

The Phase 5 API suite runs without a hosted project:

```powershell
npm run test --workspace @mystock/api -- test/api/reports.test.ts
```

Expected: 9 passing tests. They post a receipt, issue, transfer, and reservation, insert one
serialized device, then recompute on-hand, reserved, available, serialized counts, valuation,
movement totals, and the daily series from the raw tables in separate queries and assert the
report matches exactly. The suite also covers warehouse and category filters, window
validation, viewer access, cross-tenant `404`s, low-stock boundaries and pagination, and both
CSV exports including field quoting and filter behavior.

Full gates on 2026-10-30: `format:check`, `lint`, `typecheck`, and `build` clean; 184 Vitest
tests across the workspaces (135 API, including the 9 report tests); 16 headed Playwright
checks (8 specs × desktop/mobile) with the Allure report at 100%.

To exercise the dashboard by hand, start both apps and sign in:

1. The dashboard shows quantities, cost and retail valuation, ledger activity, the low-stock
   list, and a per-warehouse table. Changing warehouse, category, or window updates every
   section together.
2. **Products → Threshold** opens the reorder-threshold editor for any product (also available
   when adding a product). Set a threshold above current availability; the top-bar bell shows
   a count and the dashboard low-stock list gains the product.
3. Post a receipt on **Stock levels**, then return to the dashboard. The totals and movement
   series reflect the committed movement: realtime invalidates the queries immediately once
   the tables are published, and the 30-second poll refreshes the open dashboard even when
   the channel reports connected but delivers no events.
4. **Stock levels CSV** and **Movements CSV** download dated files using the current filters.
   Open them in a spreadsheet and compare the quantity columns with the stock levels and
   movement pages.
5. A viewer can open the report, low-stock list, and exports; a member of another organization
   receives `404 organization_not_found`.

The realtime publication is added by `20261030120000_reporting_realtime.sql`. Polling is not
conditional on the socket state: Supabase reports `SUBSCRIBED` for a channel whose tables are
missing from the publication, and a hosted run showed the dashboard staying stale under that
condition. The 30-second poll is the correctness path; the subscription is the fast path.

### Hosted check (2026-10-30)

The local dev servers pointed at the hosted project, signed in as the owner:

- The dashboard rendered the hosted totals (11 units on hand, 1 serialized in stock, cost
  TND 3,293.500, retail TND 4,062.900, 6 movements, window 2026-09-30 – 2026-10-30).
- **Products → Threshold** set `CABLE-01` to 15; the row shows 15, the bell announces
  "Low stock alerts: 1 product", and the dashboard lists `11 / 15 · short 4`.
- Selecting the MAIN warehouse issued `reports/overview?warehouseId=…` and scoped the
  low-stock query to the same warehouse; "Last 7 days" changed the window to
  2026-10-23 – 2026-10-30 and the series start.
- **Stock levels CSV** downloaded the header plus two `CABLE-01` rows with on-hand 9 and 2;
  **Movements CSV** downloaded six rows whose quantities match the movement page.
- A receipt posted through the UI moved the dashboard from 11 to 12 units; a further API
  receipt left the open dashboard at 12, exposing the connected-but-not-delivering socket.
  After the hook began polling unconditionally, the open dashboard moved 14 → 15 units and
  8 → 9 movements within 30 seconds with no reload.
- The publication migration was then pushed hosted (dry run listed only
  `20261030120000_reporting_realtime.sql`; `pg_publication_tables` confirmed
  `devices`, `stock_balances`, `stock_movements`, and `stock_reservations`). A page-level
  channel received an inserted movement in about one second, and the open dashboard advanced
  from 17 to 18 units without a reload, so socket delivery is verified end to end.

## Operational workflow verification

The Phase 6 API suite runs without a hosted project:

```powershell
npm run test --workspace @mystock/api -- test/api/operations.test.ts test/db/operational-workflows.test.ts
```

Expected: 24 passing tests (13 database, 11 API). They cover supplier uniqueness, activation,
role denial and tenant boundaries; purchase-order numbering, replay and conflict on the
idempotency key, partial and serialized receipts, over-receipt rejection, cancellation rules,
and foreign-product rejection; and outgoing-order reservation, issuance, over-sell rejection,
cancellation release, and rejection of serialized lines.

The signed-in UI runs against a self-contained stack with no hosted project and no
credentials. `apps/api/scripts/local-e2e-stack.mjs` boots embedded PostgreSQL 18, applies the
real migrations, serves a local JWKS plus password-grant endpoint on 4200, seeds an owner
(`alice@example.com`), a viewer (`dave@example.com`), and an unaffiliated account
(`carol@example.com`) that the Phase 9 invitation flow joins, and starts the built API on 4101.
Playwright adds Vite on 5174:

```powershell
npm run build:apps
cd apps/web
npx playwright test --config playwright.local-stack.config.ts --headed
```

Expected: 16 passing checks (8 tests × desktop/mobile): supplier create, deactivate and
reactivate; purchase order order → receipt with an on-hand delta; a serialized receipt
registering two devices visible on the Devices page; a purchase return created, posted, and
reflected in the on-hand delta; outgoing order confirm → fulfil with an on-hand delta; a sales
return created after fulfilment that restocks the order location; the dashboard supplier
performance card showing the fresh supplier at 100% on time; and a viewer seeing disabled write
controls on all three pages.

Full gates on 2026-10-31 for Phase 6: `format:check`, `lint`, `typecheck`, and `build` clean;
208 Vitest tests across the workspaces (159 API, including the 11 operations API tests); the
Phase 6 headed run above passed 10/10 with Allure at 100% (served at http://localhost:5051 for
this run; port 5050 already hosted an older preview); the shell regression suite passed 16/16.

## Returns and supplier performance verification

The Phase 7 API and database suites run without a hosted project:

```powershell
npm run test --workspace @mystock/api -- test/api/returns.test.ts test/db/returns.test.ts
```

Expected: 12 passing tests (8 database, 4 API). They cover purchase-return numbering and
idempotent posting, over-return rejection at creation and across overlapping drafts (with the
source line locked at post time), serialized device selection, disposal, device events and zero
quantity movements, draft cancellation, sales-return restocking and over-return rejection,
tenant boundaries, and supplier performance computed from fully received orders with expected
dates (including the returned-quantity rate).

Full gates on 2026-10-31 for Phase 7: `format:check`, `lint`, `typecheck`, and `build` clean;
220 Vitest tests across the workspaces (171 API); the Phase 7 headed local-stack run above
passed 16/16 (desktop and mobile) with Allure results written and served at
http://localhost:5052 for this run; the shell regression suite passed 16/16. The Phase 7
migration (`20261031120000_returns_and_supplier_performance.sql`) was pushed to the hosted
project on 2026-10-31, and a signed-in hosted purchase return was posted against it; the check
is recorded below.

### Hosted check (2026-10-31)

The Phase 6 migration (`20261030140000_operational_workflows.sql`) was pushed to the hosted
project on 2026-10-31 with `npx supabase db push --db-url "$DATABASE_URL" --yes` after a dry
run listed exactly that one migration. A read-only check then confirmed `suppliers`,
`purchase_orders`, `purchase_order_lines`, `sales_orders`, and `sales_order_lines` exist with
RLS enabled, the twelve `app.*` operational functions are present (`save_supplier`,
`set_supplier_active`, `create_purchase_order`, `order_purchase_order`,
`receive_purchase_order`, `cancel_purchase_order`, `create_sales_order`,
`confirm_sales_order`, `fulfil_sales_order`, `cancel_sales_order`,
`operations_apply_stock`, `operations_apply_reservation`), and the migration is recorded in
`supabase_migrations.schema_migrations`. All five tables were empty at check time.

A signed-in pass followed the same day in the “MyStock” tenant against the hosted API:

- **Suppliers**: created “Tunis Tech Distribution” with contact, email, address, and
  `Tunis`/`TN`; the row rendered the location as `Tunis, TN`. Deactivate flipped the badge to
  Inactive and Reactivate returned it to Active.
- **Purchase orders**: created `PO-2026-0001` for one `CABLE-01` at `7,500 DT`, marked it
  ordered (“PO-2026-0001 is now ordered.”), then received one unit; the detail view moved to
  Received with ordered/received `1 / 1` and the receipt notice.
- **Outgoing orders**: the product picker offered only active, non-serialized products (the
  serialized `IPHONE-15` was absent). Created `SO-2026-0001` for one `CABLE-01` at
  `8,900 DT`, confirmed it (“Reserved 1 unit”, reservation id shown), and fulfilled it
  (“Issued 1 unit”, status Fulfilled).
- **Ledger**: the dashboard stayed at 18 units on hand with 0 reserved while movements rose
  11 → 13 (received 21, issued 6). Hosted rows agree: the receipt carries
  `reference_type = purchase_order`, the issue `reference_type = outgoing_order`, the
  reservation is `fulfilled`, balances are `A-01 = 16` and `A-02 = 2`, and the projection
  sum equals the ledger sum (18 / 18, zero drift).

That verification data remains in the tenant: supplier “Tunis Tech Distribution”,
`PO-2026-0001`, and `SO-2026-0001`.

### Hosted check: returns and supplier performance (2026-10-31)

The Phase 7 migration (`20261031120000_returns_and_supplier_performance.sql`) was pushed to the
hosted project on 2026-10-31 with `npx supabase db push --db-url "$DATABASE_URL" --yes` after a
dry run listed exactly that one migration. A read-only check then confirmed `purchase_returns`,
`purchase_return_lines`, `purchase_return_devices`, `sales_returns`, and `sales_return_lines`
exist with RLS enabled, the six return functions are present (`create_purchase_return`,
`post_purchase_return`, `cancel_purchase_return`, `create_sales_return`, `post_sales_return`,
`cancel_sales_return`), the migration is recorded in `supabase_migrations.schema_migrations`,
the enums (`app.stock_reference_type`, `app.document_kind`, `app.return_status`) carry the
return labels, and the `stock_operations_operation_check` constraint accepts the return
tokens. Both return tables were empty at check time.

A signed-in pass followed in the same “MyStock” tenant against the hosted API. Baselines:
`CABLE-01` held 16 at `MAIN / A-01` plus 2 at `A-02` (18 on hand) with 13 movements, and
`PO-2026-0001` was fully received (1 / 1).

- **Purchase return**: created draft `PR-2026-0001` against that received line with reason
  “Hosted verification: damaged cable”, reference `HOSTED-PR-2026-10-31`, one unit, then posted
  it. The section switched to Posted and “New purchase return” became disabled.
- **Ledger**: hosted rows show the return `posted` with `posted_at` set, its line at quantity 1,
  and exactly one movement of `-1.0000` with `reference_type = purchase_return` and
  `reference_id` equal to the return id, leaving `A-01` at 15. Balances are 15 + 2 = 17, the
  movement count is 14, and the projection still equals the ledger (zero drift).
- **Dashboard**: 17 units on hand and 14 movements after the post. The supplier performance
  card listed “Tunis Tech Distribution” with 1 order (1 received), on-time `—` (the order
  carries no expected date), 0.0 d lead time, `7.500 DT` received value, and a 100% return rate
  from 1 returned unit.
- **Over-return guard**: a second one-unit return for the same line was rejected by the API with
  HTTP 400 `constraint_violation` — “The return exceeds the quantity received and not yet
  returned.” — and a follow-up query confirmed it left no extra return row and no extra
  movement.
- **Sales return**: created and posted `SR-2026-0001` against the fulfilled `SO-2026-0001`
  (customer “Societe Retail Test”) with reason “Hosted verification: customer return”,
  reference `HOSTED-SR-2026-10-31`, and one unit. The order line then showed RETURNED 1 and
  “New sales return” became disabled. Hosted rows show the return `posted`, its line at
  quantity 1, and one receipt movement of `+1.0000` with `reference_type = sales_return` at
  `MAIN / A-01`, leaving balances 16 + 2 = 18 across 15 movements with zero drift. The
  dashboard refreshed to 18 units on hand, 15 movements, and received 22 / issued 7 / net 18;
  the supplier card stayed at a 100% return rate, because supplier metrics count only purchase
  returns.

A later dry run (`npx supabase db push --db-url "$DATABASE_URL" --dry-run`) reported “Remote
database is up to date”, confirming hosted carries the full Phase 7 schema.

Both posted returns and their movements remain in that tenant.

## Purchasing document verification

The Phase 8 suites run without a hosted project and need no database:

```powershell
npm run test --workspace @mystock/api -- test/documents/purchase-document-model.test.ts test/api/purchase-documents.test.ts
```

Expected: 6 passing tests (4 model, 2 API). The model tests assert per-line rounding and summing
(`2 × 4,500` + `1 × 1,800`, with a cost-less line excluded and counted), the `DRAFT` watermark,
status label, meta rows and file name, the return note with sorted serials, and the ASCII
formatters (millimes grouping, diacritic transliteration, non-Latin replacement). The API tests
request both PDFs through supertest and assert `200`, `application/pdf`, the exact
`attachment; filename="mystock-PO-…pdf"` header, the `%PDF-` magic bytes and byte length, a
pdf-lib parse with the expected title, viewer access, `404 organization_not_found` for a
non-member, and `404 purchase_order_not_found` / `purchase_return_not_found` for unknown ids;
they also download a purchase return as a draft and again after posting.

The headed run drives real downloads through the browser. With the local stack up (same
commands as the Phase 6 section):

```powershell
npm run build:apps
cd apps/web
npx playwright test --config playwright.local-stack.config.ts --headed
```

Expected: 18 passing checks (9 tests × desktop/mobile). The purchase-documents test creates a
supplier, receives a purchase order, posts a one-unit purchase return, opens the order in
`/purchasing`, downloads the purchase-order PDF, then downloads the return note from its row;
both downloads are asserted by suggested file name (`mystock-PO-YYYY-NNNN.pdf`,
`mystock-PR-YYYY-NNNN.pdf`), size, and `%PDF-` header.

Full gates on 2026-10-31 for Phase 8: `format:check`, `lint`, `typecheck`, and `build` clean;
226 Vitest tests across the workspaces (177 API across 23 files, 33 domain, 8 contracts, 8
config); the headed run above passed 18/18 with Allure served at http://127.0.0.1:5053 for this
run. Phase 8 adds no migration: documents are rendered from the existing tables, so hosted
carries the required schema already.

## Team access verification

The Phase 9 suites run without a hosted project:

```powershell
npm run test --workspace @mystock/api -- test/db/team-access.test.ts test/api/team.test.ts
```

Expected: 22 passing tests (13 database, 9 API). The database suite covers the `profiles`
projection and email sync, invitation email normalization, expiry and reissue, duplicate and
already-member rejection, owner-role rejection, viewer RLS denial, the pending list's email
gate, acceptance and idempotent replay, mismatched-email rejection, and the tightened
membership policies: an admin cannot demote, promote, or remove an owner, cannot promote
itself or insert an owner, and the last-owner trigger still blocks removing or demoting the
final owner. The API suite covers member listing, `404 organization_not_found` for
non-members, viewer `403`s, invitation creation and duplicate rejection, admin-only invitation
history, the pending-invitation contract, acceptance reflected in `/me`, `owner_required`
errors, role changes, last-owner refusal, removal, and revocation including a second revoke
returning `409`.

The headed run uses the same local stack, which now seeds a third account,
`carol@example.com`, with no membership:

```powershell
npm run build:apps
cd apps/web
npx playwright test --config playwright.local-stack.config.ts --headed
```

Expected: 22 passing checks (11 tests × desktop/mobile). The team test signs in as the owner,
invites carol, confirms the pending row and the duplicate-invitation error, signs in as carol,
accepts from the pending banner, confirms her new member row, then changes her role to manager
and removes her. A second test confirms a viewer sees the team read-only, with no invite
button, role select, or remove button.

To exercise it by hand, start both apps against a project with the Phase 9 migration applied,
open **Team** as an owner, and invite an email that belongs to an existing account. MyStock
sends no email: sign in with that account in another browser profile and accept the banner
above the page. The invitation also appears before the account has any organization.

Full gates on 2026-10-31 for Phase 9: `format:check`, `lint`, `typecheck`, and `build` clean;
248 Vitest tests across the workspaces (199 API across 25 files, 33 domain, 8 contracts, 8
config); the headed local-stack run passed 22/22 with Allure served at
http://127.0.0.1:5054 for this run; the shell regression suite passed 16/16.

The hosted project (`kohrmjzwmtqnwrmkymez`) received the Phase 9 migration on 2026-10-31. The
dry run listed only `20261031140000_team_access.sql`; after the push, a read-only check found
`public.profiles` and `public.organization_invitations` with RLS enabled, the
`auth_users_sync_profile` trigger feeding `app.sync_profile_email`, the eight `app.*` team
functions (the six mutating ones executable by `authenticated` only, not `anon`), the
`profiles_select_self_or_shared` / `organization_invitations_select_admin` policies, the
tightened `memberships_*_admin` policies, and the migration record. The profiles backfill
matched the hosted account count (2). Simulating each account's JWT claims under the
`authenticated` role confirmed isolation: the SBS VISION account sees only its own profile, no
MyStock invitation rows, and its pending MyStock invitation through
`app.my_pending_invitations()`; the MyStock owner sees only their own profile and the
invitation row. The signed-in Team page in the “MyStock” tenant listed the owner, showed the
pending invitation, and the API returned 200 for members and invitations, an empty pending
list for the owner, and `409 invitation_already_pending` for a duplicate invite.

Hosted acceptance was verified on 2026-10-31. The owner's first invitation was revoked before
acceptance, so a fresh viewer invitation was created through the API, then accepted through
`app.accept_invitation` under the invitee's own JWT claims (`authenticated` role) — tooling never
handles an account password, so the sign-in form and banner were not used for this step (that
path is covered by the headed local-stack suite). The acceptance created the MyStock viewer
membership, stamped `accepted_at`, and cleared the invitee's pending list; a replay returned the
same organization id, and calling the RPC with the owner's claims was rejected with
`invitation_email_mismatch` (`42501`). The owner's Team page then showed 2 members with
`ou2sema@gmail.com` as Viewer and the invitation history showing Accepted plus the earlier
Revoked row. Hosted role change and removal are still unexercised (they would alter the accepted
membership); both are covered by the database and headed suites above. A pending invitation to
`test@gmail.com` created during this pass remains in the tenant.

## Platform administration verification

The Phase 10 suites run without a hosted project:

```powershell
npm run test --workspace @mystock/api -- test/db/platform-administration.test.ts test/api/admin.test.ts test/api/account.test.ts
```

Expected: 25 passing tests (8 database, 6 administration API, 11 account API). The database
suite proves the platform flag reads organizations and profiles across tenants, does not widen
access to products or stock levels, restricts `app.create_organization` to platform admins,
manages invitations and memberships in an organization the admin does not belong to, keeps the
last-owner trigger in force for platform admins, and gives managers viewer-only invitations
without role changes, removal, or revocation. The API suite covers the `/admin/organizations`
listing and its `403 platform_admin_required` for ordinary owners, cross-organization team
management, the last-owner guard through HTTP, outsider `404`s, manager viewer-only invitations,
and pending-invitation counts. The account suite covers the `platformAdmin` field in `/me`,
organization creation restricted to the flag, and first-member invitation on creation.

The headed run uses the same local stack, which now seeds `gina@example.com` as a manager in
Org A and `pat@example.com` as a platform admin with no membership:

```powershell
npm run build:apps
cd apps/web
npx playwright test --config playwright.local-stack.config.ts --headed
```

Expected: 28 passing checks (14 tests × desktop/mobile). The administration test signs in as
pat, creates a project-specific organization with gina invited as manager, opens the
organization picker to invite another manager, checks the pending counts, opens that
organization's team page, and returns to `/admin`. The manager test signs in as gina and
confirms the viewer-only invitation form, no role selects or remove buttons, and no revoke
action.

To exercise it by hand locally, sign in as `pat@example.com` (any password on the fake auth
server) and open **Administration**. On a hosted project the Phase 10 migration marks
`ou3sema@gmail.com` as the first platform admin; the flag is then changed only through SQL —
there is no HTTP endpoint that grants it. Apply the migration before deploying this API
version, because `/me` reads the flag.

Full gates on 2026-10-31 for Phase 10: `format:check`, `lint`, `typecheck`, and `build` clean;
266 Vitest tests across the workspaces (217 API across 27 files, 33 domain, 8 contracts, 8
config); the headed local-stack run passed 26/26 with Allure served at
http://127.0.0.1:5055 for this run.

The hosted project received the Phase 10 migration
(`20261031160000_platform_administration.sql`) on 2026-10-31 after the user approved the push;
the dry run listed only that migration. A read-only check then confirmed the
`profiles.is_platform_admin` column, the `app.is_platform_admin()` function, and the migration
record, with `ou3sema@gmail.com` carrying the flag and the other profiles at `false`.
Simulating each member's JWT claims under the `authenticated` role showed the exact `/me`
query returning `true` for the operator (3 visible organizations) and `false` for the viewer
(2 visible organizations), so the pre-migration `500` on `/me` is resolved. The signed-in
hosted organization-creation and cross-organization team flows have not been exercised yet;
they are covered by the local-stack suite.

## Operational hardening verification

The Phase 11 suites run without a hosted project:

```powershell
npm run test --workspace @mystock/api -- test/db/admin-audit.test.ts test/api/admin.test.ts test/schema-guard.test.ts
```

Expected: 17 passing tests (4 audit database, 8 administration API, 5 schema guard). The
audit suite proves that platform-admin organization, invitation, role, and removal actions
write rows with the right actor, target, and detail; that the same actions performed by an
organization owner are not logged; that non-platform users read zero rows and cannot insert
directly; and that `member_role_changed` and `member_removed` record before/after state.
The administration API suite adds the `/admin/audit` endpoint: 403 for an ordinary owner,
row contents for the operator, no entry for a manager-created invitation, a `limit` cap, and
`400 validation_error` for `limit=0`. The schema-guard suite runs every migration on PGlite,
asserts the full schema passes, lists objects when only early migrations are applied,
refuses an out-of-date schema, and distinguishes an unreachable database (warn and continue)
from a server-side error (stop).

The headed run uses the same local stack and now runs 28 checks (14 tests × desktop/mobile);
the extra test is the top-bar bell regression added after Phase 10. The administration test now
also asserts the Operator activity table on `/admin` lists the created organization and the
invitation, including the target email and actor.

The integrity CLI was exercised against the local stack on 2026-10-31:

- Clean database: `Integrity check: 1 organization(s). OK Org A (0 stock line(s))`, exit `0`.
- A deliberately inserted balance with no ledger movement: `DRIFT Org A — 1 of 1 stock
line(s)` with `balance=5.0000 ledger=0 difference=5.0000`, exit `1`. The row was then
  removed and the sweep returned to zero drift.

The operator grant script was exercised the same day: it granted
`alice@example.com`, a second run reported “already a platform administrator”, an unknown
email exited `1`, and the audit row stored `jsonb_typeof(detail) = object` with
`{"source":"grant-platform-admin.mjs"}` and a `null` actor.

Full gates on 2026-10-31 for Phase 11: `format:check`, `lint`, `typecheck`, and `build`
clean; 277 Vitest tests across the workspaces (228 API across 29 files, 33 domain, 8
contracts, 8 config); the headed local-stack run passed 28/28; the web build emits one
chunk per route.

The Phase 11 migration (`20261031180000_admin_audit.sql`) has **not** been applied to the
hosted project. Apply it before deploying this API version: the boot-time schema probe
checks for `public.admin_audit_events` and stops the process otherwise. This was verified
against hosted on 2026-10-31 by booting the production build with the root `.env`: the process
refused to start with `Database schema is out of date; missing public.admin_audit_events.
Apply supabase/migrations before starting the API.` No hosted schema change was made, and the
locally running API on `:4100` was left on the previous build, so the app stayed available.
Since 2026-11-01 the same refusal is exercised automatically on every push by the CI
`database` job (“Virgin-database drill”), so it no longer needs a manual hosted probe.
The restore drill in [`runbooks/restore-drill.md`](runbooks/restore-drill.md) is documented but
has not been executed.

Update on 2026-11-01: `20261031180000_admin_audit.sql` and
`20261101144800_membership_write_hardening.sql` were applied to the hosted project with
`npx supabase db push --db-url "$env:DATABASE_URL"` (dry-run first, no `--include-seed`, over
the session pooler). A read-only check afterwards confirmed `public.admin_audit_events`,
`app.log_admin_action(p_action, p_organization, p_target_user, p_target_email, p_detail)`, the
lock-taking `app.protect_last_owner` body, the single `memberships_select_member` policy, and
that `authenticated` no longer holds INSERT/UPDATE/DELETE on `memberships`. The production API
build then booted against hosted past the schema guard, and `npm run check:integrity` reported
OK for all six organizations.

## Interface localization verification

Phase 12 changes no schema and no API contract. The existing suites remain the regression
check, and a dedicated spec covers the new behavior:

```powershell
cd apps/web
npx playwright test --config playwright.local-stack.config.ts --headed
```

Expected: 40 checks (20 tests × desktop/mobile). The four `e2e-local/i18n.spec.ts` tests
cover:

- French pre-auth copy, the sign-in form, dashboard copy, `fr-TN` money and date output,
  and persistence across a reload;
- a localized authentication error (`Identifiants de connexion invalides`) instead of the
  Supabase English message;
- Arabic copy, `lang="ar"`/`dir="rtl"`, the sidebar mirrored to the right on desktop,
  Latin digits with no Arabic-Indic digits, and persistence;
- live switching in the sign-in page and top bar (`en` → `fr` → `ar` → `en`) with the
  stored `mystock.locale` value checked at each step.

The local stack also seeds a second organization, `Org B`, with no catalog data so
organization switching can be exercised. A `dashboard.spec.ts` regression test exports the
stock-levels CSV, switches organization, and asserts that the download notice and the
warehouse filter are cleared rather than leaking across tenants. A second regression test
holds the network open while switching and asserts that product rows never carry across the
organization boundary while still using placeholder data for filter changes inside one
organization.

The English assertions in `admin`, `dashboard`, `operations`, and `team` were not edited
and still pass, confirming the conversion produced byte-identical English copy.

A catalog audit bundled the message modules and compared all locales: 1,285 flat keys per
locale with no missing or extra keys in French or Arabic, no placeholder mismatch in
French, and all six CLDR categories present for each of the 24 plural nouns in every
locale. Arabic deliberately omits `{count}` in the 12 zero/one/two forms where the word
itself carries the number (for example “تم استلام وحدة واحدة” for one unit); the few, many,
and other forms carry it.

Full gates on 2026-10-31 for Phase 12: `format:check`, `lint`, `typecheck`, and `build`
clean; `npm test` still runs 277 Vitest tests across the workspaces; the headed local-stack
run passed 38/38 in 4.3 minutes with Allure served at http://127.0.0.1:5058.

Re-run on 2026-11-01 after the Nexora rebrand, the login redesign, and the repository-audit
remediation: 290 Vitest tests (242 API, 33 domain, 8 contracts, 7 config) and the headed
local-stack suite 40/40 (20 tests × desktop/mobile) with Allure served at
http://127.0.0.1:5058; `format:check`, `lint`, `typecheck`, and `build` clean.

Re-run on 2026-11-01 for the health probes: 300 Vitest tests (252 API across 33 files, 33 domain,
8 contracts, 7 config), the headed shell suite 18/18 (9 tests × desktop/mobile) against the
hosted-facing API, and the headed local-stack suite 40/40, with Allure served at
http://127.0.0.1:5059; `format:check`, `lint`, `typecheck`, and `build` clean.

The French timestamp uses a 24-hour clock: CLDR's `fr-TN` default is a 12-hour clock with
an English “PM”, so the provider forces `hourCycle: 'h23'` for French. Money keeps three
decimals in every locale (`0,000 DT`, `TND 0.000`, `0,000 د.ت.`).

No hosted change is involved: the locale is a browser preference, there is no migration,
and PDFs, CSV exports, labels, and invitation emails remain English. If a local database
already holds the stack's default PostgreSQL port, set `E2E_PG_PORT` to a free port before
the run.

## Operator tasks

### Integrity sweep

`npm run check:integrity` reads `DATABASE_URL` and `DATABASE_SSL` from the environment or
the root `.env`, iterates every organization, calls `app.stock_reconciliation` with an
owner/admin's JWT claims, and prints `OK`, `DRIFT`, or `SKIP` per organization. Exit code
`0` means every projection matches its ledger; `1` means drift or an error. It is read-only
and safe while the API runs.

Schedule it daily or weekly and alert on a non-zero exit:

- **Linux cron** — `15 6 * * * cd /srv/mystock && DATABASE_SSL=true npm run check:integrity >> /var/log/mystock-integrity.log 2>&1`.
- **Windows Task Scheduler** — run `npm.cmd` with arguments `run check:integrity`, working
  directory the repository root, with `DATABASE_URL` set for the task.
- **CI** — a scheduled workflow step with the hosted `DATABASE_URL` in a repository secret.
  Keep it separate from the deploy job so an outage is visible without blocking deploys.

### Granting platform administration

`npm run grant:platform-admin --workspace @mystock/api -- person@example.com` connects with
`DATABASE_URL`, so it needs database administration rights (the migration role or the
operator's own console). It is idempotent, refuses an email with no profile (the person must
have signed in at least once), never prints the connection string, and writes a
`platform_admin_granted` audit row with a `null` actor. There is still no HTTP grant path.

### Virgin-database drill

`npm run drill:virgin-database --workspace @mystock/api` rebuilds the schema from nothing the
way a first deployment does and checks both halves of the boot-time schema guard. It needs
`npm run build` first (it starts `dist/main.js`) and a `DATABASE_URL` pointing at a local
PostgreSQL you are allowed to create and drop databases on; anything else is refused before a
connection is opened, so a hosted URL can never be damaged by it. It leaves no database
behind: each run creates `drill_*` databases and drops them, including on failure. See
“Continuous integration” for what it asserts.

### Rolling back a release

[`runbooks/deploy-rollback.md`](runbooks/deploy-rollback.md) covers the three layers that can
move independently (web build, API build, database), the decision table for the common
symptoms, and the verification checklist. Migrations are forward-only, so a bad schema
change is fixed by a corrective migration proven with the virgin-database drill, or by a
restore — never by editing an applied migration. Backup retention and RPO for the hosted
project are **not recorded yet**; capture them during the restore drill and add them to that
runbook.

### Dependency updates

`npm audit` reported 13 moderate advisories on 2026-11-02, all rooted in one advisory: GHSA-g3hv-75wg-m249
(`minimatch` DoS via glob-part amplification), vulnerable below 11.0.1, reached through `eslint`,
`@eslint/config-array`, `@typescript-eslint/typescript-estree`, and `@nestjs/cli`, which all require
`^10.2.5`. `npm audit fix --force` would have "fixed" it by downgrading `eslint` to 4.0.0, `@eslint/js`
to 9.39.5, and `typescript-eslint` to 8.36.0 — a broken toolchain. The controlled fix is the root
`overrides` entry `"minimatch": "^11.0.3"`; `npm ls minimatch` then shows 11.0.3 for all four nodes and
`npm audit` reports zero. The gates that prove the override is safe are `npm run lint` (config-array
globbing), `npm run typecheck`, `npm run test`, `npm run build`, and the E2E suites. Actions run #11 on
2026-11-02 (commit `8fab63b`) is the first remote run carrying that override: all four jobs concluded
`success`, and the `database` drill passed again on `postgres:16`. The proof that CI gets the patched copy
is the committed lockfile — it lists exactly one `minimatch` node, `node_modules/minimatch` at `11.0.3`,
and `npm ci` installs only what the lockfile names.

Deliberate pending majors, each its own verified change: `typescript` 6.0.3 → 7.x (build layer for six
workspaces), `postgres` 3.4.9 → 4.0.0 (the API's driver), `@hookform/resolvers` 6.0.2 → 7.0.1 (form
validation), and `embedded-postgres` 18.4.0-beta.17 → 18.6.0-beta.19, which changes the PostgreSQL
version the concurrency suite and the local stack run against.

One patch release is pinned back on purpose: `@tanstack/react-query` **5.105.1 breaks the supplier
performance card**. With 5.105.1 the local-stack test `supplier performance › shows delivery metrics on
the dashboard` fails in both projects (the `Supplier performance` row for the run's random supplier is
never visible), and it reproduces in isolation, so it is not a parallelism flake. Bisecting the two web
runtime bumps: `lucide-react` 1.66.0 alone passes, `react-query` 5.105.0 + `lucide-react` 1.66.0 passes
40/40. `apps/web/package.json` therefore stays at 5.105.0; revisit 5.105.1 or later only with that test
in the gate, and re-run `npm run test:e2e:local` (40 checks) after any web-runtime change.

### Restore drill

Follow [`runbooks/restore-drill.md`](runbooks/restore-drill.md). It targets a scratch
Supabase project, never production, and has not been executed yet.

## Quality gates

```powershell
npm run format:check   # Prettier, read-only
npm run lint           # ESLint flat config across every workspace
npm run typecheck      # builds packages, then tsc per workspace
npm run test           # builds packages, then Vitest per workspace
npm run build          # packages first, then apps (order matters)
```

`build` and `typecheck` build `packages/*` before the apps. npm executes workspaces
alphabetically, so `@mystock/api` would otherwise build against a stale or missing
`@mystock/config` output.

## Database

The schema is plain SQL in `supabase/migrations`, applied in filename order:

| Migration                                             | Contents                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `20261029120000_tenancy.sql`                          | organizations, memberships, helper functions, base RLS                                                                 |
| `20261029121000_catalog.sql`                          | products, categories, brands, warehouses, storage locations                                                            |
| `20261029130000_stock_ledger.sql`                     | ledger, balances, reservations, idempotency, reconciliation RPCs                                                       |
| `20261029140000_serialized_devices.sql`               | devices, device events, lifecycle transitions                                                                          |
| `20261030100000_barcode_workflows.sql`                | GTIN checks, barcode assignment, stock counts and posting RPCs                                                         |
| `20261030120000_reporting_realtime.sql`               | guarded realtime publication for balances, movements, reservations, devices                                            |
| `20261030140000_operational_workflows.sql`            | suppliers, purchase orders, outgoing orders, numbering and lifecycle RPCs                                              |
| `20261031120000_returns_and_supplier_performance.sql` | purchase and sales returns, return numbering and lifecycle RPCs                                                        |
| `20261031140000_team_access.sql`                      | profiles projection, email-keyed invitations, membership and invitation RPCs                                           |
| `20261031160000_platform_administration.sql`          | platform-admin flag, restricted organization creation, cross-organization team access, manager viewer-only invitations |
| `20261031180000_admin_audit.sql`                      | operator audit table, `app.log_admin_action`, logged organization/invitation/membership RPCs                           |
| `20261101144800_membership_write_hardening.sql`       | tightened membership write policies and re-recorded audit RPCs                                                         |

Demo data lives in `supabase/seed.sql` and requires at least one signed-up user (it raises
`seed_requires_auth_user` otherwise). The seed inserts demo inventory into the first signed-up
user's organization; never run it against production or a hosted project containing real data.

Tenant isolation is enforced by Postgres RLS: tables carry `organization_id`, roles come from
`memberships.role`, and every policy calls the `app.*` helpers. The isolation suite runs
against PGlite (PostgreSQL in WASM) inside Vitest, so it needs no Docker, no credentials, and
runs in CI on every `npm run test`.

PGlite allows only one connection, so `apps/api/test/db/concurrency.test.ts` boots a
temporary embedded PostgreSQL 18 cluster instead. The `embedded-postgres` dev dependency
ships the platform binary through `npm install`; the suite applies the real migrations,
opens a 12-connection `pg` pool, and proves row-lock serialization, idempotent duplicate
claims, deadlock-free opposing transfers, and reservation/issue races. It needs no Docker
and no hosted credentials.

| Role    | Manage organization and members | Write catalog | Read |
| ------- | ------------------------------- | ------------- | ---- |
| owner   | yes                             | yes           | yes  |
| admin   | yes                             | yes           | yes  |
| manager | no                              | yes           | yes  |
| viewer  | no                              | no            | yes  |

Admins manage non-owner members and invitations; only owners can change, remove, or promote to
owner, and the last-owner trigger prevents losing the final owner. Managers may read invitations
and create viewer invitations. A platform administrator is an app-level
`profiles.is_platform_admin` flag, not an organization role: platform admins may create
organizations and administer identity rows (organizations, memberships, profiles, invitations)
across tenants, but business tables still require membership.

Applying migrations to the hosted project (needs your access token and database password):

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Without linking, push directly with the connection string from `.env` (the CLI expects it
percent-encoded):

```powershell
npx supabase db push --db-url "$env:DATABASE_URL"
```

These commands apply migrations only. Do not add `--include-seed` for production: it injects
demo data from `supabase/seed.sql` and is intended only for a disposable development/test
database.
The direct database host (`db.<project-ref>.supabase.co`) is IPv6-only for this project. On a
network without an IPv6 route, use the session pooler instead: host
`aws-0-eu-west-1.pooler.supabase.com`, port `5432`, user `postgres.<project-ref>`, database
`postgres`, TLS required. The pooler URL is also shown in Dashboard → Connect → Session
pooler. `migration list` and `db push` work through it.

Current hosted state (project `kohrmjzwmtqnwrmkymez`, checked 2026-10-31): the Phase 1–7
migrations (tenancy, catalog, stock ledger, serialized devices, barcode workflows, reporting
and realtime, operational workflows, returns and supplier performance) are applied, RLS is
enabled on every table, and the demo seed has run against the first signed-up user, who is
owner of “SBS VISION” with 7 products and 2 warehouses. A Phase 2 hosted end-to-end check
passed: a real Supabase password grant produced a token the API accepted, the callers'
organizations were isolated, and a foreign organization returned `404`. The temporary
verification account was removed; only the owner remains. Phase 8 added no schema. Phase 9
(`20261031140000_team_access.sql`) was applied on 2026-10-31; the hosted Team page, API,
tenant isolation, and invitation acceptance are verified, while hosted role change and removal
are still unexercised (see “Team access verification”). Phase 10
(`20261031160000_platform_administration.sql`) was applied on 2026-10-31; hosted organization
creation is now platform-admin-only, and the bootstrap flag for `ou3sema@gmail.com` is
verified in `profiles`. The signed-in hosted Phase 10 UI flows remain to be exercised. Phase 11
(`20261031180000_admin_audit.sql`) was applied on 2026-11-01 together with the remediation
migration `20261101144800_membership_write_hardening.sql`, after which the schema guard let the
current API build boot against hosted.

The Phase 3 migrations (`20261029130000_stock_ledger.sql` and
`20261029140000_serialized_devices.sql`) were pushed to the hosted project on 2026-10-29 after
the local suites and a read-only check of the hosted schema. The historical deployment also
used `--include-seed` and intentionally populated demo data; do not repeat that option in
production. A manual hosted UI pass in a second tenant then posted
every movement type — receipt, issue, reservation, reservation fulfilment, transfer out/in,
and an adjustment — and the balance projection matched the ledger with zero reconciliation
drift. The same pass registered a serialized device, moved it, and walked its status graph
(in stock → sold → returned → in stock), each step appending an event. That verification data
remains in the tenant. The root `.env` `DATABASE_URL` holds the real connection string; never
commit it.

The Phase 4 migration (`20261030100000_barcode_workflows.sql`) was pushed on 2026-10-30 with
`npx supabase db push --db-url "<session-pooler-url>" --yes` after a dry run listed exactly that
one migration. A read-only check then confirmed `stock_counts`, `stock_count_lines`, the
one-open-count index, `app.post_stock_count`, and `app.assign_product_barcode` exist in the
hosted project, where `stock_counts` was still empty.

A signed-in hosted UI pass followed the same day in the “MyStock” tenant. It resolved
`CABLE-01` by SKU with a `2100000000012` barcode assigned, ignored a repeated scan inside the
1.5 s window, kept manual entry usable after camera permission was denied, posted a 1-unit scan
receipt (A-01 8 → 9, total 11), downloaded 1-page A4 label PDFs for the product and for device
`SN-IPH15-0001`, and ran an inventory count at `MAIN / A-01`: line `CABLE-01` counted 9, post
reported 1 line and 0 adjustments. Hosted rows afterwards showed the count `posted`, the line
at `9.0000`, balances 9 + 2 = 11, and zero `inventory_count` movements. No defects surfaced;
the receipt, barcode, and posted count remain in that tenant.

For a disposable development/test database only, the seed can be run deliberately with
`--include-seed`; it raises `seed_requires_auth_user` when no account exists. Hosted production
migration commands above omit seed data.

An easy way to sign up for local use is the sign-in page's "Create one" link. With
`mailer_autoconfirm = false` (the project default), confirm the email before signing in.

Run only the database tests while iterating:

```powershell
npm run test --workspace @mystock/api -- test/db
```

## Test suites

| Command                                                         | What it runs                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test`                                                  | 300 Vitest tests: RLS/seed, catalog, stock, devices, barcode workflows, real-PostgreSQL concurrency, operational workflows, returns, purchase documents, team access, platform administration, admin audit, membership write hardening, health probes, schema guard, API shell, env, contracts, domain |
| `npm run test:e2e`                                              | Playwright against the API and dev server (18 checks: 9 tests × desktop/mobile)                                                                                                                                                                                                                        |
| `npm run test:e2e:headed`                                       | Same, with visible browsers (local verification)                                                                                                                                                                                                                                                       |
| `npm run test:e2e -- --project=desktop`                         | One Playwright project only                                                                                                                                                                                                                                                                            |
| `npm run test:e2e:local --workspace @mystock/web`               | Phase 6–12 flows on the self-contained stack (40 checks: 20 tests × desktop/mobile); run from `apps/web` after `npm run build:apps`                                                                                                                                                                    |
| `npx playwright test --config playwright.local-stack.config.ts` | The same suite directly, adding `--headed` for local verification                                                                                                                                                                                                                                      |
| `npm run drill:virgin-database --workspace @mystock/api`        | Migrations + seed onto virgin local databases and both schema-guard boot paths (needs `npm run build` and a localhost `DATABASE_URL`)                                                                                                                                                                  |

The API suites (`apps/api/test/api`) run the real migrations on PGlite, sign JWTs with
locally generated ES256 keys, and serve the trusted public key from a temporary JWKS
endpoint. No hosted credentials and no network access are required. The concurrency suite
(`apps/api/test/db/concurrency.test.ts`) uses embedded PostgreSQL because it needs multiple
simultaneous connections.

Playwright starts both servers itself (`webServer` in `apps/web/playwright.config.ts`)
and reuses already-running instances locally. Reuse means a stale process can serve old
code: stop leftover servers before a run you want to trust. The API server is started from
`apps/api/dist/main.js`, so run `npm run build:apps` after changing API code.

Locally it drives the installed Edge via `channel: 'msedge'`; on CI it downloads
Playwright's Chromium. Override with `$env:PLAYWRIGHT_CHANNEL = ''` to use bundled
Chromium locally.

## Allure report

```powershell
npm run test:e2e
cd apps/web
npx allure generate ./allure-results -o ./allure-report --clean
npx allure open ./allure-report
```

For a one-shot local preview, `npx allure serve ./allure-results --port 5050` generates and
serves the report at http://localhost:5050 without writing `allure-report/`.

`allure` needs Java on `PATH`. Every `npm run test:e2e` clears `apps/web/allure-results`
first, so the report always reflects exactly one run. `allure-results/` and
`allure-report/` are ignored by git.

## Continuous integration

`.github/workflows/ci.yml` runs four jobs on `ubuntu-latest` for every push to `main`
and every pull request:

| Job         | Steps                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `quality`   | `npm ci` → format check → lint → typecheck → unit tests → build                                                     |
| `database`  | `npm ci` → build → Postgres service → virgin-database drill (migrations, seed, schema guard)                        |
| `e2e`       | `npm ci` → install Chromium → Postgres service + migrations → write test `.env.local` → build → Playwright → upload |
| `e2e-local` | `npm ci` → install Chromium → build → full local-stack Playwright suite → artifact upload                           |

The `e2e` job writes placeholder `VITE_` values (no real project, no real secrets) and
uploads `test-results/` plus `allure-results/` only when the run fails. It also runs a
`postgres:16` service container, creates the `auth.users` shim and the `authenticated` role,
and applies every `supabase/migrations/*.sql` in filename order before Playwright starts,
because the API's boot-time schema guard refuses to listen on an unmigrated database. The
`e2e-local` job boots embedded PostgreSQL, the fake auth/JWKS server, the built API, and
Vite, so it needs no Supabase project; it runs the same 40 checks as the headed local run.
All three jobs ran green on GitHub Actions on 2026-11-01 (run #6, commit `38c94db`); the
`e2e` job had never been green before — it needed the Postgres service above, and the
`shell.spec.ts` fixes for the Nexora sign-in copy and the lazy-route mount timing.

The `database` job added on 2026-11-01 runs `npm run drill:virgin-database --workspace
@mystock/api` (`apps/api/scripts/virgin-db-drill.mjs`) against a `postgres:16` service
container. It creates throwaway databases, applies the `auth.users` shim, every
`supabase/migrations/*.sql` in filename order, and `supabase/seed.sql`, then starts the
built API twice: once on a complete schema, where `/health/ready` must answer and the boot
log must contain `Database schema verified`, and once after dropping
`public.admin_audit_events`, where the schema guard must stop the process with a non-zero
exit naming that table. The seed halves additionally prove a virgin database refuses
`seed_requires_auth_user` and that re-running the seed is idempotent. Because it drops
databases, the script rejects any `DATABASE_URL` whose host is not `localhost` or
`127.0.0.1`, so it cannot reach a hosted project. Verified locally on 2026-11-01 against a
throwaway embedded PostgreSQL 18 cluster: 12 migrations applied, seeded rows
`1/1/7/7/7/2/3` (organizations/memberships/products/categories/brands/warehouses/locations),
readiness `ok` with a 54–78 ms database probe, and the negative run exiting `1` with
`Database schema is out of date; missing public.admin_audit_events`. First remote run:
Actions run #10 on 2026-11-01 (commit `62db120`), where the `database` job passed on
`postgres:16` — its "Run the virgin-database drill" step finished in about 64 seconds and the
whole run concluded `success` across all four jobs.

To reproduce the `quality` job locally, run the gates above in the same order after a
clean `npm ci`. To reproduce the `e2e` job locally, stop any running dev servers first — CI mode never
reuses an existing server and fails if 4100 or 5173 is occupied:

```powershell
$env:CI = 'true'
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
Remove-Item Env:\CI
```

## Troubleshooting

**Port 4100 already in use** — find and stop the owner:

```powershell
Get-NetTCPConnection -LocalPort 4100 -State Listen |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Get-Process -Id $_ }
```

**Playwright reports `strictPort` failure on 5173** — a previous Vite process survived
the terminal that started it. Identify it by command line before stopping it:

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'vite' } |
  Select-Object ProcessId, CommandLine
```

**Blank page in development with a module export error** — the shared packages compile to
CommonJS for the API; Vite aliases them to their TypeScript sources. Restart the dev server
after changing `vite.config.ts`, and do not point the alias back at `dist`.

**`/api/v1/...` returns 404 during E2E but 401/200 from a manual curl** — Playwright reused
a stale API process serving an older `dist`. Stop it (check the command line first) and
rerun; `npm run build:apps` before the suite prevents the stale build.

**Sign-in fails with "Invalid login credentials"** — the user does not exist in the Supabase
project behind `VITE_SUPABASE_URL`, or the password is wrong. Sign-up may also require email
confirmation depending on project settings.

**`supabase db push` fails with `hostname resolving error` or `ENETUNREACH`** — the direct
database host is IPv6-only and this network has no IPv6 route. Use the session-pooler URL
described under [Database](#database) instead.

**`Error: Environment variable VITE_SUPABASE_URL is missing`** — `apps/web/.env.local` is
absent or incomplete. Recreate it as shown above.

**Allure command not found / Java error** — `npm run report:allure` uses the
`allure-commandline` dev dependency; install a JRE 17+ and reopen the terminal.

## Security notes

- Only the Supabase **anon** key may appear in web configuration. Row Level Security is
  what makes that safe; the isolation suite proves it on every test run.
- The API verifies user tokens against the project's public JWKS. It never trusts a role
  or organization id supplied by the client; both are re-derived from the token and the
  membership table.
- The service-role key stays in the API process environment and is never sent to the
  browser, logged, or committed. The request path does not use it.
- `.env*` files are git-ignored; only `.env.example` is tracked, and it contains
  placeholders only.
