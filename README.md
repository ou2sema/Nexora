# Mystock

Inventory management platform for electronics and technology products: multi-warehouse
stock, an immutable stock ledger, serialized-device traceability, barcode workflows,
and organization-scoped reporting.

> Status: Phase 2 (identity, tenancy, catalog) implemented. Users sign in through Supabase,
> the API verifies JWTs and scopes every query to an organization, and the web app manages
> products, warehouses, locations, categories, and brands. Automated tests cover tenant
> isolation, authentication failures, and the management UI gate. The schema is applied to
> the hosted project and its RLS passed a cross-tenant smoke test; the demo seed still
> waits for the first signed-up user. Nothing is production-ready yet.

## Stack

| Area      | Choice                                                                   |
| --------- | ------------------------------------------------------------------------ |
| Frontend  | React 19 + TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, RHF + Zod |
| Backend   | NestJS 12 REST API, Zod validation, JWKS-verified Supabase JWTs          |
| Data      | Supabase PostgreSQL (RLS), Supabase Auth, Realtime, Storage              |
| ORM       | Drizzle + `postgres`, SQL-first migrations in `supabase/`                |
| Tests     | Vitest (PGlite integration), Playwright, Allure                          |
| Money     | TND only, integer millimes, `formatTnd` (see ADR-0002)                   |
| Interface | English only (see ADR-0002)                                              |

Architecture decisions live in [`docs/adr/`](docs/adr/). The Phase 0 assessment is summarized in
[`docs/adr/0001-stack-and-platform-boundaries.md`](docs/adr/0001-stack-and-platform-boundaries.md).
Authentication, tenant-scoped data access, and the catalog API are specified in
[ADR-0004](docs/adr/0004-api-auth-and-tenant-data-access.md).

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

| Method | Path                                                          | Role required          |
| ------ | ------------------------------------------------------------- | ---------------------- |
| GET    | `/api/v1/me`                                                  | any authenticated user |
| POST   | `/api/v1/organizations`                                       | any authenticated user |
| GET    | `/api/v1/organizations/:id/products`                          | any member             |
| POST   | `/api/v1/organizations/:id/products`                          | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/products/:productId`               | any member             |
| PATCH  | `/api/v1/organizations/:id/products/:productId`               | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/categories`                        | any member             |
| POST   | `/api/v1/organizations/:id/categories`                        | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/brands`                            | any member             |
| POST   | `/api/v1/organizations/:id/brands`                            | owner, admin, manager  |
| GET    | `/api/v1/organizations/:id/warehouses`                        | any member             |
| POST   | `/api/v1/organizations/:id/warehouses`                        | owner, admin, manager  |
| POST   | `/api/v1/organizations/:id/warehouses/:warehouseId/locations` | owner, admin, manager  |

Errors use `{ "error": { "code", "message", "details?", "requestId" } }` and repeat the
`x-request-id` response header. Database constraint failures map to `409` or `400`; an
unknown organization inside your tenant scope returns `404`, never `403`, to avoid leaking
existence.

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
