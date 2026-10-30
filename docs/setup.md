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
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
DATABASE_SSL=true
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only — it never appears in a `VITE_` variable,
and the request path does not use it. The API verifies tokens against the project's public
JWKS (`/auth/v1/.well-known/jwks.json`), so no JWT secret is needed.

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

## API authentication

Every route except `/health` requires `Authorization: Bearer <supabase-access-token>`. The
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
against them. Serialized products are kept out of quantity postings: a unit enters through
`register_device`, which records identity and lifecycle without posting a ledger receipt, and
quantity-tracked products use the stock RPCs. Combining both in one transaction is future work.

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

Hosted runs need the Phase 4 migration first (see below), because the hosted database does
not have the count tables yet.

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

| Migration                               | Contents                                                         |
| --------------------------------------- | ---------------------------------------------------------------- |
| `20261029120000_tenancy.sql`            | organizations, memberships, helper functions, base RLS           |
| `20261029121000_catalog.sql`            | products, categories, brands, warehouses, storage locations      |
| `20261029130000_stock_ledger.sql`       | ledger, balances, reservations, idempotency, reconciliation RPCs |
| `20261029140000_serialized_devices.sql` | devices, device events, lifecycle transitions                    |
| `20261030100000_barcode_workflows.sql`  | GTIN checks, barcode assignment, stock counts and posting RPCs   |

Demo data lives in `supabase/seed.sql` and requires at least one signed-up user (it raises
`seed_requires_auth_user` otherwise).

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

Applying migrations to the hosted project (needs your access token and database password):

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push --include-seed
```

Without linking, push directly with the connection string from `.env` (the CLI expects it
percent-encoded):

```powershell
npx supabase db push --db-url $env:DATABASE_URL --include-seed
```

Current hosted state (project `kohrmjzwmtqnwrmkymez`, checked 2026-10-29): the Phase 1–3
migrations (tenancy, catalog, stock ledger, serialized devices) are applied, RLS is enabled on
every table, and the demo seed has run against the first signed-up user, who is owner of “SBS
VISION” with 7 products and 2 warehouses. A Phase 2 hosted end-to-end check passed: a real
Supabase password grant produced a token the API accepted, the callers' organizations were
isolated, and a foreign organization returned `404`. The temporary verification account was
removed; only the owner remains.

The Phase 3 migrations (`20261029130000_stock_ledger.sql` and
`20261029140000_serialized_devices.sql`) were pushed to the hosted project on 2026-10-29 with
`npx supabase db push --db-url "$env:DATABASE_URL" --include-seed`, after the local suites and
a read-only check of the hosted schema. A manual hosted UI pass in a second tenant then posted
every movement type — receipt, issue, reservation, reservation fulfilment, transfer out/in,
and an adjustment — and the balance projection matched the ledger with zero reconciliation
drift. The same pass registered a serialized device, moved it, and walked its status graph
(in stock → sold → returned → in stock), each step appending an event. That verification data
remains in the tenant. The root `.env` `DATABASE_URL` holds the real connection string; never
commit it.

The Phase 4 migration (`20261030100000_barcode_workflows.sql`) is implemented and verified by
the local PGlite/API suites (17 tests) but is **not applied to the hosted project**. Until it
is pushed, the hosted API has no `stock_counts` tables or barcode RPCs, so the signed-in
scanning console works locally only against a database that has the migration.

Re-running the command above seeds idempotently. The seed raises `seed_requires_auth_user`
when no account exists.

An easy way to sign up for local use is the sign-in page's "Create one" link. With
`mailer_autoconfirm = false` (the project default), confirm the email before signing in.

Run only the database tests while iterating:

```powershell
npm run test --workspace @mystock/api -- test/db
```

## Test suites

| Command                                 | What it runs                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test`                          | 175 Vitest tests: RLS/seed, catalog, stock, devices, barcode workflows, real-PostgreSQL concurrency, API shell, env, contracts, domain |
| `npm run test:e2e`                      | Playwright against the API and dev server (16 checks: 8 tests × desktop/mobile)                                                        |
| `npm run test:e2e:headed`               | Same, with visible browsers (local verification)                                                                                       |
| `npm run test:e2e -- --project=desktop` | One Playwright project only                                                                                                            |

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

`.github/workflows/ci.yml` runs two jobs on `ubuntu-latest` for every push to `main`
and every pull request:

| Job       | Steps                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| `quality` | `npm ci` → format check → lint → typecheck → unit tests → build                              |
| `e2e`     | `npm ci` → install Chromium → write test `.env.local` → build → Playwright → artifact upload |

The E2E job writes placeholder `VITE_` values (no real project, no real secrets) and
uploads `test-results/` plus `allure-results/` only when the run fails.

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
