# Mystock

Inventory management platform for electronics and technology products: multi-warehouse
stock, an immutable stock ledger, serialized-device traceability, barcode workflows,
and organization-scoped reporting.

> Status: Phase 10 (platform administration) implemented and verified locally. Phase 2 proved
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
> and on the hosted project, where its migration was applied and invitation acceptance was
> exercised. Phase 10 adds platform administration: a database-managed `profiles.is_platform_admin`
> flag lets an operator create organizations (optionally inviting the first admin, manager, or
> viewer), list every organization, and administer members across organizations without joining
> them. Organization owners and admins keep their roles; managers may read the invitation log and
> invite viewers only. Platform administration covers identity rows, not business data, so stock,
> catalog, devices, and orders still require membership. It is verified locally, and its
> migration was applied to the hosted project on 2026-10-31 with the bootstrap flag verified
> for the operator account. Phase 11 adds operational hardening: a platform-admin audit trail
> (`/admin` shows recent operator activity), a schema capability probe that stops the API from
> booting against an out-of-date database, a read-only integrity CLI
> (`npm run check:integrity`), an idempotent operator script for granting the platform flag, the
> full local-stack Playwright suite in CI, and route-level code splitting. Its migration was applied
> to the hosted project on 2026-11-01; the documented
> restore drill has not been executed. Phase 12 localizes the interface into French and
> Arabic: typed message catalogs with compile-time key parity, CLDR plural categories, a
> per-device language switch with browser detection, right-to-left layout, locale-aware
> money/date/quantity formatting with Latin digits in Arabic, and translated API and
> authentication errors. It needs no schema change; PDFs, CSV exports, and labels remain
> English. Phase 13 adds the counter sale: scan or search into a basket, name the buyer, take
> payment, and post a numbered commercial invoice (`FI-2026-0001`) plus a goods issue note in one
> idempotent transaction. A tenant-scoped customer directory backs the buyer; every amount,
> including the per-line tax rate captured at the sale, is computed by the database, an issued
> invoice is immutable, and a balance is settled by later payment rows. Serialized units leave
> through the device graph with no ledger movement, bulk quantity through the existing outgoing
> order and ledger, so reports, returns, and reconciliation cover counter sales unchanged. The
> local-stack suite is headed-verified, and on 2026-11-03 the migration was applied to the hosted
> project and the first counter sale was posted there from the signed-in app: invoice
> `FI-2026-0001`, 14.900 TND paid in cash, its `SO-2026-0002` exit document and the `issue` ledger
> line behind it all read back out of the hosted database, and both PDFs downloaded. Nothing is
> production-ready yet.

## Stack

| Area      | Choice                                                                          |
| --------- | ------------------------------------------------------------------------------- |
| Frontend  | React 19 + TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, RHF + Zod        |
| Backend   | NestJS 12 REST API, Zod validation, JWKS-verified Supabase JWTs                 |
| Data      | Supabase PostgreSQL (RLS), Supabase Auth, Realtime, Storage                     |
| ORM       | Drizzle + `postgres`, SQL-first migrations in `supabase/`                       |
| Tests     | Vitest (PGlite + embedded PostgreSQL), Playwright, Allure                       |
| Scanning  | BarcodeDetector + ZXing fallback, HID keyboard wedge, `bwip-js`, `pdf-lib` PDFs |
| Money     | TND only, integer millimes, `formatTnd` (see ADR-0002)                          |
| Interface | English, French, Arabic; per-device locale, RTL (see ADR-0014)                  |

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
specified in [ADR-0011](docs/adr/0011-team-access.md). Platform administration and the
operator flag are specified in [ADR-0012](docs/adr/0012-platform-administration.md).
The Phase 11 hardening measures — audit trail, boot-time schema probe, integrity CLI, CI
coverage, and route splitting — are specified in
[ADR-0013](docs/adr/0013-operational-hardening.md). Interface localization, typed catalogs,
plurals, RTL, and error translation are specified in
[ADR-0014](docs/adr/0014-interface-localization.md). Liveness and readiness probes are
specified in [ADR-0015](docs/adr/0015-health-probe-endpoints.md), and audit-trail retention in
[ADR-0016](docs/adr/0016-operator-audit-retention.md). Counter sales, commercial invoices, and
the customer directory are specified in
[ADR-0017](docs/adr/0017-counter-sales-and-invoices.md).

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

| Method | Path                                                                     | Role required                                       |
| ------ | ------------------------------------------------------------------------ | --------------------------------------------------- |
| GET    | `/api/v1/me`                                                             | any authenticated user                              |
| GET    | `/api/v1/admin/organizations`                                            | platform admin                                      |
| GET    | `/api/v1/admin/audit`                                                    | platform admin                                      |
| POST   | `/api/v1/organizations`                                                  | platform admin                                      |
| GET    | `/api/v1/organizations/:id/products`                                     | any member                                          |
| POST   | `/api/v1/organizations/:id/products`                                     | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/products/:productId`                          | any member                                          |
| PATCH  | `/api/v1/organizations/:id/products/:productId`                          | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/categories`                                   | any member                                          |
| POST   | `/api/v1/organizations/:id/categories`                                   | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/brands`                                       | any member                                          |
| POST   | `/api/v1/organizations/:id/brands`                                       | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/warehouses`                                   | any member                                          |
| POST   | `/api/v1/organizations/:id/warehouses`                                   | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/warehouses/:warehouseId/locations`            | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/stock-levels`                                 | any member                                          |
| GET    | `/api/v1/organizations/:id/stock-levels/summary`                         | any member                                          |
| GET    | `/api/v1/organizations/:id/stock-movements`                              | any member                                          |
| POST   | `/api/v1/organizations/:id/stock-movements`                              | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/stock-transfers`                              | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/stock-reservations`                           | any member                                          |
| POST   | `/api/v1/organizations/:id/stock-reservations`                           | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/stock-reservations/:reservationId/release`    | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/stock-reconciliation`                         | owner, admin                                        |
| POST   | `/api/v1/organizations/:id/stock-reconciliation/repair`                  | owner, admin                                        |
| GET    | `/api/v1/organizations/:id/devices`                                      | any member                                          |
| POST   | `/api/v1/organizations/:id/devices`                                      | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/devices/:deviceId`                            | any member                                          |
| GET    | `/api/v1/organizations/:id/devices/:deviceId/events`                     | any member                                          |
| POST   | `/api/v1/organizations/:id/devices/:deviceId/status`                     | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/devices/:deviceId/location`                   | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/scan`                                         | any member                                          |
| POST   | `/api/v1/organizations/:id/products/:productId/barcode`                  | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/labels`                                       | any member                                          |
| GET    | `/api/v1/organizations/:id/stock-counts`                                 | any member                                          |
| POST   | `/api/v1/organizations/:id/stock-counts`                                 | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/stock-counts/:countId`                        | any member                                          |
| POST   | `/api/v1/organizations/:id/stock-counts/:countId/lines`                  | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/stock-counts/:countId/post`                   | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/stock-counts/:countId/discard`                | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/reports/overview`                             | any member                                          |
| GET    | `/api/v1/organizations/:id/reports/low-stock`                            | any member                                          |
| GET    | `/api/v1/organizations/:id/reports/exports/stock-levels.csv`             | any member                                          |
| GET    | `/api/v1/organizations/:id/reports/exports/movements.csv`                | any member                                          |
| GET    | `/api/v1/organizations/:id/suppliers`                                    | any member                                          |
| POST   | `/api/v1/organizations/:id/suppliers`                                    | owner, admin, manager                               |
| PATCH  | `/api/v1/organizations/:id/suppliers/:supplierId`                        | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/suppliers/:supplierId/activation`             | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/purchase-orders`                              | any member                                          |
| POST   | `/api/v1/organizations/:id/purchase-orders`                              | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId`             | any member                                          |
| POST   | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId/order`       | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId/receipts`    | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId/cancel`      | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/purchase-orders/:purchaseOrderId/pdf`         | any member                                          |
| GET    | `/api/v1/organizations/:id/sales-orders`                                 | any member                                          |
| POST   | `/api/v1/organizations/:id/sales-orders`                                 | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/sales-orders/:salesOrderId`                   | any member                                          |
| POST   | `/api/v1/organizations/:id/sales-orders/:salesOrderId/confirm`           | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/sales-orders/:salesOrderId/fulfil`            | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/sales-orders/:salesOrderId/cancel`            | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/purchase-orders/:id/returns`                  | any member                                          |
| POST   | `/api/v1/organizations/:id/purchase-orders/:id/returns`                  | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/purchase-orders/:id/returns/:returnId`        | any member                                          |
| POST   | `/api/v1/organizations/:id/purchase-orders/:id/returns/:returnId/post`   | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/purchase-orders/:id/returns/:returnId/cancel` | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/purchase-orders/:id/returns/:returnId/pdf`    | any member                                          |
| GET    | `/api/v1/organizations/:id/sales-orders/:id/returns`                     | any member                                          |
| POST   | `/api/v1/organizations/:id/sales-orders/:id/returns`                     | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/sales-orders/:id/returns/:returnId`           | any member                                          |
| POST   | `/api/v1/organizations/:id/sales-orders/:id/returns/:returnId/post`      | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/sales-orders/:id/returns/:returnId/cancel`    | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/customers`                                    | any member                                          |
| POST   | `/api/v1/organizations/:id/customers`                                    | owner, admin, manager                               |
| PATCH  | `/api/v1/organizations/:id/customers/:customerId`                        | owner, admin, manager                               |
| POST   | `/api/v1/organizations/:id/customers/:customerId/activation`             | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/sales-invoices`                               | any member                                          |
| POST   | `/api/v1/organizations/:id/sales-invoices`                               | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/sales-invoices/:invoiceId`                    | any member                                          |
| GET    | `/api/v1/organizations/:id/sales-invoices/:invoiceId/pdf`                | any member                                          |
| GET    | `/api/v1/organizations/:id/sales-invoices/:invoiceId/issue-note/pdf`     | any member                                          |
| POST   | `/api/v1/organizations/:id/sales-invoices/:invoiceId/payments`           | owner, admin, manager                               |
| GET    | `/api/v1/organizations/:id/reports/supplier-performance`                 | any member                                          |
| GET    | `/api/v1/organizations/:id/members`                                      | any member or platform admin                        |
| PATCH  | `/api/v1/organizations/:id/members/:userId`                              | owner, admin, platform admin                        |
| DELETE | `/api/v1/organizations/:id/members/:userId`                              | owner, admin, platform admin                        |
| GET    | `/api/v1/organizations/:id/invitations`                                  | owner, admin, manager, platform admin               |
| POST   | `/api/v1/organizations/:id/invitations`                                  | owner, admin, manager (viewer only), platform admin |
| POST   | `/api/v1/organizations/:id/invitations/:invitationId/revocation`         | owner, admin, platform admin                        |
| GET    | `/api/v1/me/invitations`                                                 | any authenticated user                              |
| POST   | `/api/v1/me/invitations/:invitationId/acceptance`                        | any authenticated user                              |

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

Counter sales are one transaction and one idempotency key. `POST .../sales-invoices` calls
`app.create_sales_invoice`, which creates the outgoing order and its lines, reserves and issues
them, walks the order `draft → confirmed → fulfilled`, moves the chosen devices `in_stock → sold`
with an `issued` event, writes the invoice, and records its first payment. A bulk line therefore
leaves through the ledger as an `outgoing_order` `issue` movement, while a serialized unit leaves
through the device graph with no ledger movement — a device never enters `stock_balances`. A sale whose lines are all devices has no order at all
(`sales_order_id` is null) and posts no movement, so it appears in the invoice list rather than the
outgoing-orders list; a mixed sale splits, bulk lines through the order and devices through the
invoice. The client sends no totals: quantity × price (a
line's negotiated price or `products.sale_price_minor`), the per-line tax rate captured at the sale,
net, tax, and gross are recomputed from the rows the function locks, with tax rounded per line and
the totals being the sum of those rounded lines (ADR-0010), so HT + taxes = TTC exactly on the
printed page. Invoices are numbered per organization and year (`FI-2026-0001`) by the same sequence
as the other documents. An issued invoice is immutable — no edit, no cancel: goods go back through a
sales return or the device status graph, never through the invoice. Payments are rows of their own
(`cash`, `bank_transfer`, `card_manual`, `credit`) claimed under their own key, with
`unpaid`/`partial`/`paid` projected onto the invoice and over-collection refused.

Customers are a minimal tenant-scoped directory that mirrors suppliers: a required name, optional
contact fields, and deactivation that blocks new invoices without deleting history. Each invoice
snapshots the buyer's name, email, and phone, so renaming a customer later cannot change what was
already printed, and a walk-in sale can carry an ad-hoc name with no directory row. `/sale` is the
counter. Its one scan box takes a USB or Bluetooth scanner (a keyboard wedge: a burst with under
60 ms between keystrokes, at least three characters, Enter or Tab as the terminator), the phone
camera, or a typed code, and resolves all three through the unchanged `GET .../scan` — a serial
resolves to that exact unit, a product code to a quantity line. Basket, buyer, payment, document
downloads, and the recent invoices with what is still owed on them live on that screen; `/customers`
manages the directory. Owners, admins, and managers post sales, record payments, and edit customers;
every member, viewers included, reads invoices and downloads their PDFs.

Purchase documents are rendered on demand from the tenant-scoped rows: `GET
.../purchase-orders/:id/pdf` and `GET .../purchase-orders/:id/returns/:returnId/pdf` return an
A4 PDF named `nexora-<number>.pdf` as an attachment. Line amounts are `quantity × unit cost`
rounded per line and summed; a line without a cost is excluded from the total and flagged in a
printed note. Draft and cancelled documents carry a watermark, every page carries a UTC
generation timestamp and `Page x of y`, and any member — viewers included — may download,
while a non-member receives `404`. Text is normalized to the PDF standard fonts' ASCII range,
so non-Latin scripts degrade to `?` (see
[ADR-0010](docs/adr/0010-purchasing-documents.md)). Nothing is stored: the PDF always reflects
the current rows.

The counter's two documents render through the same layers. `GET .../sales-invoices/:id/pdf` is the
commercial invoice: fiscal totals, per-line tax, the payments taken, and the serial numbers of the
units sold. `GET .../sales-invoices/:id/issue-note/pdf` is the goods issue note — the warehouse's
own outbound document, with quantities and no amounts — numbered after the order it released
(`SO-2026-0001`) or after the invoice when the sale only issued devices. Both are attachments named
`nexora-<number>.pdf`, are projections of the current rows, and are downloadable by any member.

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

Platform administrators are marked by `public.profiles.is_platform_admin`, a database-managed
flag with no HTTP grant path; `ou3sema@gmail.com` is the first operator in the migration. A
platform admin can create an organization (becoming its owner) with an optional first
admin/manager/viewer invitation, open `/admin` to list every organization with member and
pending-invitation counts, and open any organization's team page to invite, change roles, remove
members, and revoke invitations — even without a membership there. Their visibility is limited
to identity rows (organizations, memberships, profiles, invitations); catalog, stock, devices,
orders, and reports remain behind ordinary RLS membership checks. Managers may read invitations
and invite viewers only; owners and admins continue to manage roles, removals, and revocations,
and the last-owner trigger applies to every caller, platform admins included. See
[ADR-0012](docs/adr/0012-platform-administration.md).

Platform-admin actions are audited. Every organization created, invitation created or
revoked, role changed, and member removed by a platform admin writes a row in
`public.admin_audit_events` with the actor, organization, target, and before/after detail.
Organization owners, admins, and managers keep their own powers and are not logged, so the
trail covers cross-tenant operator activity; `/admin` shows the latest entries in an
Operator activity table, and `GET /api/v1/admin/audit` serves the same rows to platform
admins only. The table is RLS-protected and has no client write grant. Granting the
platform flag is still a database operation, now available as an idempotent operator
script that records its own audit row.

The trail has a bounded lifetime. `app.prune_admin_audit_events(retention_days)` deletes rows older
than the window the operator passes, refuses a window under 30 days or above 10 years, and is
executable by the table owner only — no route, contract, or UI action calls it.
`npm run prune:admin-audit --workspace @mystock/api` (180 days by default; `-- --dry-run` inspects
without deleting) is built for an external scheduler, and its arguments must be passed through the
workspace form because a root-level alias would swallow them.
See [ADR-0016](docs/adr/0016-operator-audit-retention.md).

The API probes the schema at boot (`to_regclass`/`to_regprocedure`) and refuses to start
when a reachable database is missing objects it needs, naming them; an unreachable database
only logs a warning so health checks and the shell test suite still run. `npm run
check:integrity` sweeps every organization, calls `app.stock_reconciliation` under an
owner/admin's claims, and exits non-zero on any drift, so it can run unattended. See
[ADR-0013](docs/adr/0013-operational-hardening.md) and
[`docs/runbooks/restore-drill.md`](docs/runbooks/restore-drill.md) for the operator
procedures, with
[`docs/runbooks/deploy-rollback.md`](docs/runbooks/deploy-rollback.md) covering which layer a
release rolls back and how to verify it.

Three public routes answer infrastructure polling without a token and outside the rate limit:
`/health` (the dashboard status source), `/health/live` (process only), and `/health/ready`
(`select 1` through the pool, `503 service_unavailable` with `unreachable`, `timeout`, or `error`
when the database cannot answer within 2 seconds — never the driver message). See
[ADR-0015](docs/adr/0015-health-probe-endpoints.md).

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

| Script                                               | Purpose                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                       | ESLint across the workspace                                                                                     |
| `npm run format`                                     | Prettier write                                                                                                  |
| `npm run format:check`                               | Prettier check without writing                                                                                  |
| `npm run typecheck`                                  | TypeScript project checks per workspace                                                                         |
| `npm run test`                                       | Unit/integration tests per workspace                                                                            |
| `npm run test:e2e`                                   | Playwright end-to-end suite                                                                                     |
| `npm run check:integrity`                            | Read-only stock/ledger sweep for every organization (exits 1 on drift)                                          |
| `npm run drill:virgin-database`                      | Rebuild a virgin local database from migrations + seed and prove both schema-guard boot paths (localhost only)  |
| `npm run prune:admin-audit --workspace @mystock/api` | Delete operator audit rows past a retention window; add `-- --dry-run` to inspect first (owner-role connection) |
| `npm run report:allure`                              | Serve the Allure report from the last E2E run                                                                   |
| `npm run build`                                      | Build every workspace package                                                                                   |
