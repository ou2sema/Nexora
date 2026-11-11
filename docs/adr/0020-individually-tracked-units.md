# ADR-0020 — Individually tracked units

- **Status:** accepted
- **Date:** 2026-11-11
- **Deciders:** product owner, engineering
- **Related:** ADR-0005 (stock ledger and device traceability), ADR-0006 (barcodes, scanning,
  labels, and inventory counts), ADR-0010 (purchasing documents)

## Context

A product barcode identifies a model, not a thing. Printing the same GTIN five times for five
received units gives the shelf no way to say _which_ unit was sold, moved, or lost. Serialized
products already solve this with `devices`, but that model carries electronics semantics —
`condition`, `warranty`, manufacturer serial and IMEI — and it owns the unit quantity instead
of the ledger. Products that need one identity per unit (laptops without an IMEI, bundled
kits, high-value tools, consigned goods) fit neither model: forcing them into `devices`
invites wrong statuses and mandatory fields, while leaving them as quantity stock loses the
unit.

The feature must also not break the two invariants the ledger already relies on: a unit is
counted once, and nothing crosses a tenant boundary.

## Decision

### 1. A third, generalized tracking mode — mutually exclusive with devices

`products.is_individually_tracked` is a separate opt-in from `is_serialized`, and the
`products_single_tracking_mode` check rejects a product that sets both. The modes mean:

| mode                      | quantity authority | unit identity             |
| ------------------------- | ------------------ | ------------------------- |
| ordinary (default)        | stock ledger       | none                      |
| `is_serialized`           | `devices`          | device serial/IMEI        |
| `is_individually_tracked` | stock ledger       | `tracked_items.unit_code` |

The flag is chosen when the product is created and is frozen afterwards; changing tracking
mode on a product that already has stock or history is a data migration, not a form toggle.
Untracked products behave exactly as before: same forms, same receipt, same scan card.

`tracked_items` deliberately borrows nothing electronics-specific. It carries an optional
`serial_number` and `imei` as free attributes the operator may supply at receipt, but neither
is required and neither is the identity — the identity is always the internal `unit_code`.
Statuses are lifecycle-level (`in_stock`, `sold`, `returned`, `lost`), not device conditions.

### 2. The ledger remains the only quantity authority

The accounting model is: **N unit rows describe the N units the ledger already contains; they
do not add quantity.**

Receiving a tracked line runs inside `app.receive_purchase_order`, in one transaction:

1. validate the whole request (per-line quantity, optional serial array length),
2. insert one `tracked_items` row and one `received` event per unit,
3. post exactly **one** aggregate `receipt` movement for the line quantity via
   `app.operations_apply_stock`,
4. update the purchase-order line and order status.

So a five-unit receipt writes five `tracked_items` rows, five events, and **one** ledger
movement of `5`. Available stock, reservations, reports, and counts keep reading the ledger
and never sum `tracked_items`; a query that wanted "units on the shelf" reads the ledger, and
a query that wanted "which units" reads `tracked_items`. Because the unit rows and the
movement commit or roll back together, the two views cannot disagree.

`tracked_item_events` are append-only (`tracked_item_events_immutable`), matching
`device_events`: unit history is evidence, not a cache.

### 3. Unit codes are minted in the database, opaque and collision-resistant

`unit_code` is `NX` followed by 20 uppercase hex characters — 80 random bits drawn from
`gen_random_uuid()`. The format is checked by the column constraint
`tracked_items_unit_code_check` (`^NX[A-F0-9]{20}$`) and uniqueness by
`tracked_items_org_unit_code_key` `(organization_id, unit_code)`.

- **Not a GTIN.** The code is never an EAN/UPC and never in the GS1 `2` in-store range used
  for generated _product_ barcodes. Supplying a unit identity never implies a GS1 licence.
  `NX…` is alphanumeric, fixed-length, and encodes cleanly as Code 128 or QR.
- **Server-side only.** No client proposes a code. The insert loop retries on
  `unique_violation`, so an 80-bit collision costs one redraw rather than a failed receipt.
- **Opaque.** The code carries no product, date, or sequence information; labels are the only
  place it becomes human-meaningful, alongside the printed product name and SKU.

Optional `serial_number` / `imei` stay separate columns with their own validation. They are
searchable attributes of a unit, never the scanned key.

### 4. Receiving is atomic and idempotent, including the unit codes

`POST /purchase-orders/:id/receipts` already claims an `Idempotency-Key` through
`app.claim_stock_operation` before touching stock. The tracked branch adds no second key: the
claim covers unit creation too. The response — including the `trackedItems` array of
`{ id, productId, lineId, unitCode, serialNumber, imei }` — is stored on
`stock_operations.response`.

A retry after a lost response therefore returns the **same** unit codes with
`duplicate: true`. If the client retried with a new key, the purchase-order line would
already show the earlier quantity, and an over-receipt raises
`purchase_order_over_receipt`; the unit rows are never duplicated. A serial or qty mismatch
anywhere in the request raises before any unit is inserted, so a partial delivery of the
_request_ does not exist even though partial receipt of the _order_ does.

### 5. Scan resolves a unit before the shared code

`GET /organizations/:id/scan?code=` has one more tier at the top:

1. **tracked item** `unit_code` (case-insensitive),
2. serialized device serial number or IMEI,
3. product barcode (exact),
4. SKU (case-insensitive),
5. internal code (case-insensitive).

Each tier stops the lookup — a code can never silently resolve to a broader entity. The
`tracked_item` result carries the unit (status, warehouse/location, received date, purchase
order), its product summary, and its event history, so the console can show where this exact
unit is and what happened to it. The shared product barcode still resolves to
`kind: 'product'` with per-location totals; both results are needed and neither replaces the
other. Everything is scoped by `organization_id`; a unit code from another tenant returns
`404 scan_not_found`.

### 6. Labels print one sheet entry per unit

`POST /organizations/:id/labels` gained a third target kind, `{ kind: 'item', itemId, copies }`.
An item label encodes `unit_code` as Code 128 and prints the product name and SKU beside it,
so the same physical label identifies the unit and says what it is. After a receipt the
console offers **Print N unit labels** built from the receipt's own `trackedItems` — one per
unit, not copies of the shared barcode. Printing the product barcode remains a separate
action on the product card.

### 7. Tenant isolation and roles are unchanged in shape

`tracked_items` and `tracked_item_events` use the same composite tenant FKs
(`(organization_id, id)` → products, warehouses, `(organization_id, warehouse_id,
location_id)` → storage locations, `(organization_id, id)` → purchase orders and lines). RLS
grants `SELECT` to members via `app.is_org_member`; there is no write grant. All inserts happen
inside the `security definer` receipt function, which requires owner/admin/manager, exactly
like the other stock mutations. Viewers may scan and read unit history; they cannot receive.

### 8. Tracking-mode guards live in the database

- `products_single_tracking_mode` rejects serialized **and** tracked.
- `tracked_items_require_tracked_product` rejects a unit row for a product that did not opt in
  (`product_not_individually_tracked`), so no code path can create units for ordinary stock.
- The tracked branch rejects fractional quantities (`tracked_item_quantity_must_be_whole`):
  half a tracked unit would be a ledger quantity with no unit row.
- Serialized lines keep using `devices` and post no quantity movement; the branch order in
  `receive_purchase_order` guarantees a product never takes two paths.

## Consequences

- The API and UI depend on `supabase/migrations/20261111120000_tracked_items.sql`. It is
  verified locally (PGlite DB suite, API suite, Playwright) and must be pushed to the hosted
  project before tracked receipts work there.
- Reporting, counts, and stock screens still read the ledger; nothing sums `tracked_items` for
  quantity. A future "units on hand" report reads the unit table and is expected to equal the
  ledger for tracked products — a reconciliation check worth adding when such a report exists.
- Recording sales, moves, and losses _against_ a unit (beyond the `received` event written at
  receipt) is not part of this change. The status columns, events, and append-only trigger are
  in place for it; until then the unit's status is `in_stock` and its location matches the
  receipt.
- Product-level tracking mode is immutable after creation. Supporting a change later requires
  a migration that either backfills units for existing stock or refuses while stock exists;
  doing it silently from a form would break the invariant in §2.
- Labels print with the standard fonts; non-Latin product names still need an embedded font
  (ADR-0006, consequence 3).
