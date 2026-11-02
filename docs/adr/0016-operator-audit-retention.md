# ADR-0016 — Operator audit retention

- **Status:** accepted
- **Date:** 2026-11-02
- **Deciders:** product owner, engineering

## Context

`public.admin_audit_events` (ADR-0013) is append-only: the five platform RPCs insert rows and
nothing ever deletes them. ADR-0013 explicitly left "per-tenant audit retention policies" out of
scope, and the repository-audit action plan put a retention policy on the pre-beta list. Without
one, the table grows for the life of the project while the `/admin` operator activity table only
ever reads the most recent `limit` rows.

Facts that shaped the design:

- The rows answer "what did the operator do across tenants". They are operational history, not a
  regulated record: no retention obligation is documented anywhere in this repository.
- The hosted project runs PostgreSQL 17.11 and **has `pg_cron` available (1.6.4) but not installed**
  (queried read-only on 2026-11-02: `pg_extension` lists `pg_stat_statements`, `pgcrypto`,
  `plpgsql`, `supabase_vault`, `uuid-ossp`; `cron.job` does not exist). In-cluster scheduling is
  therefore a platform change, not a migration detail.
- The API authenticates with user JWTs only and holds no administrative database role, so it cannot
  — and should not — be the caller of a destructive maintenance statement.
- Deleting a row is irreversible for the live database. Only a restored backup (see
  `docs/runbooks/restore-drill.md`) can bring an expired event back.

## Decisions

### 1. One retention window for the whole table

`app.prune_admin_audit_events(p_retention_days integer)` trims globally. Per-tenant windows were
rejected: `organization_id` on these rows labels whose tenant was touched, and a per-tenant policy
would fragment the cross-tenant answer without keeping the table smaller in aggregate.

### 2. The window is a required argument, clamped in the database

The SQL takes no default, so an operator states a policy every time instead of inheriting one by
accident. Values below 30 days or above 3650 raise `invalid_retention_window` (SQLSTATE `22023`):
under 30 days there is nothing left to investigate an incident with, and above 10 years is not a
retention window. The database is the authority; `prune-admin-audit.mjs` mirrors the same bounds so
a typo fails before it connects.

### 3. Owner-only execution, no HTTP surface

`create or replace function` grants `EXECUTE` to `PUBLIC`, so the migration revokes it from both
`public` and `authenticated`. The function is executable by the table owner — the role behind
`DATABASE_URL` in the operator scripts — and by nobody holding a user JWT. There is no route,
contract, or UI action that prunes, which keeps a destructive capability out of the request path
and leaves the platform-admin `SELECT` policy as the only application-facing access to the table.

### 4. Scheduling stays with the operator

`npm run prune:admin-audit --workspace @mystock/api` (180 days by default, `-- --retention-days=N`,
`-- --dry-run`) is designed for an external scheduler. It deliberately has no root-level npm alias:
an alias that shells out to the workspace swallows the appended arguments, so a root
`-- --dry-run` silently runs a real prune with the default window. That failure was reproduced while
wiring this up, which is why the documented form always names the workspace.

Enabling `pg_cron` inside the hosted project, or a CI schedule that stores the database credential as
an Actions secret, are both viable and both are platform decisions the owner executes; neither is
assumed here. `--dry-run` exists because the first run on a long-lived table is the riskiest one.

### 5. The prune is not recorded in the table it trims

The function returns the deleted count and the script prints the cutoff and the count; that log
line is the record. Writing an `audit_pruned` row into `admin_audit_events` would put the evidence
under the same window that deleted it, which is self-referential rather than auditable.

### 6. One statement, no batching

The delete runs as a single statement backed by `admin_audit_events_created_at_idx`. At the current
scale (thousands of rows at most) a chunked loop would add failure modes for no measurable gain.
Re-running is a no-op, so an interrupted first pass is retried rather than tuned.

## Consequences

- The audit trail now has a bounded lifetime, decided by the operator at run time. Events older than
  the window are gone from the live database and recoverable only from a backup restore — which is
  why the restore drill, not this policy, is the real data-loss boundary.
- Hosted needs `20261102120000_admin_audit_retention.sql` applied before the script does anything;
  read-only on 2026-11-02, before the push, it exited `1` with that file named. The migration was
  applied to the hosted project the same day and the workspace-form dry run then reported
  `0 of 0 row(s) are older than the cutoff` and deleted nothing, so the hosted trail is now bounded
  by the window the operator chooses instead of growing without limit. `docs/setup.md` records the
  confirmation checks.
- The object is deliberately absent from the boot-time schema guard: the API never calls it, so a
  project without the migration still starts, and only the operator command notices the gap.
- `stock_operations` idempotency keys remain unbounded. ADR-0005 keeps that as future work with a
  different safety rule — a key may only expire after the retry window, so it cannot reuse this
  function.
- Audit-log export (the other ADR-0013 out-of-scope item) is still unimplemented. If a real
  compliance obligation ever appears, export must precede deletion, not follow it.
