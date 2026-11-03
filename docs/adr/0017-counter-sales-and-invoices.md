# ADR-0017 — Counter sales, commercial invoices, and customers

- **Status:** accepted
- **Date:** 2026-11-02
- **Deciders:** product owner, engineering
- **Amends:** ADR-0008 decision 4, ADR-0009 decision 3, ADR-0010 out-of-scope list

## Context

The depot sells across the counter: a seller scans an item, builds a small basket, takes payment,
and hands over a commercial invoice. The only outbound path so far is the planned outgoing order
(ADR-0008): three separate transitions, three idempotency keys, no money beyond a per-line unit
price, no customer entity, no tax, no payment, and no document that says "invoice". Serialized
stock cannot enter that path at all, because an order line is a quantity and a serialized product
has no ledger quantity (ADR-0005 decision 6).

The product is a warehouse counter, not a supermarket till: the deliverable is a numbered
commercial invoice plus an outbound document, never a receipt. The constraints the design must
keep are the ones already in the repository: one immutable ledger, one idempotency key per
document transition, one scan pipeline, TND in integer millimes, and every quantity change through
the existing SQL primitives.

## Decisions

### 1. An invoice is a commercial layer on the existing outgoing order

`sales_invoices` is one-to-one with `sales_orders` (`unique (sales_order_id)`, nullable), and
posting a sale creates both in a single `app.create_sales_invoice` transaction. The order keeps
being the outbound document of record: the stock leaves through its lines exactly as a planned
order does, so `sales_returns`, the movement reports, and the reconciliation views need no changes
to cover counter sales.

One sale is one key. `app.create_sales_invoice` claims a single `stock_operations` row
(`operation = 'sales_invoice_create'`) and performs, inside that transaction, what the HTTP API
exposes as three transitions: create the order and its lines, reserve each line with
`app.operations_apply_reservation`, issue each line with `app.operations_apply_stock`, move the
order through `draft → confirmed → fulfilled`, dispose the selected devices, write the invoice with
its money snapshot, and record the first payment.

The transition RPCs are deliberately **not** called from inside the invoice RPC.
`app.confirm_sales_order` and `app.fulfil_sales_order` each claim their own idempotency key, and
`stock_operations` is unique per `(organization_id, idempotency_key)`, so nesting them would either
collide with the invoice's own key or need synthetic keys per step — both break the invariant that
one document transition consumes one key. Instead the invoice RPC reuses the same helpers those
RPCs use, which is what makes an invoice-created order row indistinguishable from a manually
confirmed and fulfilled one: reservation ids are populated, reservations end `fulfilled`, and the
order ends `fulfilled`. The existing routes, RPCs, and screens for planned orders are unchanged and
keep working side by side.

### 2. Bulk quantity leaves through the ledger; serialized units leave through the device graph

This is the decision that ADR-0008 decision 4 deferred. A line of a quantity-tracked product posts
an `issue` movement with `reference_type = 'outgoing_order'` against the invoice's order. A
serialized unit posts **no ledger movement at all**: a serialized product never enters
`stock_balances`, so an `issue` for one would either fail `on_hand_after >= 0` or invent quantity
the ledger does not have. Instead the invoice selects specific devices, moves each
`in_stock → sold` (allowed by `app.device_transition_allowed`), and appends a `device_events` row of
type `issued` — the same symmetry as receiving, which registers devices without a receipt, and the
same shape as `app.post_purchase_return`, which disposes devices in the transaction where it posts
its ledger movement.

Consequences of this split, recorded here because they amend earlier ADRs:

- `app.create_sales_order` keeps rejecting serialized products. The rejection was justified by the
  absence of a device-level allocation model; that model now exists at the invoice, so serialized
  units are allocated there and never written into `sales_order_lines`. The order-level guard is
  not weakened, and it is not bypassed with a direct insert.
- An invoice for serialized stock only creates no order and no movement (`sales_order_id` is null);
  its outbound document is the list of sold devices. Such a sale appears in the invoice list, not in
  the outgoing-orders list.
- A mixed sale splits: bulk lines go through the order and the ledger, devices through the invoice
  allocation.
- A customer return of a serialized device is an existing device transition
  (`sold → returned`, then `returned → in_stock`) performed with `app.change_device_status`, not a
  new state machine. This is what ADR-0009 decision 3 assumed was unnecessary, because its outgoing
  orders could not sell devices; counter sales can.

### 3. Customers are a minimal tenant-scoped directory

`customers` mirrors `suppliers`: organization-scoped, `name` required and trimmed, optional
email/phone/address/city/country code/tax id, `is_active`, `created_at`/`updated_at` with the same
touch trigger, composite `unique (organization_id, id)` so other tables can reference tenant-safe
foreign keys, RLS select for members, and `SELECT`-only grants to `authenticated`. Writes go
through `app.save_customer` / `app.set_customer_active`, role-gated like their supplier twins.

`sales_invoices` stores `customer_id` nullable **plus** a snapshot of name, email, and phone,
because an invoice must keep printing what it said on the day it was issued even if the customer
record is renamed later. A customer identity is required: either an existing `customerId` or an
ad-hoc name. That is not an invented rule — the invoice reuses `sales_orders`, whose
`customer_name` is `not null` — and it leaves the walk-in case to the seller, who types whatever
the depot calls it. There is no CRM here: no credit limit, no address book search, no customer
merge, no ledger of customer balances.

### 4. The database computes every amount

Prices are read server-side: a line may carry a negotiated `unitPriceMinor` (as outgoing order lines
already do), and when it does not, the RPC takes `products.sale_price_minor`. The client sends no
totals and none are trusted: quantity × price, per-line tax, net, tax total, and gross total are
recomputed in `app.create_sales_invoice` from the rows it locks.

Tax is a per-line rate captured at the moment of sale, defaulting to zero, stored as
`numeric(7,4)` with a check that it lies between 0 and 100. The owner chose per-line capture rather
than a global rate because an electronics depot sells items that fall under different regimes, and
because no tax table exists in the schema or in the brief. The rate is copied onto each invoice
line at creation, so later changes to a product cannot rewrite an issued invoice.

Rounding follows ADR-0010: tax per line is `round(net_amount_minor × rate / 100)` in millimes, and
the invoice totals are the sums of the rounded per-line values. That is what makes Total HT +
Taxes = Total TTC exactly on the printed page instead of drifting by a millime. Money stays
TND, `bigint` millimes, three decimals at the edge, and never a float.

No discount model exists in the repository, so none is introduced: a discount is expressed today by
lowering the unit price. `discount_amount_minor` is additive later if the depot needs discounts
visible as their own line on the invoice.

### 5. Payment is a trail of rows with a projection on the invoice

Partial payment and credit are both allowed. `sales_invoice_payments` records one row per payment
with amount, method, note, actor, and timestamp; the invoice carries `paid_amount_minor`,
`payment_status` (`unpaid`, `partial`, `paid`), and `payment_method` (the most recent payment's),
all written by the same definer function that inserts the row. The split mirrors the repository's
existing ledger/projection pattern, so `remaining_amount` is always `total − paid` and the rows
behind it are auditable.

`app.record_sales_invoice_payment` claims its own key (`operation = 'sales_invoice_payment'`), and
the SQL enforces `paid + amount <= total` — overpayment is rejected rather than silently
redistributed. The first payment is written by the posting RPC itself, so an invoice is never
created without its payment state.

Methods are `cash`, `bank_transfer`, `card_manual`, and `credit`. Nothing about the instrument is
stored: no card number, no IBAN, no cheque reference beyond the free-text note, which is capped and
operator-authored.

### 6. An issued invoice is immutable; corrections reuse the controlled paths

There is no edit and no cancel. Bulk goods go back through the existing `sales_return` documents,
which already post a `receipt` with `reference_type = 'sales_return'` against the same order line
and already guard against over-returning; devices go back through the device status graph. Adding
`app.cancel_sales_invoice` would be a second way to move stock, which ADR-0002/0005/0008 exist to
prevent.

A money correction (a credit note, or the French "avoir") is therefore **not** modelled in this
phase: reversing an amount requires the refund and manager-validation rules, which are open
decisions. Until those are settled, an over-charge is corrected by returning the goods and issuing
a new invoice, and an under-collection stays visible as `payment_status = 'partial'`.

Numbering reuses `app.document_sequences` and `app.next_document_number` with a new
`app.document_kind` value `sales_invoice` and the prefix `FI`, so invoice numbers keep the shape the
other four kinds already have: `FI-2026-0001`. The brief's `FAC-2026-000001` is not adopted,
because widening the prefix would leave `document_sequences` shared but the printed format
inconsistent across the same numbering function.

### 7. The outbound document is a projection, not a table

No `stock_issue_documents` table is created. The "bon de sortie" is rendered from rows that already
exist: the invoice header, its warehouse and location, the order lines and the `issue` movements
referencing them, and the devices sold. `GET .../sales-invoices/:id/issue-note/pdf` renders those
rows with the ADR-0010 model → renderer → service layers, on demand, and stores nothing. This keeps
the earlier decision that documents never carry authoritative quantities: the ledger is the only
place quantity lives, and a second outbound table would be a second place to be right.

### 8. One scan pipeline, three ways in

`GET /organizations/:id/scan` and its resolution order (serial → IMEI → product barcode → SKU →
internal code) are unchanged, and the sale screen calls it. Camera capture reuses the existing
component (native `BarcodeDetector`, lazy `@zxing/browser` fallback, rear camera, stream teardown).
The new part is a keyboard-wedge hook for USB/Bluetooth scanners, which are HID keyboards, not
browser APIs: it accumulates very fast input, treats Enter/Tab as the terminator, owns that
terminator so a scan can never also submit the payment form, clears the field and keeps focus there,
reports an unresolved code as an error, and never blocks typing by hand — keystrokes too far apart to
be a burst fall back to the field's own value and are emitted as `manual`. One capture at a time: a
second code arriving while a resolution is in flight is refused rather than queued. Repeated-identical
suppression lives on the camera leg only (1.2 s), because a camera reads the same label on every
frame while a hardware scan is a deliberate act. Manual entry remains a first-class path.

The hook emits a `ScanCapture` (`rawValue`, `source: 'usb' | 'camera' | 'manual'`, optional
`format`, `scannedAt`) and the sale screen turns a capture into a basket line by resolving it; the
workflow never references the decoder. `ScanResult` was not reused for that type: in
`packages/contracts/src/scanning.ts` it already names the discriminated union the scan endpoint
returns.

Serialized products are no longer filtered out of the sale screen. The existing
`sellableProducts` filter in the outgoing-order dialogs drops `is_serialized`, which was correct
while orders could not hold devices; the counter screen keeps them and routes them to device
capture, so a scan of a serial resolves to a device and adds that exact unit.

### 9. Lock order is fixed so concurrent sales queue instead of deadlocking

Within one posting transaction: claim the idempotency key, lock the order row, lock the selected
devices in `device_id` order, then take the bulk balances in `product_id` order through
`lock_stock_balance`. Two sellers scanning the same physical unit serialize on the device row lock,
and the loser fails `device_not_in_stock`; two sellers drawing on the same bulk balance serialize on
the balance and the loser fails `insufficient_stock` or `stock_reserved`, as in every existing
posting path.

`sales_invoice_lines` has no unique index on `device_id` across invoices. The device index is
`(sales_invoice_id, device_id) where device_id is not null`, so one unit cannot appear twice in the
same sale, while a device returned by a customer goes back to `in_stock` and legitimately appears in
a later invoice. Mutual exclusion between concurrent sales comes from the row lock plus the status
check, exactly as `app.post_purchase_return` relies on it.

### 10. Roles are unchanged, and enforced where they have always been enforced

Owner, admin, and manager post sales, record payments, and create or edit customers; every member,
viewers included, may read invoices, download the invoice and issue-note PDFs, and scan. The checks
exist three times on purpose: the UI hides what a viewer cannot do, `TenantAccessService.runAsMember`
rejects the request with `{ roles: CATALOG_WRITERS }`, and the definer function re-checks
`app.has_org_role(...)` before it touches a row. Hiding a button is not an authorization. No
permission table and no new permission names are introduced; the four membership roles are the
vocabulary the whole application already uses.

### 11. Names follow the repository, not the brief

Contracts for the new surface go in `packages/contracts/src/invoicing.ts` rather than into
`operations.ts`, which is already at the size the repository splits at; the API layer lives in
`apps/api/src/operations/` next to sales orders, with SQL in `*.query.ts` modules, and the PDFs in
`apps/api/src/documents/`. Routes keep the existing nesting:

```
GET    /organizations/:id/customers
POST   /organizations/:id/customers
PATCH  /organizations/:id/customers/:customerId
POST   /organizations/:id/customers/:customerId/activation
GET    /organizations/:id/sales-invoices
POST   /organizations/:id/sales-invoices
GET    /organizations/:id/sales-invoices/:salesInvoiceId
GET    /organizations/:id/sales-invoices/:salesInvoiceId/pdf
GET    /organizations/:id/sales-invoices/:salesInvoiceId/issue-note/pdf
POST   /organizations/:id/sales-invoices/:salesInvoiceId/payments
```

The vocabulary everywhere is facture / vente / bon de sortie / client / dépôt / sortie de stock.
Neither the schema, the contracts, the UI, nor the PDFs use "ticket", "receipt", "register", or
"cashier": `receipt` stays the name of the inbound stock movement it has always been.

## Consequences

- A counter sale is traceable end to end: invoice → order → `issue` movements, or invoice → device →
  `issued` event, with one `stock_operations` row behind it.
- `stock_operations.operation` gains `sales_invoice_create` and `sales_invoice_payment`;
  `app.document_kind` gains `sales_invoice`. No new `app.stock_reference_type` is needed — the
  movements of a counter sale are `outgoing_order` movements, so existing reports and exports
  already count them.
- The API's boot schema guard gains a probe for `app.create_sales_invoice(...)` so a deployment
  that runs the new code against an un-migrated database fails at start instead of on the first
  sale.
- Dashboard valuation stays correct without change: bulk quantity left `stock_balances` through the
  ledger, and sold devices stop being counted as in-stock devices.
- The migration must be pushed to the hosted project before the counter screen works there, as with
  every previous phase.
- Implemented and verified locally on 2026-11-03: 14 database tests, 3 concurrency races, 10 HTTP
  tests, 11 document tests (5 rendering, 6 model), and 14 domain tests (5 invoice rounding, 9 wedge),
  inside 362 Vitest; and the headed local-stack suite — 25 tests on desktop and mobile, which posts a
  sale from a scanner-shaped keystroke burst, sells a picked unit beside a ledger line, settles a
  balance in two instalments, and byte-checks the two PDFs it actually downloads. The run also
  surfaced and fixed a phone-layout defect that mis-centred every dialog on the counter.
  `docs/setup.md` (“Counter sale verification”) holds the gate output.
- The migration was applied to the hosted project on 2026-11-03 and the API boots there on this build:
  the guard verifies 14 objects, the four tables carry RLS with SELECT-only member policies, the two
  definer functions are `SECURITY DEFINER` with an empty `search_path` and no `anon` execute, and the
  tables are empty. One design assumption needed correcting against the live schema: the migration's
  `grant select` is not the write barrier there, because Supabase's schema-level default privileges
  give `anon` and `authenticated` every table privilege — as they already do for `sales_orders` and
  `stock_movements`. A rolled-back probe confirmed row security is what refuses a client write
  (`42501 new row violates row-level security policy`). The first signed-in counter sale was then
  posted there on the same day, and a read-only query reads the whole trail back: `FI-2026-0001`
  (paid, cash, 14.900 TND, one `CABLE-01` line, one payment row, buyer `Zahra Style`), its
  `SO-2026-0002` exit document confirmed and fulfilled in the same transaction, one `issue` ledger
  line, and one `sales_invoice_create` operation. Downloading those PDFs is what surfaced the
  totals-block layout defect: the rules were page-wide while the block they were ruling occupied only
  the right third. `drawRule` now takes a span and the totals block draws its own.
- Invoice PDFs are English today, like every other server-rendered artifact (ADR-0014 decision 4).
  That decision is superseded once documents must be French or Arabic: `pdf-lib` with the standard
  fonts cannot shape or order Arabic at all, so the agreed path is one HTML/CSS template per document
  rendered to PDF by a headless browser, fed by the same document models the renderers use now.
- Open business decisions, recorded rather than invented: the VAT rate(s) and whether the rate,
  `matricule fiscal`, and a tax stamp (`timbre fiscal`) must appear on the printed invoice; the
  legally required invoice layout in Tunisia; whether anonymous walk-in sales are acceptable; the
  credit and refund policy, including which role may authorize a refund; whether a credit note must
  be a numbered document of its own; and whether an invoice number must be continuous across a year
  boundary.
