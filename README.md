# Mystock

Inventory management platform for electronics and technology products: multi-warehouse
stock, an immutable stock ledger, serialized-device traceability, barcode workflows,
and organization-scoped reporting.

> Status: Phase 3 (inventory integrity) implemented and verified locally. Phase 2 is verified
> against the hosted project: schema, RLS, demo seed, sign-in token → API → tenant-scoped
> queries. Phase 3 adds the immutable stock ledger, atomic posting functions, balance
> projections, reservations, serialized-device traceability, idempotent mutations, and
> reconciliation repair, with a real multi-connection PostgreSQL concurrency suite. The Phase 3
> migrations are written and tested but **not yet pushed to the hosted database**. Nothing is
> production-ready yet.

## Stack

| Area      | Choice                                                                   |
| --------- | ------------------------------------------------------------------------ |
| Frontend  | React 19 + TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, RHF + Zod |
| Backend   | NestJS 12 REST API, Zod validation, JWKS-verified Supabase JWTs          |
| Data      | Supabase PostgreSQL (RLS), Supabase Auth, Realtime, Storage              |
| ORM       | Drizzle + `postgres`, SQL-first migrations in `supabase/`                |
| Tests     | Vitest (PGlite + embedded PostgreSQL), Playwright, Allure                |
| Money     | TND only, integer millimes, `formatTnd` (see ADR-0002)                   |
| Interface | English only (see ADR-0002)                                              |

Architecture decisions live in [`docs/adr/`](docs/adr/). The Phase 0 assessment is summarized in
[`docs/adr/0001-stack-and-platform-boundaries.md`](docs/adr/0001-stack-and-platform-boundaries.md).
Authentication, tenant-scoped data access, and the catalog API are specified in
[ADR-0004](docs/adr/0004-api-auth-and-tenant-data-access.md). The ledger, reservations,
idempotency, and device traceability are specified in
[ADR-0005](docs/adr/0005-stock-ledger-and-device-traceability.md).

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

| Method | Path                                                                  | Role required          |
| ------ | --------------------------------------------------------------------- | ---------------------- |
| GET    | `/api/v1/me`                                                          | any authenticated user |
| POST   | `/api/v1/organizations`                                               | any authenticated user |
| GET    | `/api/v1/organizations/:id/products`                                  | any member             |
| POST   | `/api/v1/organizations/:id/products`                                  | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/products/:productId`                       | any member             |
| PATCH  | `/api/v1/organizations/:id/products/:productId`                       | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/categories`                                | any member             |
| POST   | `/api/v1/organizations/:id/categories`                                | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/brands`                                    | any member             |
| POST   | `/api/v1/organizations/:id/brands`                                    | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/warehouses`                                | any member             |
| POST   | `/api/v1/organizations/:id/warehouses`                                | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/warehouses/:warehouseId/locations`         | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/stock-levels`                              | any member             |
| GET    | `/api/v1/organizations/:id/stock-levels/summary`                      | any member             |
| GET    | `/api/v1/organizations/:id/stock-movements`                           | any member             |
| POST   | `/api/v1/organizations/:id/stock-movements`                           | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/stock-transfers`                           | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/stock-reservations`                        | any member             |
| POST   | `/api/v1/organizations/:id/stock-reservations`                        | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/stock-reservations/:reservationId/release` | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/stock-reconciliation`                      | owner, admin           |
| POST   | `/api/v1/organizations/:id/stock-reconciliation/repair`               | owner, admin           |
| GET    | `/api/v1/organizations/:id/devices`                                   | any member             |
| POST   | `/api/v1/organizations/:id/devices`                                   | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/devices/:deviceId`                         | any member             |
| GET    | `/api/v1/organizations/:id/devices/:deviceId/events`                  | any member             |
| POST   | `/api/v1/organizations/:id/devices/:deviceId/status`                  | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/devices/:deviceId/location`                | owner, admin, manager  |

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
