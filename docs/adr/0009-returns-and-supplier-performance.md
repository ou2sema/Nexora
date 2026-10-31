# ADR-0009 — Returns and supplier performance

- **Status:** accepted
- **Date:** 2026-10-31
- **Deciders:** product owner, engineering

## Context

Phase 6 introduced suppliers and both order directions. What it cannot express yet is the
reverse movement: goods going back to a supplier after receipt, and customer goods coming back
into stock after fulfilment. Without returns, stock can only be corrected through generic
adjustments, which lose the commercial link to the order and make supplier quality invisible.
Phase 7 adds returns and a supplier performance report while keeping the Phase 6 guarantees:
one document per transaction, one idempotency key per transition, and every quantity change
through the ledger helpers.

## Decisions

### 1. Returns are their own documents, linked to an order line

`purchase_returns` reference a `purchase_order`, `sales_returns` reference a `sales_order`.
Each line points at the source order line rather than at a product, so a return can never
exceed what was actually received or fulfilled:

- purchase return quantity ≤ `quantity_received` − quantity already returned (posted);
- sales return quantity ≤ `quantity` of a `fulfilled` line − quantity already returned (posted).

Purchasing a return against an order that is not `partially_received`/`received`, selling one
against an order that is not `fulfilled`, or returning a line that is not complete is rejected
by the RPC. Returns live in the source warehouse/location; moves between locations are a
stock transfer, not a return.

Statuses are `draft → posted`, plus `cancelled` from `draft`. Posting is irreversible and is the
only transition that touches stock. A draft can be cancelled, and cancelling a draft releases
its serialized device selection so those devices can be returned later.

### 2. Posting uses the ledger with dedicated reference types

Posting a purchase return posts an `issue` movement with
`reference_type = 'purchase_return'`; posting a sales return posts a `receipt` with
`reference_type = 'sales_return'`. Both go through `app.operations_apply_stock`, so the
negative-stock and reservation protections still apply: a return cannot consume stock that a
confirmed outgoing order holds. Reference types and document kinds were extended rather than
reusing the order values, so reports and reconciliation can separate sales, purchases, and
their reversals without joining the document tables.

### 3. Serialized purchase returns dispose the device

A serialized product is never in the ledger (ADR-0005), so a serialized return line carries
device ids instead of only a quantity. At creation the devices must be `in_stock`, belong to
the line's product, and not already selected by another live return. Posting moves each device
to `disposed` and appends a `disposed` event carrying the return number, with no quantity
movement — the same symmetry as receiving, which registers devices without a receipt.

Outgoing orders only sell quantity-tracked products, so sales returns are quantity-only; there
is no device to restock.

### 4. Every transition is one RPC claiming one idempotency key

`app.create_purchase_return`, `app.post_purchase_return`, `app.cancel_purchase_return` and the
three sales-return equivalents each claim a single `stock_operations` key and store their
result, exactly like the order transitions. Application roles keep `select` only; writes happen
through the definer functions, which check membership roles and tenant ownership first.

### 5. Supplier performance is a read-only report, not a stored score

`GET .../reports/supplier-performance` aggregates inside the caller's RLS transaction over a
window (default: last 90 days):

- purchase orders created in the window, ordered and received value in millimes;
- on-time rate over fully received orders that have an `expected_on` date
  (`received_at::date <= expected_on`);
- average lead time in days for orders with both `ordered_at` and `received_at`;
- returned quantity and return rate (posted purchase-return quantity ÷ received quantity).

Metrics are computed on demand so they always match the documents and the ledger; nothing is
cached or denormalized.

## Consequences

- A return is fully traceable: document → source order line → ledger movements or device
  events.
- Over-return is impossible: the remaining quantity is checked when a return is created and
  re-checked when it is posted, with the source order line locked so concurrent postings
  serialise and each sees the other's committed rows.
- Draft returns hold a device selection until cancelled or posted, which prevents two draft
  returns from claiming the same serialized unit.
- Editing drafts, partial cancellations, and supplier credit-note amounts are not modelled yet.
