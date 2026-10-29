# ADR-0001 — Stack and platform boundaries

- **Status:** accepted
- **Date:** 2026-10-29
- **Deciders:** product owner, engineering

## Context

We are building a multi-tenant inventory platform for electronics. Correctness of stock
quantities under concurrency, traceability of serialized devices, and tenant isolation are
business invariants, not features. The platform must be delivered incrementally and the
architecture must make those invariants enforceable at the database layer.

The Phase 0 inspection established: greenfield repository, Node 26.13.0 LTS, Windows 11,
no Docker/WSL2, no local PostgreSQL, and a hosted Supabase project as the development
database.

## Decisions

### 1. Modular monolith in an npm workspace monorepo

`apps/api`, `apps/web`, `packages/{contracts,domain,config,testing}`, `supabase/`, `docs/`.
One lockfile, one CI pipeline. Module boundaries are enforced by folder structure and lint
rules, not by network calls.

### 2. TypeScript 6.0.3, not 7.x

`typescript@7.0.2` is the current `latest`, but `typescript-eslint@8.72.1` (latest)
declares `typescript >=4.8.4 <6.1.0`. Type-aware linting is a hard requirement, so the
whole repository pins 6.0.3. Fallback if NestJS decorator emit regresses: 5.9.3.

### 3. Drizzle ORM + `postgres`, SQL-first migrations

Prisma's `latest` dist-tag is a pre-release (`8.0.0-rc.28`) and its query layer hides the
`SET LOCAL` / row-lock / trigger behaviour the ledger depends on. Drizzle keeps SQL visible
while giving typed results. Migrations are plain SQL in `supabase/migrations`, applied with
the Supabase CLI: reviewable, portable to CI, and the single source of truth for schema,
RLS policies, and triggers.

### 4. Supabase Auth only

One identity provider. `auth.uid()` is native to RLS, so the database can enforce tenant
boundaries without a token-exchange layer. The API verifies JWTs against the project JWKS
(`jose`), and treats `memberships.role` in Postgres — not a JWT claim — as the authority for
authorization.

### 5. Supabase for all persistence; Firebase not used initially

PostgreSQL is canonical for every business fact. Storage uses Supabase Storage private
buckets with prefix-scoped policies, uploaded through the API so validation and audit are
centralized. Firebase Storage would require a second identity mechanism (Firebase Auth, or
backend-minted custom tokens) and a second failure domain for no capability this product
needs. Firestore is not used. If a concrete requirement appears later, the compliant shape
is API-proxied Firebase Admin SDK uploads with Postgres-authoritative metadata and an
outbox-driven cleanup — to be recorded in a new ADR.

### 6. `nestjs-zod` rejected

`nestjs-zod@5.5.0` peers `@nestjs/common ^10 || ^11`, incompatible with NestJS 12. Request
validation uses a project-owned Zod pipe over `packages/contracts`; the OpenAPI document is
generated from the same schemas with `@asteasolutions/zod-to-openapi`.

### 7. Two database roles

`app_api` (non-owner, subject to RLS, switched per transaction to `authenticated` with JWT
claims) serves every request. `app_system` (BYPASSRLS) exists only for the outbox worker and
reconciliation jobs and is unreachable from HTTP handlers.

## Consequences

- One deployable API and one static SPA; operability stays simple.
- Inventory invariants are enforced by triggers, constraints, and transactions — testable
  against a real PostgreSQL instance.
- Local Supabase stack is unavailable on this machine; integration tests run against a
  Supabase-compatible PostgreSQL with an `auth` shim, plus a smoke suite against the hosted
  project to catch drift.
- TypeScript 7 adoption is deferred until the lint toolchain supports it.
