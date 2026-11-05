# Deployment and rollback runbook

- **Status:** documented, not yet exercised as a rollback
- **Owner:** deployment operator (the user); no automated deploy exists
- **Applies to:** the built API (`node dist/main.js`), the built web app, and the hosted
  Supabase database that runs the `supabase/migrations` history

## What rolling back means here

Three layers move independently, so a rollback names the layer that failed:

| Layer     | Roll back by                                                                        | Data loss                                   |
| --------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| Web build | Serve the previous `apps/web/dist` output (or restart the previous Vite dev server) | none                                        |
| API build | Check out the previous commit, rebuild, restart the process                         | none                                        |
| Database  | Forward-fix with a new migration, or restore a backup                               | none, or everything after the restore point |

The migrations are forward-only: the repository has no down-migrations, so there is no
command that "un-applies" a migration. Either a corrective migration goes forward, or the
database is rebuilt from a backup. Restoring is a platform operation and the only path with
real RPO consequences; it is covered by
[`restore-drill.md`](restore-drill.md) and must never be run over the production project.

The boot-time schema guard changes the failure mode, not the fix: an API build only probes
the objects it lists in `apps/api/src/database/schema-guard.ts`, so a stale build can start
against a newer database (and then fail on the routes or contracts that build does not
have), while a current build refuses to start at all when a migration is missing. A guard
refusal therefore means "apply the migration", not "roll the API back".

## Backups

Backup availability, retention, and the resulting RPO depend on the hosted project's plan
and **have not been recorded for this project yet**. Capture them during the first restore
drill (Dashboard → Database → Backups, step 2 of the drill runbook) and add the numbers to
this file, together with whether point-in-time recovery is available. Until then, assume
the worst case: the oldest retained snapshot, and no recovery to an arbitrary second.

## Prerequisites

- The repository at a clean checkout; `npm ci` and `npm run build` complete for the target
  commit.
- Chromium on the machine that runs the API: `npx playwright-core install --with-deps chromium
chromium-headless-shell` (ADR-0019 makes the browser a runtime dependency, pinned to
  `playwright-core` 1.64.1 in the lockfile). A host that has never run the E2E suite needs this
  install, and without it `/health/ready` answers `503` for the renderer.
- `DATABASE_URL` / `DATABASE_SSL` for the hosted project available to the operator (root
  `.env` or the environment). Never paste them into chat, commits, or this document.
- The commit or release identifier you are rolling back **from** and **to**. There are
  currently no git tags in this repository (`git tag` is empty), so a rollback target is a
  SHA. Tagging each accepted release is the recommended first improvement to this runbook.
- A quiet moment: the API restart drops in-flight requests, and the readiness probe is what
  tells you the process is usable.

## Procedure: roll back the application only

Use this when the schema is fine and the code regressed.

```powershell
git fetch origin
git log --oneline -10                       # identify the last known-good SHA
git checkout <last-known-good-sha>
npm ci
npm run build
```

Restart the API the way it is normally started, then verify before declaring success:

```powershell
Invoke-RestMethod http://localhost:4100/health/live    # must answer immediately
Invoke-RestMethod http://localhost:4100/health/ready   # must answer once the database and the renderer do
npm run check:integrity                                # must exit 0, every organization OK
```

`/health/ready` returning `503` with `service_unavailable` names its cause in the message and in the
`details` — `database` when the pooler is unreachable, `renderer` when the machine has no Chromium for
the print engine to start (ADR-0019). Neither is a code regression: a renderer outage is an install
problem, and the same build keeps serving stock, reports and the pdf-lib label sheets either way.

## Procedure: the API refused to start after a deploy

Read the boot message; it names the missing objects.

```text
Database schema is out of date; missing public.admin_audit_events. Apply
supabase/migrations before starting the API.
```

1. Confirm which migration creates each named object (`grep -l <object> supabase/migrations/*.sql`).
2. Apply the missing migrations to the hosted project with a dry run first, and never with
   `--include-seed`:
   ```powershell
   npx supabase db push --db-url "<session-pooler-url>" --dry-run
   npx supabase db push --db-url "<session-pooler-url>"
   ```
3. Start the API again and run the three verification commands above.
4. Do **not** roll the API back to a build that predates the feature the migration unlocks
   unless the new routes must also disappear; a stale build against a newer schema starts
   happily and fails later.

## Procedure: a migration was applied but is wrong

1. Stop the API build that depends on it if it is actively damaging data; otherwise keep it
   running — the guard does not detect a wrong-but-present object.
2. Write a corrective migration — a new timestamped file in `supabase/migrations`
   (`npx supabase migration new <name>` if you use the CLI) that repairs or drops what the
   bad one added. Never edit an applied migration file: the hosted ledger and a fresh
   virgin-database rebuild would then diverge.
3. Prove the history from scratch before touching hosted:
   ```powershell
   npm run build
   $env:DATABASE_URL = 'postgresql://postgres:pw@127.0.0.1:5432/postgres'
   npm run drill:virgin-database --workspace @mystock/api
   ```
   The drill applies every migration in filename order to a virgin database, seeds it,
   requires `/health/ready`, and proves the guard still refuses an incomplete schema.
4. Push the corrective migration to hosted with a dry run, then verify with
   `npm run check:integrity` and a signed-in read of the affected screen.

## Procedure: restore the database

Follow [`restore-drill.md`](restore-drill.md) end to end, in a scratch project, and only
promote a restore to production after the drill record shows the baseline counts, the
integrity sweep, and a signed-in read all agree. Record the timestamp of the restore point
you used and the resulting RPO in the incident notes.

## Decision table

| Symptom                                             | Most likely cause                                                                                                 | Action                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| API exits at boot naming missing objects            | Migration not applied to hosted                                                                                   | Apply the migration, do not roll back                     |
| Boot fails on `Invalid environment configuration`   | Missing/renamed env var                                                                                           | Fix the environment, see `.env.example`                   |
| `/health/ready` is 503, `/health/live` is 200       | `details.database`: pooler unreachable. `details.renderer`: the print engine did not answer — usually no Chromium | Check credentials, or install the browser — not the build |
| Sign-in works, API calls are blocked in the browser | `WEB_ORIGIN` mismatch (CORS)                                                                                      | Correct `WEB_ORIGIN` to the exact origin                  |
| Routes 404 on `/api/v1/health/live`                 | Expected                                                                                                          | Global prefix excludes the probes                         |
| Data looks wrong after a deploy                     | Application bug or bad migration                                                                                  | Stop writes, integrity sweep, forward-fix or restore      |

## Post-rollback verification checklist

- [ ] `/health/live` answers, `/health/ready` answers 200 with `database.status = up` and
      `renderer.status = up`.
- [ ] `npm run check:integrity` exits `0` with no `DRIFT` rows.
- [ ] `npm run test` and the headed local-stack E2E run pass on the rolled-back commit.
- [ ] A signed-in read of the affected screen matches the ledger.
- [ ] The incident notes record the SHA restored, the migration state, and whether the
      rollback was app-only, forward-fix, or restore.

## Improvements this runbook still needs

- Tag every accepted release so a rollback target is a name, not a SHA.
- Record the backup/PITR facts after the first restore drill and state the target RPO/RTO.
- Keep a second build directory or container image so a rollback is a restart, not a rebuild.
