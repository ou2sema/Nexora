# ADR-0007 — Reporting, exports, and authorized realtime

- **Status:** accepted
- **Date:** 2026-10-30
- **Deciders:** product owner, engineering

## Context

Phase 5 turns the ledger into an operational dashboard: totals, valuation, movement trends,
per-warehouse breakdowns, low-stock alerts, CSV exports, and updates that follow committed
changes. Gate E requires that **reports match independently calculated expected totals and
update following committed changes**. The reports must remain tenant-scoped and must not
become a second source of truth that can drift from the ledger.

## Decisions

### 1. Reports aggregate the existing read models at request time

`GET /organizations/:id/reports/overview` runs inside the caller-scoped transaction used by
every other tenant query, so RLS applies to `stock_levels`, `stock_movements`,
`stock_reservations` and `devices`. There are no materialized report tables and no scheduled
aggregation job that could silently hold stale numbers. The dashboard therefore always shows
a consistent snapshot of the committed ledger, and the API test suite recomputes every total
from the raw tables in a separate query before comparing (Gate E).

The overview response contains:

- **totals** — ledger `on_hand`, `reserved`, `available`, stocked products, stock lines,
  warehouses, and serialized units whose device status is `in_stock`;
- **valuation** — cost and retail value in integer millimes, contributing zero for products
  without both prices and reporting how many stocked products are priced incompletely;
- **movements** — count, received, issued, adjusted, and net quantities inside the window;
- **series** — one UTC day per point from `from` to `to`, computed with `generate_series` so
  days without movements still appear as zero;
- **warehouses** — per-warehouse quantities, serialized counts, and valuation.

Serialized products intentionally contribute to `serializedInStock` and device valuation
rather than to quantity totals, because ADR-0005 keeps their identity in `devices` and
excludes them from quantity postings. Combining the two into one "units" number would imply
that a device can be issued as a quantity, which the ledger does not allow.

### 2. Filters are explicit and bounded

`warehouseId` and `categoryId` narrow every part of the overview: stock totals, serialized
counts, movement aggregates, the series, and the warehouse table. The category filter is an
exact match on `products.category_id`; it does not expand to child categories, so a filter's
meaning is visible in one query rather than hidden in a recursive tree walk. The movement
window defaults to the last 30 days, the end defaults to "now" on every request (so a
rolling range never goes stale), and an explicit window may not exceed 366 days. A reversed
window is a validation error.

### 3. Low stock compares availability to a per-product threshold

`GET /organizations/:id/reports/low-stock` lists active products with `reorder_threshold > 0`
whose available quantity is below the threshold, ordered by largest shortfall. For ledger
products, availability is `on_hand - reserved` aggregated across the selected warehouse (or
all warehouses). For serialized products, availability is the number of devices with status
`in_stock`; the threshold is compared against that count. Products with no stock rows still
appear, because a threshold is a signal that the product should be on hand.

The same endpoint feeds the dashboard list, the top-bar bell badge, and the low-stock count.
It is readable by every member, including viewers.

### 4. Exports are streamed CSV with a hard row cap

`GET .../reports/exports/stock-levels.csv` and `.../movements.csv` return
`text/csv; charset=utf-8` with a dated `Content-Disposition` filename. CSV fields are quoted
when they contain a comma, quote, or line break. Exports ignore pagination but stop at
50,000 rows; a larger result set returns `422 export_too_large` instead of silently
truncating, because a partial inventory export is worse than no export. The browser fetches
the file with the bearer token and saves the blob, so credentials never appear in a URL.

### 5. Realtime is authorization-preserving, with polling as a backstop

The dashboard subscribes to `postgres_changes` on `stock_balances`, `stock_movements`,
`stock_reservations`, and `devices`, filtered by `organization_id`. Supabase Realtime
evaluates the caller's RLS policies, so the organization filter is a convenience and RLS is
the actual boundary. The migration adds those tables to the `supabase_realtime` publication
only when the publication exists, which keeps local PGlite test databases applicable.

A change triggers a debounced invalidation of the dashboard's report queries; the dashboard
does not patch numbers from the event payload. Aggregates must be recomputed by the API, not
assembled from deltas in the browser. Polling runs every 30 seconds **regardless of the
socket state**: a channel reports `SUBSCRIBED` even when its tables are absent from the
publication, and hosted verification showed the dashboard staying stale under that
condition. Realtime is therefore an optimization, not a correctness dependency.

## Consequences

- Reporting code has no write path and no cached totals, so a report cannot drift from the
  ledger; a missing index or slow query is a performance concern, not a correctness one.
- The exact-category filter is simpler to reason about and test, but users who expect a
  parent category to include children must select each category.
- The 50,000-row cap bounds memory and response time at the cost of requiring narrower
  filters for very large tenants.
- Live-update verification requires the hosted publication migration; until it is applied,
  the 30-second poll is the visible refresh path on hosted. The poll was verified hosted by
  posting a receipt through the API and watching the open dashboard move from 14 to 15 units
  and 8 to 9 movements without a reload. Event delivery itself remains unverified hosted.
  This is stated explicitly in the setup notes rather than hidden.
- Phase 6 can build notifications and scheduled reports on the same aggregates without
  changing the ledger or the report endpoints.
