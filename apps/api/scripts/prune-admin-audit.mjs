// Bounded retention for the operator audit trail: deletes `admin_audit_events` rows
// older than the window and reports how many went. Only the table owner may execute the
// function, so this runs from a scheduler the operator controls with the same
// DATABASE_URL the migrations use — never from the API, which has no route for it.
//
//   node apps/api/scripts/prune-admin-audit.mjs --retention-days=180
//   node apps/api/scripts/prune-admin-audit.mjs --dry-run
//
// DATABASE_URL comes from the environment or the repository .env, like the other
// operator scripts. The prune itself is not written into the table it trims; the
// printed cutoff and count are the durable record in the scheduler's log.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';
import postgres from 'postgres';

const apiDir = resolve(import.meta.dirname, '..');
const repoRoot = resolve(apiDir, '..', '..');

const DEFAULT_RETENTION_DAYS = 180;
// Kept in sync with app.prune_admin_audit_events, which raises the same refusal.
const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 3650;

function parseArgs(argv) {
  const options = { retentionDays: DEFAULT_RETENTION_DAYS, dryRun: false };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    const match = /^--retention-days=(\d+)$/.exec(arg);
    if (match) {
      options.retentionDays = Number(match[1]);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (
    !Number.isInteger(options.retentionDays) ||
    options.retentionDays < MIN_RETENTION_DAYS ||
    options.retentionDays > MAX_RETENTION_DAYS
  ) {
    throw new Error(
      `--retention-days must be between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}.`,
    );
  }

  return options;
}

let parsed;
try {
  parsed = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`Audit prune: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(repoRoot, '.env')]) {
    if (existsSync(candidate)) {
      config({ path: candidate, quiet: true });
      break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required (set it in the environment or the repository .env).');
  process.exit(1);
}

function resolveSsl(url) {
  const flag = process.env.DATABASE_SSL;
  if (flag === 'true') return 'require';
  if (flag === 'false') return false;

  const parsedUrl = new URL(url);
  return parsedUrl.searchParams.get('sslmode') === 'require' ||
    parsedUrl.hostname.endsWith('supabase.com')
    ? 'require'
    : false;
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: resolveSsl(process.env.DATABASE_URL),
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  onnotice: () => undefined,
});

const { retentionDays, dryRun } = parsed;
let exitCode = 0;

try {
  const [probe] = await sql`
    select to_regprocedure('app.prune_admin_audit_events(integer)') as function_oid
  `;

  if (!probe?.function_oid) {
    console.error(
      'Audit prune: app.prune_admin_audit_events(integer) does not exist. ' +
        'Apply supabase/migrations/20261102120000_admin_audit_retention.sql first.',
    );
    exitCode = 1;
  } else {
    const [summary] = await sql`
      select
        (now() - make_interval(days => ${retentionDays}))::timestamptz as cutoff,
        count(*) filter (
          where created_at < now() - make_interval(days => ${retentionDays})
        )::int as expired,
        count(*)::int as total
      from public.admin_audit_events
    `;

    console.log(
      `Audit prune: window ${retentionDays} day(s), cutoff ${new Date(summary.cutoff).toISOString()}.`,
    );
    console.log(`  ${summary.expired} of ${summary.total} row(s) are older than the cutoff.`);

    if (dryRun) {
      console.log('  Dry run: nothing was deleted.');
    } else if (summary.expired === 0) {
      console.log('  Nothing to delete.');
    } else {
      const [pruned] = await sql`select app.prune_admin_audit_events(${retentionDays}) as deleted`;
      console.log(
        `  Deleted ${pruned.deleted} row(s); ${summary.total - pruned.deleted} remain.` +
          ' Record this line as the retention audit entry.',
      );
    }
  }
} catch (error) {
  console.error(
    `Audit prune could not run: ${error instanceof Error ? error.message : String(error)}`,
  );
  exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

process.exit(exitCode);
