# ADR-0003 — Tenancy model, RLS, and database test strategy

- **Status:** accepted
- **Date:** 2026-10-29
- **Deciders:** product owner, engineering

## Context

Phase 2 introduces organizations, memberships, roles, the product catalog, warehouses, and
storage locations. Gate C requires automated proof that one organization cannot read or
mutate another's data. The machine has no local PostgreSQL, no Docker, and no WSL2, and the
hosted Supabase project is not yet provisioned, so the isolation tests must run somewhere
real without secrets.

## Decisions

### 1. Tenant-owned tables in `public`, helpers in `app`

Business tables live in `public` for Supabase tooling. Authorization helpers live in schema
`app`, which PostgREST does not expose: `app.current_user_id()`, `app.is_org_member(uuid)`,
`app.has_org_role(uuid, app.member_role[])`, `app.create_organization(text, text)`.

### 2. Identity comes from `request.jwt.claims`, not `auth.uid()`

`app.current_user_id()` reads `current_setting('request.jwt.claims') ->> 'sub'`, the same
transaction-local setting PostgREST uses. The API sets it per transaction after verifying the
JWT. Using our own helper keeps policies portable to the test harness and avoids hard-coding a
Supabase-only function into every policy, while remaining compatible with direct PostgREST
access.

### 3. Membership is the only source of authorization

```
owner   > admin > manager > viewer
owner/admin    manage the organization and memberships
owner/admin/manager  write catalog, warehouses, locations
viewer         read only
```

Roles live in `memberships.role`, never in JWT claims, so revocation takes effect on the next
request without token rotation.

### 4. Organization creation is a definer function, not an insert policy

RLS cannot express "insert an organization and make the caller its owner" because the caller is
not a member yet. `app.create_organization(name, slug)` is `SECURITY DEFINER`, requires an
authenticated subject, and inserts the organization plus its first owner membership in one
transaction. There is deliberately no insert policy and no insert grant on `organizations`.

### 5. A tenant-consistent schema

Every catalog row carries `organization_id`. Cross-tenant references are blocked in the
schema, not only by policy:

- `unique (organization_id, id)` on parent tables enables composite foreign keys
- `foreign key (organization_id, parent_id) references categories (organization_id, id)`
  makes a category in A structurally unable to point at a category in B
- `on delete set null (category_id)` (PostgreSQL 15+) clears only the nullable reference
  column, never `organization_id`
- uniqueness is per tenant: SKU, barcode, internal code, warehouse code, and location code
- category cycles are rejected by a trigger, with a depth ceiling of 100

### 6. Last owner is protected by a trigger

Deleting or demoting the final owner of an organization raises
`organization_requires_owner` (SQLSTATE 23514). RLS cannot see aggregate state, so this is a
row trigger on `memberships`.

### 7. RLS tests run on PGlite, not mocks

`@electric-sql/pglite` is PostgreSQL compiled to WASM, executed in-process by Vitest. The
harness creates an `auth` shim (`auth.users` plus the `authenticated` role), applies every
migration in `supabase/migrations` in filename order, then runs queries as `authenticated`
with claims set per transaction. This exercises real policies, grants, triggers, composite
foreign keys, and role switching on every `npm run test` and in CI, without Docker or secrets.

### 8. Owner bypass is intentional; request path is not the owner

Migrations create tables as the project owner. `SECURITY DEFINER` helpers need that owner
bypass to avoid recursive policy evaluation on `memberships`. Requests never run as the owner:
the API switches to `authenticated` for every transaction, and the future `app_system` role is
reserved for outbox and reconciliation jobs that cannot be reached from HTTP handlers.

## Consequences

- Cross-tenant access fails at the database even if an application check is forgotten.
- Every new tenant-owned table must carry `organization_id`, enable RLS, define policies, and
  grant privileges to `authenticated`; the isolation test suite is the checklist.
- PGlite is not byte-identical to hosted Supabase (extensions, GoTrue, PostgREST). Migrations
  avoid non-core extensions, and Gate C still requires a smoke suite against the hosted project
  before it can be called complete.
- JWT verification, org context, and API endpoints are Phase 2.2; this increment ends at the
  schema and its isolation proof.
- Barcodes are currently validated by shape (8–14 digits) in the database; GS1 check digits
  are enforced by the API through `packages/domain` in Phase 4.
