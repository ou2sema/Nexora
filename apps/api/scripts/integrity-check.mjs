// Read-only integrity sweep: for every organization, compare the stock projection
// with its ledger using the same RPC the API exposes. Exits 1 when any line drifts
// so it can run from cron or a pre-release checklist.
//
//   DATABASE_URL=postgres://... node apps/api/scripts/integrity-check.mjs
//
// The connection needs a role that may impersonate an organization admin
// (the migration/administration role used by the API is enough).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';
import postgres from 'postgres';

const apiDir = resolve(import.meta.dirname, '..');
const repoRoot = resolve(apiDir, '..', '..');

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

  const parsed = new URL(url);
  return parsed.searchParams.get('sslmode') === 'require' ||
    parsed.hostname.endsWith('supabase.com')
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

function formatDifference(row) {
  return (
    `product=${row.product_id} warehouse=${row.warehouse_id} location=${row.location_id} ` +
    `balance=${row.balance_on_hand} ledger=${row.ledger_on_hand} difference=${row.difference}`
  );
}

let totalDrift = 0;
let failed = 0;

try {
  const organizations = await sql`
    select id, name
    from public.organizations
    order by lower(name), id
  `;

  console.log(
    organizations.length === 0
      ? 'Integrity check: no organizations to inspect.'
      : `Integrity check: ${organizations.length} organization(s).`,
  );

  for (const organization of organizations) {
    const [admin] = await sql`
      select m.user_id
      from public.memberships m
      where m.organization_id = ${organization.id}
        and m.role in ('owner', 'admin')
      order by (m.role = 'owner') desc, m.created_at
      limit 1
    `;

    if (!admin) {
      console.log(`  SKIP  ${organization.name} — no owner or admin to authorize the check.`);
      continue;
    }

    try {
      const reconciliation = await sql.begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select set_config(
          'request.jwt.claims',
          ${JSON.stringify({ sub: admin.user_id, role: 'authenticated' })},
          true
        )`;
        return tx`select * from app.stock_reconciliation(${organization.id})`;
      });

      const drift = reconciliation.filter((row) => Number(row.difference) !== 0);
      totalDrift += drift.length;

      if (drift.length === 0) {
        console.log(`  OK    ${organization.name} (${reconciliation.length} stock line(s))`);
        continue;
      }

      console.log(
        `  DRIFT ${organization.name} — ${drift.length} of ${reconciliation.length} stock line(s)`,
      );
      for (const row of drift) {
        console.log(`        ${formatDifference(row)}`);
      }
    } catch (error) {
      failed += 1;
      console.error(
        `  ERROR ${organization.name} — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
} catch (error) {
  console.error(
    `Integrity check could not run: ${error instanceof Error ? error.message : String(error)}`,
  );
  failed += 1;
} finally {
  await sql.end({ timeout: 5 });
}

if (failed > 0) {
  console.error(`Integrity check failed for ${failed} organization(s).`);
  process.exit(1);
}

if (totalDrift > 0) {
  console.error(`Integrity check found ${totalDrift} drifting stock line(s).`);
  process.exit(1);
}

console.log('Integrity check passed: every projection matches its ledger.');
process.exit(0);
