# Mystock

Inventory management platform for electronics and technology products: multi-warehouse
stock, an immutable stock ledger, serialized-device traceability, barcode workflows,
and organization-scoped reporting.

> Status: Phase 1 (foundation). Nothing is production-ready yet.

## Stack

| Area     | Choice                                                                 |
| -------- | ---------------------------------------------------------------------- |
| Frontend | React 19 + TypeScript, Vite 8, Tailwind CSS 4, shadcn-style primitives |
| Backend  | NestJS 12 REST API, Zod validation, OpenAPI                            |
| Data     | Supabase PostgreSQL (RLS), Supabase Auth, Realtime, Storage            |
| ORM      | Drizzle + `postgres`, SQL-first migrations in `supabase/`              |
| Tests    | Vitest, Playwright, Allure                                             |

Architecture decisions live in [`docs/adr/`](docs/adr/). The Phase 0 assessment is summarized in
[`docs/adr/0001-stack-and-platform-boundaries.md`](docs/adr/0001-stack-and-platform-boundaries.md).

## Layout

```
apps/api        NestJS API
apps/web        React SPA
packages/       contracts (Zod), domain rules, config, testing helpers
supabase/       migrations, seeds, RLS tests
docs/           ADRs, diagrams, runbooks
```

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

| Script                 | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `npm run lint`         | ESLint across the workspace             |
| `npm run format`       | Prettier write                          |
| `npm run format:check` | Prettier check without writing          |
| `npm run typecheck`    | TypeScript project checks per workspace |
| `npm run test`         | Unit/integration tests per workspace    |
| `npm run test:e2e`     | Playwright end-to-end suite             |
| `npm run build`        | Build every workspace package           |
