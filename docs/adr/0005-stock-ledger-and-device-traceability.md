# ADR-0005 — Immutable stock ledger, reservations, and device traceability

- **Status:** accepted
- **Date:** 2026-10-29
- **Deciders:** product owner, engineering

## Context

Phase 3 makes stock quantities trustworthy. Phase 2 stored catalog data but nothing that
moved inventory, so the system had no answer to "how many units are on hand, where, and
why". The phase must satisfy four gates:

- **Gate A — inventory correctness:** every quantity is explainable from history, and
  concurrent writers cannot oversell or corrupt balances.
- **Gate B — device traceability:** each serialized unit has one identity and a complete,
  tamper-evident lifecycle.
- **Gate C — tenant isolation:** stock and device rows remain scoped by organization under
  RLS, including inside database functions.
- **Gate D — failure recovery:** a projection can be rebuilt from history without editing
  history, and duplicate requests cannot double-post.

The database must carry most of this weight. Application-level checks alone cannot survive
concurrent requests, retries, or a process crash between two writes.

## Decisions

### 1. The ledger is the source of truth; balances are a rebuildable projection

`stock_movements` stores one immutable row per stock change: signed `quantity_delta`,
`on_hand_after`, product, warehouse, location, movement type, reason, optional reference,
transfer id, reservation id, actor, and timestamp. `stock_balances` holds one row per
`(organization, product, warehouse, location)` and exists for fast reads only.

The ledger is append-only at three levels: no `UPDATE` or `DELETE` grant for application
roles, a `before update or delete` trigger that raises `stock_ledger_is_immutable`, and a
reconciliation function that reports drift instead of rewriting history. Repairs replace
only the projection.

`storage_locations` gained `unique (organization_id, warehouse_id, id)` so a location can
never be paired with the wrong warehouse in a ledger line.

### 2. Every stock change goes through a SECURITY DEFINER function

Application roles can `SELECT` the ledger tables but cannot write them. Writes happen in
`app.post_stock_movement`, `app.post_stock_transfer`, `app.reserve_stock`,
`app.release_stock_reservation`, and `app.expire_stock_reservations`. Each function:

- is `security definer` with `set search_path = ''`, so every object is schema-qualified
  and a caller cannot shadow a table or helper;
- checks `app.has_org_role(organization, {owner,admin,manager})` before doing work;
- is revoked from `public` and granted only to `authenticated`;
- runs entirely inside the request transaction opened by `TenantDatabase`.

RLS still applies to the selects the functions perform around those checks; the explicit
role check produces a stable `42501 forbidden` even where a policy would silently return
zero rows.

### 3. Row locks serialize writers; transfers lock in deterministic order

`app.lock_stock_balance` inserts a zero balance if absent, then selects it
`FOR UPDATE`. Every posting path calls it before reading availability, so two concurrent
issues on the same line run one after the other and the second sees the first's result.
`on_hand >= 0` and `quantity_delta <> 0` remain table constraints, not just function checks.

A transfer locks the source and target lines in lexicographic `(warehouse, location)` order.
Opposing transfers therefore acquire locks in the same order and cannot deadlock; they simply
queue. The transfer writes `transfer_out` and `transfer_in` rows with a shared `transfer_id`
in one transaction, so a half-transfer is impossible.

### 4. Idempotency is transactional, fingerprinted, and shared with device writes

`stock_operations` has a unique `(organization_id, idempotency_key)`. A mutation first calls
`app.claim_stock_operation`, which inserts the key or, on conflict, blocks on the unique
index until the first transaction commits. The stored row carries:

- the operation name,
- a SHA-256 fingerprint of the normalized request body,
- the JSON response of the successful attempt.

A retry with the same key and fingerprint returns the stored response with
`duplicate: true`. A reused key with a different fingerprint raises
`idempotency_key_conflict` (`23505`), which the API maps to
`409 idempotency_conflict`. If the transaction rolls back, the claim disappears with it, so
a failed request can be retried immediately. The API requires an `Idempotency-Key` header of
8–120 characters on every stock and device mutation.

### 5. Reservations hold availability, not quantity

`stock_reservations` separates order commitments from physical stock. A reservation never
changes `on_hand`; `available` is computed as `on_hand − sum(active reservations)` under the
balance lock. An issue or transfer that would dip below zero available raises
`stock_reserved`; one that would dip below zero on hand raises `insufficient_stock`.
Reservations move through `active → released | fulfilled | expired`, and an issue may name
an active reservation, in which case the quantities must match exactly and the reservation
is marked `fulfilled` in the same transaction.

`app.expire_stock_reservations` exists and is tested, but Phase 3 does not schedule it. Until
a scheduler is added, expired reservations must be released or expired explicitly.

### 6. Devices own identity; the ledger still owns quantity

`devices` stores one row per physical unit: serial number (case-insensitively unique per
organization), optional IMEI (digit-only, unique per organization when present), condition,
status, warehouse, location, warranty dates, supplier reference, and free-form attributes.
A trigger rejects devices whose product is not `is_serialized`, so a catalog mistake cannot
create a device on a bulk product.

Status changes follow a fixed graph (`in_stock → reserved/sold/in_repair/lost/disposed`,
`reserved → in_stock/sold/lost`, `sold → returned`, `returned → in_stock/in_repair/disposed`,
`in_repair → in_stock/lost/disposed`, `lost → in_stock/disposed`). Each transition appends a
`device_events` row with from/to status, from/to location, note, actor, and timestamp. The
event table is append-only by trigger and by grant, so the lifecycle cannot be rewritten.

Registering a device records identity and lifecycle only; it does not post a ledger receipt.
Operators receive stock separately. This keeps one authority per fact, at the cost of
requiring two deliberate actions when a serialized receipt arrives. A later phase can add a
combined "receive serialized units" workflow that calls both functions in one transaction.

### 7. Reconciliation compares projection to history and repairs only the projection

`app.stock_reconciliation` full-joins `stock_balances` against `sum(quantity_delta)` per line
and reports balance, ledger total, difference, and movement count. `app.repair_stock_balances`
scans differing rows and, unless `dryRun`, upserts the ledger total into the projection.
Both are restricted to owner and admin. The API exposes them at
`GET .../stock-reconciliation` and `POST .../stock-reconciliation/repair`.

### 8. Concurrency is proved on real PostgreSQL, not a single-connection shim

PGlite runs one connection, so it cannot demonstrate lock contention. Phase 3 adds
`embedded-postgres` as a dev dependency: the concurrency suite starts a temporary PostgreSQL
18 cluster, applies the same SQL migrations, and drives a 12-connection `pg` pool. It proves:

- two parallel issues cannot both succeed (one gets `insufficient_stock`);
- five parallel requests with one key produce one movement and four duplicate responses;
- ten opposing transfers finish with conserved totals and no deadlock;
- a reservation and an issue racing for the same units leave exactly one winner and
  `reserved <= on_hand`;
- reconciliation reports zero difference after all of the above.

The suite needs no Docker, no hosted credentials, and runs in `npm run test` on every push.

## Consequences

- New stock paths must call the existing RPCs or add a new `security definer` function with
  the same guard rails; direct table writes are impossible for application roles.
- `stock_operations` grows without bound. A retention job for keys older than the retry
  window is future work; deleting old rows is safe only after that window.
- The API and UI depend on the Phase 3 migrations. They are verified locally and are **not
  yet applied** to the hosted Supabase project, so hosted stock and device routes will fail
  until the migrations are pushed.
- Device quantity and ledger quantity are intentionally decoupled. Reports that compare
  "devices in stock" with "units on hand" will show differences when serialized receipts were
  not posted; the reconciliation view covers ledger-versus-projection drift only.
- Quantities are `numeric(18,4)` and validated to four decimal places at the API boundary.
  Money remains integer millimes and is unrelated to stock precision.
