# Mystock

Inventory management platform for electronics and technology products: multi-warehouse
stock, an immutable stock ledger, serialized-device traceability, barcode workflows,
and organization-scoped reporting.

> Status: Phase 8 (purchasing documents) implemented and verified locally. Phase 2 proved
> schema, RLS, demo seed, sign-in token → API → tenant-scoped queries. Phase 3 added the
> immutable stock ledger, atomic posting functions, balance projections, reservations,
> serialized-device traceability, idempotent mutations, and reconciliation repair, and was
> exercised against the hosted project. Phase 4 added GTIN-validated barcode generation, a
> single scan pipeline, server-rendered label PDFs, camera scanning with a manual fallback,
> and scan-assisted receiving and inventory counts; its migration and a signed-in hosted pass
> were completed on 2026-10-30. Phase 5 adds server-side report aggregation with warehouse,
> category, and window filters, stock valuation, movement trends, low-stock alerts, CSV
> exports, and RLS-authorized realtime updates backed by an unconditional 30-second poll. It
> is verified locally and against the hosted project, including the publication migration and
> end-to-end socket delivery. Phase 6 adds a supplier directory, purchase orders with
> incremental receiving (serialized lines register devices), outgoing orders that reserve on
> confirmation and issue on fulfilment, per-organization/year document numbering, and
> single-transaction lifecycle RPCs. It is verified locally on a self-contained stack and, on
> 2026-10-31, through a signed-in hosted pass over suppliers, a purchase order receipt, and an
> outgoing order. Phase 7 adds purchase returns (credit notes against received lines, with
> disposal of serialized devices), sales returns that restock the order location, post-time
> over-return revalidation, and an on-demand supplier performance report; it is verified
> locally, and on 2026-10-31 its migration was pushed to the hosted project, where a signed-in
> pass posted a purchase return and a sales return with matching ledger movements. Phase 8
> renders purchase orders and purchase return notes as server-side PDFs, with ledger-matched
> totals, DRAFT/CANCELLED watermarks, and browser downloads from the purchasing screens; it is
> verified locally and needs no schema change. Phase 9 adds organization team management: a
> member list with role changes and removal, plus email-keyed invitations that the invited
> person accepts after signing in, with owner-only control over owners. It is verified locally
> on the self-contained stack; the new migration still has to be applied to the hosted
> project before Team works there. Nothing is production-ready yet.

## Stack

| Area      | Choice                                                                   |
| --------- | ------------------------------------------------------------------------ |
| Frontend  | React 19 + TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, RHF + Zod |
| Backend   | NestJS 12 REST API, Zod validation, JWKS-verified Supabase JWTs          |
| Data      | Supabase PostgreSQL (RLS), Supabase Auth, Realtime, Storage              |
| ORM       | Drizzle + `postgres`, SQL-first migrations in `supabase/`                |
| Tests     | Vitest (PGlite + embedded PostgreSQL), Playwright, Allure                |
| Scanning  | BarcodeDetector + ZXing fallback, `bwip-js` labels, `pdf-lib` PDFs       |
| Money     | TND only, integer millimes, `formatTnd` (see ADR-0002)                   |
| Interface | English only (see ADR-0002)                                              |

Architecture decisions live in [`docs/adr/`](docs/adr/). The Phase 0 assessment is summarized in
[`docs/adr/0001-stack-and-platform-boundaries.md`](docs/adr/0001-stack-and-platform-boundaries.md).
Authentication, tenant-scoped data access, and the catalog API are specified in
[ADR-0004](docs/adr/0004-api-auth-and-tenant-data-access.md). The ledger, reservations,
idempotency, and device traceability are specified in
[ADR-0005](docs/adr/0005-stock-ledger-and-device-traceability.md). Barcodes, scanning, labels,
and inventory counts are specified in
[ADR-0006](docs/adr/0006-barcodes-scanning-and-stock-counts.md). Reporting, exports, and
authorized realtime are specified in
[ADR-0007](docs/adr/0007-reporting-and-realtime.md). Suppliers, purchase orders, and outgoing
orders are specified in
[ADR-0008](docs/adr/0008-operational-workflows.md). Purchase returns, sales returns, and
supplier performance are specified in
[ADR-0009](docs/adr/0009-returns-and-supplier-performance.md). Purchase document rendering is
specified in [ADR-0010](docs/adr/0010-purchasing-documents.md). Team roles and invitations are
specified in [ADR-0011](docs/adr/0011-team-access.md).

## Layout

```
apps/api        NestJS API
apps/web        React SPA
packages/       contracts (Zod), domain rules, config, testing helpers
supabase/       migrations, seed, RLS tests
docs/           ADRs, diagrams, runbooks
```

Multi-tenancy is organization-based: every catalog row carries `organization_id`, access is
decided by `memberships.role`, and Postgres RLS enforces the boundary for every query. See
[ADR-0003](docs/adr/0003-tenancy-and-rls.md).

## Authentication and API surface

Users sign in through Supabase Auth on `/sign-in`. The SPA sends the session's access token
to the API as a bearer token; the API verifies it against the project JWKS and runs every
query inside a transaction that holds the caller's identity, so RLS applies.

| Method | Path                                                                     | Role required          |
| ------ | ------------------------------------------------------------------------ | ---------------------- |
| GET    | `/api/v1/me`                                                             | any authenticated user |
| POST   | `/api/v1/organizations`                                                  | any authenticated user |
| GET    | `/api/v1/organizations/:id/products`                                     | any member             |
| POST   | `/api/v1/organizations/:id/products`                                     | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/products/:productId`                          | any member             |
| PATCH  | `/api/v1/organizations/:id/products/:productId`                          | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/categories`                                   | any member             |
| POST   | `/api/v1/organizations/:id/categories`                                   | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/brands`                                       | any member             |
| POST   | `/api/v1/organizations/:id/brands`                                       | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/warehouses`                                   | any member             |
| POST   | `/api/v1/organizations/:id/warehouses`                                   | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/warehouses/:warehouseId/locations`            | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/stock-levels`                                 | any member             |
| GET    | `/api/v1/organizations/:id/stock-levels/summary`                         | any member             |
| GET    | `/api/v1/organizations/:id/stock-movements`                              | any member             |
| POST   | `/api/v1/organizations/:id/stock-movements`                              | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/stock-transfers`                              | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/stock-reservations`                           | any member             |
| POST   | `/api/v1/organizations/:id/stock-reservations`                           | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/stock-reservations/:reservationId/release`    | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/stock-reconciliation`                         | owner, admin           |
| POST   | `/api/v1/organizations/:id/stock-reconciliation/repair`                  | owner, admin           |
| GET    | `/api/v1/organizations/:id/devices`                                      | any member             |
| POST   | `/api/v1/organizations/:id/devices`                                      | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/devices/:deviceId`                            | any member             |
| GET    | `/api/v1/organizations/:id/devices/:deviceId/events`                     | any member             |
| POST   | `/api/v1/organizations/:id/devices/:deviceId/status`                     | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/devices/:deviceId/location`                   | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/scan`                                         | any member             |
| POST   | `/api/v1/organizations/:id/products/:productId/barcode`                  | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/labels`                                       | any member             |
| GET    | `/api/v1/organizations/:id/stock-counts`                                 | any member             |
| POST   | `/api/v1/organizations/:id/stock-counts`                                 | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/stock-counts/:countId`                        | any member             |
| POST   | `/api/v1/organizations/:id/stock-counts/:countId/lines`                  | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/stock-counts/:countId/post`                   | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/stock-counts/:countId/discard`                | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/reports/overview`                             | any member             |
| GET    | `/api/v1/organizations/:id/reports/low-stock`                            | any member             |
| GET    | `/api/v1/organizations/:id/reports/exports/stock-levels.csv`             | any member             |
| GET    | `/api/v1/organizations/:id/reports/exports/movements.csv`                | any member             |
| GET    | `/api/v1/organizations/:id/suppliers`                                    | any member             |
| POST   | `/api/v1/organizations/:id/suppliers`                                    | owner, admin, manager  |
| PATCH  | `/api/v1/organizations/:id/suppliers/:supplierId`                        | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/suppliers/:supplierId/activation`             | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/purchase-orders`                              | any member             |
| POST   | `/api/v1/organizations/:id/purchase-orders`                              | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId`             | any member             |
| POST   | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId/order`       | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId/receipts`    | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId/cancel`      | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId/pdf`         | any member             |
| GET    | `/api/v1/organizations/:id/sales-orders`                                 | any member             |
| POST   | `/api/v1/organizations/:id/sales-orders`                                 | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/sales-orders/:salesOrderId`                   | any member             |
| POST   | `/api/v1/organizations/:id/sales-orders/:salesOrderId/confirm`           | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/sales-orders/:salesOrderId/fulfil`            | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/sales-orders/:salesOrderId/cancel`            | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/purchase-orders/:id/returns`                  | any member             |
| POST   | `/api/v1/organizations/:id/purchase-orders/:id/returns`                  | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/purchase-orders/:id/returns/:returnId`        | any member             |
| POST   | `/api/v1/organizations/:id/purchase-orders/:id/returns/:returnId/post`   | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/purchase-orders/:id/returns/:returnId/cancel` | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/purchase-orders/:id/returns/:returnId/pdf`    | any member             |
| GET    | `/api/v1/organizations/:id/sales-orders/:id/returns`                     | any member             |
| POST   | `/api/v1/organizations/:id/sales-orders/:id/returns`                     | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/sales-orders/:id/returns/:returnId`           | any member             |
| POST   | `/api/v1/organizations/:id/sales-orders/:id/returns/:returnId/post`      | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/sales-orders/:id/returns/:returnId/cancel`    | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/reports/supplier-performance`                 | any member             |
| GET    | `/api/v1/organizations/:id/members`                                      | any member             |
| PATCH  | `/api/v1/organizations/:id/members/:userId`                              | owner, admin           |
| DELETE | `/api/v1/organizations/:id/members/:userId`                              | owner, admin           |
| GET    | `/api/v1/organizations/:id/invitations`                                  | owner, admin           |
| POST   | `/api/v1/organizations/:id/invitations`                                  | owner, admin           |
| POST   | `/api/v1/organizations/:id/invitations/:invitationId/revocation`         | owner, admin           |
| GET    | `/api/v1/me/invitations`                                                 | any authenticated user |
| POST   | `/api/v1/me/invitations/:invitationId/acceptance`                        | any authenticated user |

Errors use `{ "error": { "code", "message", "details?", "requestId" } }` and repeat the
`x-request-id` response header. Database constraint failures map to `409` or `400`; an
unknown organization inside your tenant scope returns `404`, never `403`, to avoid leaking
existence.

Every stock and device mutation requires an `Idempotency-Key` header (8–120 characters).
The key, a SHA-256 fingerprint of the normalized request, and the result are stored in the
same transaction as the stock change. A retry of the same request returns the original
result with `duplicate: true`; reusing a key for a different payload returns
`409 idempotency_conflict`.

Stock postings accept `receipt`, `issue`, and `adjustment`; transfers use their own endpoint
so both legs commit atomically. `available` is `on_hand` minus active reservations, and an
issue or transfer can never consume reserved quantity. `stock-reconciliation` compares the
`stock_balances` projection with the ledger sum and `stock-reconciliation/repair` rebuilds
the projection without touching historical movements. Serialized devices move through a
fixed status graph (`in_stock → reserved/sold/in_repair/lost/disposed`, …) and every change
appends an immutable `device_events` row.

`GET .../scan?code=` resolves a device serial or IMEI first, then a product barcode, SKU, or
internal code, and returns either a device with its full context or a product with
per-location stock lines. `POST .../products/:id/barcode` mints an EAN-13 in the GS1
in-store `2` range with a valid check digit and is idempotent per product; manufacturer
barcodes are never overwritten. `POST .../labels` returns a print-ready A4 PDF for up to
50 product or device targets (1–20 copies each), choosing EAN-8/UPC-A/EAN-13/ITF-14 when
the code is a valid GTIN and Code 128 otherwise.

Inventory counts are persisted sessions: only one count can be open per location, lines can
be incremented by repeated scans or set directly, and posting writes one adjustment
movement per real variance (`reference_type = 'inventory_count'`) in the same transaction
that marks the count posted. Posting requires an `Idempotency-Key`, refuses an empty count,
and cannot push stock below an active reservation. In the web app, `/scan` covers receiving
and counting; camera scanning prefers the browser's `BarcodeDetector` and falls back to
ZXing, while manual entry and serial/SKU lookup always remain available. Repeated identical
scans within 1.5 seconds are ignored by the console.

`GET .../reports/overview` aggregates the ledger, reservations, and serialized devices inside
the caller's RLS transaction: quantities, cost and retail valuation in millimes, movement
totals and a UTC daily series, and a per-warehouse breakdown. `warehouseId`, `categoryId`,
`from`, and `to` filter every part of the response; the window defaults to 30 days and ends
at the request time. `GET .../reports/low-stock` compares per-product availability with
`reorder_threshold`, counting in-stock devices for serialized products, and powers both the
dashboard list and the top-bar alert badge. The two CSV exports quote fields, cap at 50,000
rows with `422 export_too_large`, and are fetched as authenticated blobs. The dashboard
subscribes to Realtime changes on balances, movements, reservations, and devices; RLS
authorizes every event. It also polls every 30 seconds unconditionally, because a channel can
report connected without delivering events when its tables are not in the publication.

Suppliers belong to one organization and their names are unique; deactivation keeps the
history but removes them from new purchase orders. Purchase orders move
`draft → ordered → partially_received → received`, and may only be cancelled before any stock
is received (a partial receipt also closes cancellation). Each receipt covers part of every
open line and writes one ledger receipt per line. A serialized line receives `serial|IMEI`
entries and registers one device plus a `registered` event per serial instead of posting a
quantity. Outgoing orders move `draft → confirmed → fulfilled`: confirming reserves every line
at the document's warehouse and location, fulfilling issues against those reservations, and
cancelling releases them; serialized products are rejected on order lines. Documents are
numbered per organization and year (`PO-2026-0001`, `SO-2026-0001`). Every create and
transition requires an `Idempotency-Key` and claims it exactly once for the whole document, so
a retried request returns the stored result instead of double-posting stock.

Returns are documents of their own (`PR-2026-0001`, `SR-2026-0001`) that move
`draft → posted` or `draft → cancelled`. A purchase return may cover any part of a received
line; posting writes one ledger issue per line and, for serialized lines, disposes exactly the
chosen in-stock devices with a `disposed` event and no quantity movement. A sales return
restocks the quantity into the order's warehouse location. Remaining quantity is checked when
the return is created and re-checked when it is posted while the source order line is locked,
so overlapping drafts can never exceed what was received or fulfilled. `GET
.../reports/supplier-performance` computes, over a default 90-day window, orders created and
received, ordered and received value, on-time rate against expected dates, average lead time,
and the posted-return rate; rates are `null` when their denominator is empty.

Purchase documents are rendered on demand from the tenant-scoped rows: `GET
.../purchase-orders/:id/pdf` and `GET .../purchase-orders/:id/returns/:returnId/pdf` return an
A4 PDF named `mystock-<number>.pdf` as an attachment. Line amounts are `quantity × unit cost`
rounded per line and summed; a line without a cost is excluded from the total and flagged in a
printed note. Draft and cancelled documents carry a watermark, every page carries a UTC
generation timestamp and `Page x of y`, and any member — viewers included — may download,
while a non-member receives `404`. Text is normalized to the PDF standard fonts' ASCII range,
so non-Latin scripts degrade to `?` (see
[ADR-0010](docs/adr/0010-purchasing-documents.md)). Nothing is stored: the PDF always reflects
the current rows.

Team access is managed from `/team`. Every member can see the member list; owners and admins
change roles, remove members, and manage invitations. Owners may touch owner rows; an admin can
only manage non-owner members, and the last-owner trigger still blocks removing or demoting the
final owner. Invitations are rows keyed by the lowercased email, not emails sent by the
platform: MyStock sends no outbound mail, so the invited person signs in with that address and
sees a pending banner that accepts the invitation. Acceptance requires the verified `email`
claim in the caller's token, expires after 14 days, and can only grant admin, manager, or
viewer — ownership is transferred by changing an existing member. A background projection of
`auth.users` emails into `public.profiles` backs the member list without granting the API access
to the auth schema. See [ADR-0011](docs/adr/0011-team-access.md).

## Prerequisites

- Node.js >= 22.12 (developed on 26.13.0) and npm >= 10
- A Supabase project (hosted) for development; see `.env.example`

## Getting started

Detailed instructions, ports, troubleshooting, and CI behavior live in
[`docs/setup.md`](docs/setup.md). Short version:

```powershell
npm install
Copy-Item .env.example .env
npm run lint
npm run typecheck
npm run build
```

## Scripts

| Script                  | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `npm run lint`          | ESLint across the workspace                   |
| `npm run format`        | Prettier write                                |
| `npm run format:check`  | Prettier check without writing                |
| `npm run typecheck`     | TypeScript project checks per workspace       |
| `npm run test`          | Unit/integration tests per workspace          |
| `npm run test:e2e`      | Playwright end-to-end suite                   |
| `npm run report:allure` | Serve the Allure report from the last E2E run |
| `npm run build`         | Build every workspace package                 |
