# ADR-0013 — Operational hardening

- **Status:** accepted
- **Date:** 2026-10-31
- **Deciders:** product owner, engineering

## Context

By Phase 10 the product covers tenancy, stock, devices, barcodes, reporting, orders,
returns, documents, team access, and platform administration. The remaining risks were
operational rather than functional:

1. Platform-admin actions left no trace beyond the rows they changed.
2. Deploying the API before applying a migration produced a runtime `500` (the Phase 10
   `/me` incident) instead of a clear startup failure.
3. The full local-stack Playwright suite existed but ran only by hand; CI ran the eight
   shell checks without a database.
4. Stock/ledger drift could only be found by opening one organization's reconciliation
   page; nothing swept every organization on a schedule.
5. Granting `is_platform_admin` was ad-hoc SQL with no audit record.
6. Every page loaded in the initial web bundle, even though routes are independent.

## Decisions

### 1. Operator action audit trail

`public.admin_audit_events` records platform-admin identity actions:
`organization_created`, `invitation_created`, `invitation_revoked`,
`member_role_changed`, `member_removed`, and `platform_admin_granted` (operator script).
Rows store actor, organization, target user/email, a JSONB detail, and a timestamp.

Writes happen inside the same transaction as the action through
`app.log_admin_action`, a security-definer helper that no-ops unless the caller is a
platform admin. Organization owners, admins, and managers keep their powers and are
deliberately not logged, so the table answers “what did the deployment operator do across
tenants” rather than duplicating per-organization history. The table is RLS-protected:
only platform admins may read it, and only the definer helper (or the operator script
holding database administration rights) can write.

The helper is redefined in `20261031180000_admin_audit.sql`; the five Phase 10 RPCs are
replaced with equivalent bodies that log after the state change succeeds.

### 2. Capability probe at API boot

`apps/api/src/database/schema-guard.ts` probes the schema with `to_regclass` and
`to_regprocedure` for the objects the API calls, then runs before `app.listen`. A reachable
database missing any object stops the process with a message naming the missing objects
and pointing at `supabase/migrations`. Probing by name (rather than reading
`supabase_migrations`) also works on the local stack, which applies raw SQL.

An unreachable database only logs a warning and lets the API start, so the shell E2E job
(no Postgres) and health checks still work; requests fail as they did before. Server-side
errors other than connection failures are treated as schema problems and stop boot.

### 3. Full local-stack suite in CI

A third CI job builds the workspaces and runs `playwright.local-stack.config.ts`, which
boots embedded PostgreSQL, a fake Supabase auth/JWKS server, the built API, and Vite. It
needs no hosted credentials. The existing shell job stays as a fast smoke test. The local
stack's `reuseExistingServer` is disabled when `CI` is set so a stale process cannot serve
an old build.

### 4. Integrity CLI and operator grant script

`apps/api/scripts/integrity-check.mjs` (exposed as `npm run check:integrity`) connects with
`DATABASE_URL`, iterates organizations, impersonates an owner/admin's JWT claims, and calls
`app.stock_reconciliation`. It prints `OK`/`DRIFT`/`SKIP` per organization and exits `1`
on any drift or error, so cron or a release checklist can alert on it. It is read-only.

`apps/api/scripts/grant-platform-admin.mjs` grants the flag by email, is idempotent, and
writes a `platform_admin_granted` audit row with a `null` actor (the operator acts outside
the application). It requires database administration rights; there is still no HTTP grant
path.

### 5. Route-level code splitting

`apps/web/src/app/router.tsx` keeps only the shell eager and loads every page through the
data router's `lazy`, so each route becomes its own chunk. Sign-in remains a separate lazy
route outside the shell.

### 6. Restore drill is a documented runbook, not an automated test

Backups are a Supabase platform capability; testing them requires a scratch project and
the owner's dashboard access. `docs/runbooks/restore-drill.md` defines the drill against a
throwaway project, with acceptance criteria and a record template. It has not been
executed.

## Consequences

- The operator can answer “who changed what, when, and in which organization” from
  `/admin` or the `admin_audit_events` table.
- A schema/API version mismatch fails at boot with an actionable message instead of
  surfacing as a random endpoint error.
- Every pull request exercises the real API, real RLS, and real UI flows on the local
  stack.
- Drift in any organization is detectable by a single command and can be scheduled.
- The initial web payload no longer contains every page; navigation fetches one chunk.
- The Phase 11 migration must be applied to a hosted project before deploying this API
  version. The schema guard enforces that order.
- Out of scope: email delivery for invitations, automated backup restore verification,
  per-tenant audit retention policies, and audit-log export.
