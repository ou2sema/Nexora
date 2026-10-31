# Restore drill runbook

- **Status:** drafted, **not yet executed**
- **Owner:** deployment operator
- **Applies to:** hosted Supabase projects that run the MyStock migrations

## Purpose

Prove that a Supabase backup of the hosted database restores into a usable MyStock
deployment: schema, RLS, functions, and data all agree, and the restored stock projection
matches its ledger. The drill also measures recovery time (RTO) and exposes how much data
the latest restore point can lose (RPO).

A restore is a platform operation. This runbook is executed by the operator in the Supabase
dashboard and a terminal; it is not automated and has not been run yet. Do not mark it
“verified” until a drill record exists below.

## Safety rules

- **Never restore over the production project.** Use a new, empty Supabase project created
  for the drill.
- Do not paste database passwords, connection strings, or service-role keys into this
  document, chat, or commits.
- The operator's own password is never used by tooling. Any signed-in check is done by the
  operator in a browser.
- Keep the production project read-only during the drill; only run the read-only baseline
  queries against it.

## Preconditions

- Production project ref and dashboard access.
- A scratch Supabase project whose plan can receive a restore (or a downloaded backup and a
  local PostgreSQL 18 instance for a manual `psql` restore).
- The repository at the commit to verify, with `DATABASE_URL` / `DATABASE_SSL` available for
  the scratch project in the local `.env` or environment.
- `npm ci`, `npm run build` completed, so `npm run check:integrity` and the API build exist.

## Procedure

### 1. Baseline the production database (read-only)

Run as the production owner (SQL editor or `psql`). Save the output with the drill record.

```sql
select count(*) as organizations from public.organizations;
select count(*) as profiles from public.profiles;
select count(*) as memberships from public.memberships;
select count(*) as products from public.products;
select count(*) as movements from public.stock_movements;
select coalesce(sum(quantity_delta), 0) as ledger_units from public.stock_movements;
select coalesce(sum(on_hand), 0) as balance_units from public.stock_balances;
select max(created_at) as latest_movement_at from public.stock_movements;
select id from public.stock_movements order by created_at desc limit 1;
```

Then confirm the projection is clean before relying on it as a baseline:

```
npm run check:integrity
```

with `DATABASE_URL` pointing at production (read-only usage). Expected: every organization
reports `OK` and the exit code is `0`. If it reports drift, record it; the drill verifies
recovery of the current state, not a repair.

### 2. Note the restore point

In the dashboard, open **Database → Backups** and record the timestamp and type of the
backup to be restored. RPO is `drill start − backup timestamp`.

### 3. Restore into the scratch project

Use the dashboard's restore flow for the scratch project, or restore a downloaded backup
with `psql`:

```powershell
$env:PGPASSWORD = '<scratch database password>'
psql "postgresql://postgres:<scratch-password>@<scratch-host>:5432/postgres" -f backup-file.sql
```

Never point this command at the production host. Start a timer when the restore starts.
RTO is stopped in step 6, after verification passes.

### 4. Verify the schema

Connect to the scratch project and check the migration ledger plus the objects the API
probes at boot:

```sql
select version from supabase_migrations.schema_migrations order by version;
select to_regclass('public.admin_audit_events') is not null as audit_table;
select to_regprocedure('app.is_platform_admin()') is not null as platform_flag_fn;
select to_regprocedure('app.stock_reconciliation(uuid)') is not null as reconciliation_fn;
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;
```

Expected: the migration list ends with the latest migration in the repository, the probe
columns are `true`, and `relrowsecurity` is `true` for every business table.

### 5. Verify the data

Repeat the baseline counts on the scratch project. The counts, ledger sum, balance sum,
and latest movement id must match the production baseline. Then run:

```powershell
$env:DATABASE_URL = 'postgresql://postgres:<scratch-password>@<scratch-host>:5432/postgres'
$env:DATABASE_SSL = 'true'
npm run check:integrity
Remove-Item Env:\DATABASE_URL, Env:\DATABASE_SSL
```

Expected: every organization reports `OK`, exit code `0`. This also proves the RPC, RLS
helpers, and the owner/admin membership data survived the restore.

### 6. Verify the application path

Start the built API with the scratch `DATABASE_URL` and a scratch `VITE_` configuration,
open the app, and sign in **manually as the operator** (or a throwaway account created in
the scratch project). Confirm `/me` loads, the organization picker lists the restored
tenants, and the dashboard totals match the ledger sum. Record the time RTO stops here.

Do not run a hosted smoke test with the owner's password from tooling.

### 7. Tear down

Delete the scratch project or stop and remove the local restore instance. Remove the
scratch credentials from the environment. Keep this runbook's record only.

## Acceptance criteria

- Schema probe columns are all `true`; RLS is enabled on every business table.
- Baseline and restored counts, ledger sum, balance sum, and latest movement id match.
- `npm run check:integrity` exits `0` with zero drift on the restored database.
- A manual sign-in against the restored database shows the expected organizations and
  dashboard totals.
- RTO and RPO are recorded.

## Failure handling

If any check fails, stop and record the failing step and output. Do not “fix” the restored
database to make the drill pass; a failed drill is a finding about the backup/restore
process or the runbook. Raise it with the operator before declaring the drill complete.

## Drill record

Copy this block into a new section when a drill is performed.

```text
Date:
Operator:
Production project ref:
Scratch project ref:
Backup timestamp / type:
Restore start → RTO:
RPO:
Schema probes:            pass / fail
Baseline vs restored:     pass / fail
Integrity check:          pass / fail (drift count)
Signed-in check:          pass / fail
Outcome:                  pass / fail
Notes / findings:
```
