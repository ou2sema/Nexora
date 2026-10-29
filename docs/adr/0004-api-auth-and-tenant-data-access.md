# ADR-0004 — API authentication, tenant-scoped data access, and catalog endpoints

- **Status:** accepted
- **Date:** 2026-10-29
- **Deciders:** product owner, engineering

## Context

Phase 2.2 turns the schema from ADR-0003 into an HTTP surface: an authenticated API, a
sign-in gate, organization creation, and catalog, warehouse, and location endpoints. Two
constraints shape the design:

- RLS must remain the authority. Application checks are a usability layer, never the only
  guard.
- The hosted project's database password is still unavailable to the build environment, so
  every automated test must run without hosted credentials while exercising real policies.

## Decisions

### 1. JWTs are verified at the edge through the project JWKS

The API validates every bearer token with `jose` against
`<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (ES256 or RS256), checking issuer, audience,
and a `sub` claim. No shared JWT secret is stored; key rotation is handled by the JWKS
cache (5-minute timeout, 30-second cooldown, 10-minute max age). A forged, expired,
wrong-audience, or malformed token returns `401 unauthenticated` with the standard error
envelope.

The hosted project publishes an ES256 key, so the API never needs the legacy JWT secret.

### 2. Every data query runs in a tenant transaction that switches role

`TenantDatabase.asUser(userId, fn)` opens a transaction, executes `set local role
authenticated`, and sets `request.jwt.claims` to `{"sub": userId, "role":
"authenticated"}`. The same transaction then runs the handler's queries. This mirrors what
PostgREST does for direct Supabase clients and means:

- RLS policies evaluate for the real user even though the connection uses the admin
  (migration) role.
- `set local` makes the role and claims transaction-scoped, so pooled connections cannot
  leak identity between requests.
- There is no code path where a request runs as the table owner.

### 3. Membership is checked before work starts; RLS stays the backstop

`TenantAccessService.runAsMember(userId, organizationId, action, { roles })` reads the
membership inside the transaction. Missing membership returns `404 organization_not_found`
(no existence leak); insufficient role returns `403 forbidden`. Catalog writes require
`owner`, `admin`, or `manager`; every member may read. The pre-check produces stable HTTP
semantics and friendly messages; the RLS policies remain the enforcement that a forgotten
check cannot bypass.

### 4. SQL migrations stay the source of truth; Drizzle is typed access only

`supabase/migrations/*.sql` is authoritative. Drizzle tables in
`apps/api/src/database/schema.ts` are hand-maintained to match it, and Drizzle generates
none of the schema DDL. This keeps migration review and RLS review in one place instead of
two competing histories. The cost is drift risk, which the PGlite integration suite
catches on every run because it applies the SQL migrations and then exercises the Drizzle
queries against them.

### 5. Database errors map centrally to the API envelope

The exception filter inspects the PostgreSQL `code` on the exception or its `cause` chain
(Drizzle wraps driver errors) and maps SQLSTATEs: `23505` → `409 conflict`, `23503` →
`400 invalid_reference`, `23514` → `400 constraint_violation` (including
`category_cycle` and `organization_requires_owner`), `42501` → `403`, `28000` → `401`.
Constraint names are echoed in `details`, raw database messages are not.

Every response carries `x-request-id`; error bodies repeat it as `error.requestId`.

### 6. Organization context is client state, authorization is not

The web app stores the selected organization id in `localStorage` and sends it in the URL
of every request. The server re-validates membership on each request, so a tampered value
yields `404`, never elevated access. On sign-out the selection is ignored because queries
require a token.

### 7. The browser consumes shared packages from source

`@mystock/contracts` and `@mystock/domain` compile to CommonJS for the NestJS API. Vite
aliases both packages to their TypeScript entry points, so dev and build consume real ESM
with working named exports; the earlier dev-only failure ("does not provide an export named
`toMinorUnits`") cannot recur through a stale `dist`.

### 8. Tests run against real PostgreSQL semantics and a real JWKS

`apps/api/test/api/test-app.ts` starts PGlite, applies the migrations, seeds two
organizations, generates a trusted ES256 key and an attacker key, and serves the trusted
public key from an ephemeral `http.server` as a JWKS. The Nest app is built with the same
modules as production, with only `DATABASE` and `SERVER_ENV` overridden. Tests cover:

- missing, malformed, expired, wrong-audience, and forged tokens
- `/me` membership payloads and empty-membership users
- organization creation, duplicate slugs, invalid names
- tenant-scoped catalog reads, cross-organization `404`, viewer writes `403`
- creation defaults, per-tenant uniqueness, pagination, search, and filters

## Consequences

- Any new endpoint must go through `runAsMember`; the isolation tests are the checklist.
- The API requires `DATABASE_URL` and `SUPABASE_URL`; it never uses the service-role key on
  the request path.
- The web shell now requires a Supabase session. Anonymous visitors are redirected to
  `/sign-in`, and unknown routes sit behind the same gate.
- Hosted verification is now split: the schema is applied to the hosted project and a
  cross-tenant smoke test passed there (member of organization B could not read, update,
  delete, or insert into organization A's data; the insert raised `42501`). The demo seed
  still needs the first signed-up user, so no hosted account has exercised `/me` or the
  catalog API end to end yet.
- Vite's single bundle is ~813 kB before code-splitting; route-level lazy loading is a
  later optimization, not a correctness issue.
