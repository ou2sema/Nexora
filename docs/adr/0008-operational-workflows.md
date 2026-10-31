# ADR-0008 — Suppliers, purchase orders, and outgoing orders

- **Status:** accepted
- **Date:** 2026-10-30
- **Deciders:** product owner, engineering

## Context

Phase 6 adds operational workflows on top of the ledger: suppliers, purchase orders (inbound)
and outgoing orders (outbound). The ledger remains the only source of truth for quantities, and
every workflow must be idempotent, tenant-scoped, and safe under concurrency. Gate A still
applies: an order must never bypass the negative-stock and reservation protections that single
postings already enforce.

## Decisions

### 1. Orders are documents; stock only moves through ledger helpers

Suppliers, purchase orders, and outgoing orders are stored rows with explicit lifecycles, but
they never carry authoritative quantities. A purchase order records what was ordered and how
much has been received; the receipt writes `receipt` ledger movements with
`reference_type = 'purchase_order'` and `reference_id = <order>`. Fulfilling an outgoing order
writes `issue` movements with `reference_type = 'outgoing_order'`. Cancelling or partially
receiving changes only the document, never history.

Statuses:

- purchase order: `draft → ordered → partially_received → received`, plus `cancelled` from
  `draft`/`ordered` while nothing has been received;
- outgoing order: `draft → confirmed` (stock reserved) `→ fulfilled` (stock issued), plus
  `cancelled` from `draft`/`confirmed`.

### 2. All lifecycle transitions are single SECURITY DEFINER RPCs

Creating a document with lines, ordering it, receiving it, confirming, fulfilling, and
cancelling each run as one transaction with `claim_stock_operation`, so a retried
`Idempotency-Key` returns the stored result and a different payload conflicts. Application
roles have `select` on the document tables and no `insert`/`update` grant; documents can only
be written through the RPCs, which validate role, status, quantities, and references.

Two internal helpers (`app.operations_apply_stock`, `app.operations_apply_reservation`) mirror
the rules of `app.post_stock_movement` and `app.reserve_stock`:

- stock is locked with `app.lock_stock_balance` before any check;
- an issue may not push on-hand below zero, nor available below zero;
- issuing against a reservation verifies the reservation matches product, warehouse, location,
  and quantity, then marks it `fulfilled`;
- reservations may not exceed available stock.

They exist because the public posting functions claim their own idempotency keys, and an order
must claim exactly one key for the whole document, not one per line. Both helpers revoke
`execute` from application roles so they cannot be called directly.

### 3. Numbering is per organization and per year

`app.next_document_number` keeps a `document_sequences` row per organization, kind, and year
(primary key `organization_id, kind, year`) and returns `1, 2, …`. Numbers are formatted as
`PO-2026-0001` / `SO-2026-0001`, unique per organization. The upsert takes a row lock, so two
concurrent creates cannot receive the same number.

### 4. Receiving serialized products registers devices

A purchase-order line for a serialized product requires exactly one serial number per received
unit (`serials` array). Receipt inserts each device and its `registered` event inline, in-stock
at the line's destination location, with the order number as supplier reference, and does not
post a quantity movement, consistent with ADR-0005. It deliberately does not call
`app.register_device`, because that function claims its own idempotency key and a receipt must
claim exactly one key for the whole document. Non-serialized lines post a ledger receipt.
Over-receipt beyond the ordered quantity is rejected, as is receiving against a line that is
already complete.

Outgoing orders are quantity-only: serialized devices leave stock through the device lifecycle
(`sold`), not through an order line. A serialized product on an outgoing order is rejected at
creation, because an order cannot choose which physical unit is sold without a device-level
allocation model, which the brief does not require.

### 5. Confirm-then-fulfil makes overselling impossible

Confirming an outgoing order reserves every line at its source location in the same
transaction; if any line cannot be fully reserved the whole confirmation fails and the order
stays `draft`. Fulfilment issues each line against its reservation, so reserved stock cannot be
consumed by another writer. Cancelling a confirmed order releases its reservations. This keeps
the "available" number users see in the dashboard aligned with what an order can commit.

## Consequences

- Order documents and the ledger can be reconciled by `reference_type`/`reference_id`; a
  received line matches its receipt movements, and a fulfilled line matches its issue movements.
- Documents are not editable after creation. A mistake is cancelled and re-created, which keeps
  the audit trail simple and avoids partial-edit states.
- Serialized inbound receiving inserts devices inline during the receipt; bulk device import
  remains future work.
- Supplier deletion is not offered; suppliers are deactivated to preserve purchase history.
