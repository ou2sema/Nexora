# Setup and verification

Everything below assumes Windows 11 with PowerShell 7 and a clone of this repository.
Commands are copy-pasteable; paths are relative to the repository root.

## Prerequisites

| Tool    | Version                       | Notes                                   |
| ------- | ----------------------------- | --------------------------------------- |
| Node.js | >= 22.12 (developed on 26.13) | `node --version`                        |
| npm     | >= 10 (repo pins npm 11)      | `npm --version`                         |
| Edge    | any recent build              | Local E2E reuses the installed browser  |
| Java    | 17+ (developed on 27)         | Only needed for `npm run report:allure` |
| Git     | any recent version            |                                         |

A hosted Supabase project is **not** required for Phase 1: no code path contacts Supabase
yet. It becomes mandatory in Phase 2 (database and auth).

## First-time setup

```powershell
cd C:\dev\mystock
npm install
Copy-Item .env.example .env
```

Fill `.env` with your Supabase project URL, anon key, and database URL. Keep
`SUPABASE_SERVICE_ROLE_KEY` server-side only — it never appears in a `VITE_` variable.

The web app validates its own environment at startup and reads a git-ignored file:

```powershell
@"
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_BASE_URL=http://localhost:4100/api/v1
"@ | Set-Content apps/web/.env.local
```

## Run the apps

Use two terminals from the repository root.

```powershell
# Terminal 1 — API on http://localhost:4100
npm run dev --workspace @mystock/api
```

```powershell
# Terminal 2 — web on http://localhost:5173
npm run dev --workspace @mystock/web
```

| Service | URL                          | Expected response                             |
| ------- | ---------------------------- | --------------------------------------------- |
| API     | http://localhost:4100/health | `{"status":"ok","service":"mystock-api",...}` |
| Web     | http://localhost:5173        | Dashboard shell with an "API online" card     |

The Vite dev server proxies `/api` to the API, but the dashboard calls
`VITE_API_BASE_URL` directly, so both processes must be running.

Port 4100 is a deliberate choice: 3000 is commonly occupied by other local Node
processes, which silently produces HTML 404s instead of API responses.

## Quality gates

```powershell
npm run format:check   # Prettier, read-only
npm run lint           # ESLint flat config across every workspace
npm run typecheck      # builds packages, then tsc per workspace
npm run test           # builds packages, then Vitest per workspace
npm run build          # packages first, then apps (order matters)
```

`build` and `typecheck` build `packages/*` before the apps. npm executes workspaces
alphabetically, so `@mystock/api` would otherwise build against a stale or missing
`@mystock/config` output.

## Database

The schema is plain SQL in `supabase/migrations`, applied in filename order. Demo data lives in
`supabase/seed.sql` and requires at least one signed-up user (it raises
`seed_requires_auth_user` otherwise).

Tenant isolation is enforced by Postgres RLS: tables carry `organization_id`, roles come from
`memberships.role`, and every policy calls the `app.*` helpers. The isolation suite runs
against PGlite (PostgreSQL in WASM) inside Vitest, so it needs no Docker, no credentials, and
runs in CI on every `npm run test`.

| Role    | Manage organization and members | Write catalog | Read |
| ------- | ------------------------------- | ------------- | ---- |
| owner   | yes                             | yes           | yes  |
| admin   | yes                             | yes           | yes  |
| manager | no                              | yes           | yes  |
| viewer  | no                              | no            | yes  |

Applying migrations to the hosted project (needs your access token and database password):

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push --include-seed
```

Without linking, push directly with the connection string from `.env` (the CLI expects it
percent-encoded):

```powershell
npx supabase db push --db-url $env:DATABASE_URL --include-seed
```

Run only the database tests while iterating:

```powershell
npm run test --workspace @mystock/api -- test/db
```

## Test suites

| Command                                 | What it runs                                                        |
| --------------------------------------- | ------------------------------------------------------------------- |
| `npm run test`                          | 78 Vitest tests: API shell, env schema, contracts, domain, RLS/seed |
| `npm run test:e2e`                      | Playwright against the API and dev server                           |
| `npm run test:e2e:headed`               | Same, with visible browsers (local verification)                    |
| `npm run test:e2e -- --project=desktop` | One Playwright project only                                         |

Playwright starts both servers itself (`webServer` in `apps/web/playwright.config.ts`)
and reuses already-running instances locally. Locally it drives the installed Edge
via `channel: 'msedge'`; on CI it downloads Playwright's Chromium. Override with
`$env:PLAYWRIGHT_CHANNEL = ''` to use bundled Chromium locally.

## Allure report

```powershell
npm run test:e2e
cd apps/web
npx allure generate ./allure-results -o ./allure-report --clean
npx allure open ./allure-report
```

`allure` needs Java on `PATH`. Every `npm run test:e2e` clears `apps/web/allure-results`
first, so the report always reflects exactly one run. `allure-results/` and
`allure-report/` are ignored by git.

## Continuous integration

`.github/workflows/ci.yml` runs two jobs on `ubuntu-latest` for every push to `main`
and every pull request:

| Job       | Steps                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| `quality` | `npm ci` → format check → lint → typecheck → unit tests → build                              |
| `e2e`     | `npm ci` → install Chromium → write test `.env.local` → build → Playwright → artifact upload |

The E2E job writes placeholder `VITE_` values (no real project, no real secrets) and
uploads `test-results/` plus `allure-results/` only when the run fails.

To reproduce the `quality` job locally, run the gates above in the same order after a
clean `npm ci`. To reproduce the `e2e` job locally, stop any running dev servers first — CI mode never
reuses an existing server and fails if 4100 or 5173 is occupied:

```powershell
$env:CI = 'true'
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
Remove-Item Env:\CI
```

## Troubleshooting

**Port 4100 already in use** — find and stop the owner:

```powershell
Get-NetTCPConnection -LocalPort 4100 -State Listen |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Get-Process -Id $_ }
```

**Playwright reports `strictPort` failure on 5173** — a previous Vite process survived
the terminal that started it. Identify it by command line before stopping it:

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'vite' } |
  Select-Object ProcessId, CommandLine
```

**`Error: Environment variable VITE_SUPABASE_URL is missing`** — `apps/web/.env.local` is
absent or incomplete. Recreate it as shown above.

**Allure command not found / Java error** — `npm run report:allure` uses the
`allure-commandline` dev dependency; install a JRE 17+ and reopen the terminal.

## Security notes

- Only the Supabase **anon** key may appear in web configuration. Row Level Security is
  what makes that safe, and RLS lands in Phase 2 with its negative tests.
- The service-role key stays in the API process environment and is never sent to the
  browser, logged, or committed.
- `.env*` files are git-ignored; only `.env.example` is tracked, and it contains
  placeholders only.
