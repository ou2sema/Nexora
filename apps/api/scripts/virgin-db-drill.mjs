// Rebuilds the database the way a first deployment does: a virgin schema, every
// migration in filename order, then the development seed — and proves both halves of
// the boot-time schema guard, that a complete schema lets the API serve readiness and
// that a missing migration stops it. It drops databases, so it refuses to run anywhere
// but localhost and can never touch a hosted project.
//
//   DATABASE_URL=postgresql://postgres:pw@127.0.0.1:5432/postgres npm run drill:virgin-database

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;

const API_DIR = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(API_DIR, '..', '..');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase', 'migrations');
const SEED_FILE = resolve(REPO_ROOT, 'supabase', 'seed.sql');
const BUILD_FILE = resolve(API_DIR, 'dist', 'main.js');

/**
 * Stands in for what Supabase owns. The role is cluster-wide while each drill gets its
 * own database, so its creation has to be re-runnable.
 */
const AUTH_SHIM = `
create schema auth;
create table auth.users (
  id uuid primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;
`;

const DEMO_USER_ID = '00000000-0000-4000-8000-00000000feed';
const DEMO_USER_EMAIL = 'owner@sbs-vision.tn';

/** The table the negative run drops; the guard has to name it. */
const DROPPED_OBJECT = 'public.admin_audit_events';

const EXPECTED_COUNTS = {
  organizations: 1,
  memberships: 1,
  products: 7,
  categories: 7,
  brands: 7,
  warehouses: 2,
  storage_locations: 3,
};

const BOOT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;

if (!process.env.DATABASE_URL) {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(REPO_ROOT, '.env')]) {
    if (existsSync(candidate)) {
      config({ path: candidate, quiet: true });
      break;
    }
  }
}

function localConnection() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is required (set it in the environment or the repository .env).');
  }

  const parsed = new URL(url);

  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new Error(
      `Refusing to run against ${parsed.hostname}: this drill drops databases, ` +
        'so it only accepts a localhost connection string.',
    );
  }

  return parsed;
}

let connection;

try {
  connection = localConnection();
} catch (error) {
  console.error(`Virgin-database drill: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const MAINTENANCE_DB = decodeURIComponent(connection.pathname.replace(/^\//, '')) || 'postgres';

function quoteIdentifier(name) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Unsafe database identifier: ${name}`);
  }

  return `"${name}"`;
}

function clientFor(database) {
  return new Client({
    host: connection.hostname,
    port: Number(connection.port) || 5432,
    user: decodeURIComponent(connection.username),
    password: decodeURIComponent(connection.password),
    database,
    ssl: false,
  });
}

async function connect(database) {
  const client = clientFor(database);
  await client.connect();
  return client;
}

const createdDatabases = [];

async function createDrillDatabase(role) {
  const database = `drill_${role}_${process.pid}_${randomBytes(3).toString('hex')}`.toLowerCase();
  const admin = await connect(MAINTENANCE_DB);

  try {
    await admin.query(`create database ${quoteIdentifier(database)}`);
    createdDatabases.push(database);
    return database;
  } finally {
    await admin.end();
  }
}

async function dropDrillDatabase(database) {
  const admin = await connect(MAINTENANCE_DB);

  try {
    await admin.query(
      'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
      [database],
    );

    try {
      await admin.query(`drop database if exists ${quoteIdentifier(database)} with (force)`);
    } catch {
      // Postgres before 13 has no FORCE option; its backends are already terminated.
      await admin.query(`drop database if exists ${quoteIdentifier(database)}`);
    }
  } finally {
    await admin.end();
    createdDatabases.splice(createdDatabases.indexOf(database), 1);
  }
}

function migrationFiles() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No SQL migrations found in ${MIGRATIONS_DIR}`);
  }

  return files;
}

const seedSql = readFileSync(SEED_FILE, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function startApi(database, port) {
  const url = new URL(connection.toString());
  url.pathname = `/${database}`;

  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: API_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      API_PORT: String(port),
      WEB_ORIGIN: 'http://localhost:5173',
      SUPABASE_URL: 'https://drill.invalid',
      SUPABASE_ANON_KEY: 'd'.repeat(40),
      SUPABASE_JWT_ISSUER: 'https://drill.invalid/auth/v1',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      DATABASE_URL: url.toString(),
      DATABASE_SSL: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output = { text: '' };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    output.text += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output.text += chunk;
  });

  const exited = new Promise((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });

  return { child, output, exited };
}

async function stopApi(api) {
  if (api.child.exitCode === null && api.child.signalCode === null) {
    api.child.kill();
    await Promise.race([api.exited, delay(5_000)]);
  }
}

async function readiness(port, windowMs) {
  const deadline = Date.now() + windowMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
        signal: AbortSignal.timeout(2_000),
      });

      if (response.ok) return await response.json();
    } catch {
      // The API is still booting or has refused to start.
    }

    await delay(POLL_INTERVAL_MS);
  }

  return null;
}

async function verifySeed(client) {
  const counts = (
    await client.query(`
      select
        (select count(*)::int from public.organizations) as organizations,
        (select count(*)::int from public.memberships) as memberships,
        (select count(*)::int from public.products) as products,
        (select count(*)::int from public.categories) as categories,
        (select count(*)::int from public.brands) as brands,
        (select count(*)::int from public.warehouses) as warehouses,
        (select count(*)::int from public.storage_locations) as storage_locations
    `)
  ).rows[0];

  const wrong = Object.entries(EXPECTED_COUNTS).filter(
    ([table, expected]) => counts?.[table] !== expected,
  );

  assert(
    wrong.length === 0,
    `Seeded row counts differ: ${wrong
      .map(([table, expected]) => `${table}=${counts?.[table]}, expected ${expected}`)
      .join('; ')}`,
  );

  const organization = (await client.query('select slug from public.organizations')).rows;
  assert(
    organization.length === 1 && organization[0].slug === 'sbs-vision',
    `Expected only the demo organization, got ${JSON.stringify(organization)}`,
  );

  const membership = (await client.query('select role, user_id from public.memberships')).rows;
  assert(
    membership.length === 1 &&
      membership[0].role === 'owner' &&
      membership[0].user_id === DEMO_USER_ID,
    `Expected the earliest user to own the demo organization, got ${JSON.stringify(membership)}`,
  );

  const barcodes = (
    await client.query('select barcode from public.products where barcode is not null')
  ).rows;
  assert(
    barcodes.every((row) => /^[0-9]{13}$/.test(row.barcode)),
    'Seeded product barcodes must all be 13-digit GTINs.',
  );

  return counts;
}

async function seedWithoutUsers(client) {
  try {
    await client.query(seedSql);
  } catch (error) {
    return error;
  }

  throw new Error('The seed ran against a database with no signed-up user; it must refuse.');
}

async function positiveDrill(port) {
  const database = await createDrillDatabase('ready');
  const client = await connect(database);

  try {
    await client.query(AUTH_SHIM);
    const files = migrationFiles();

    for (const file of files) {
      await client.query(readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'));
    }

    const refusal = await seedWithoutUsers(client);
    assert(
      /seed_requires_auth_user/.test(String(refusal?.message)),
      `Seed without a user must raise seed_requires_auth_user, got: ${String(refusal?.message)}`,
    );

    await client.query('insert into auth.users (id, email) values ($1, $2)', [
      DEMO_USER_ID,
      DEMO_USER_EMAIL,
    ]);
    await client.query(seedSql);
    await client.query(seedSql);

    const counts = await verifySeed(client);
    const api = startApi(database, port);

    try {
      const ready = await readiness(port, BOOT_TIMEOUT_MS);
      assert(ready !== null, `The API never reported ready.\n${api.output.text}`);
      assert(
        ready.status === 'ok' && ready.database?.status === 'up',
        `Unexpected readiness payload: ${JSON.stringify(ready)}`,
      );
      assert(
        /Database schema verified/.test(api.output.text),
        `The API started without verifying the schema.\n${api.output.text}`,
      );

      say(
        `positive: ${files.length} migrations + seed on a virgin ${database}, ` +
          `seeded ${Object.values(counts).join('/')}, ` +
          `readiness ok with a ${ready.database.latencyMs} ms database probe`,
      );
    } finally {
      await stopApi(api);
    }
  } finally {
    await client.end();
    await dropDrillDatabase(database);
  }
}

async function negativeDrill(port) {
  const database = await createDrillDatabase('guard');
  const client = await connect(database);

  try {
    await client.query(AUTH_SHIM);

    for (const file of migrationFiles()) {
      await client.query(readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'));
    }

    await client.query('insert into auth.users (id, email) values ($1, $2)', [
      DEMO_USER_ID,
      DEMO_USER_EMAIL,
    ]);
    await client.query(seedSql);
    await client.query(`drop table ${DROPPED_OBJECT}`);

    const api = startApi(database, port);

    try {
      const outcome = await Promise.race([api.exited, delay(BOOT_TIMEOUT_MS).then(() => null)]);
      assert(
        outcome !== null,
        `The API kept running with ${DROPPED_OBJECT} missing.\n${api.output.text}`,
      );
      assert(
        outcome.code !== 0,
        `Expected a non-zero exit with ${DROPPED_OBJECT} missing, got ${JSON.stringify(outcome)}.`,
      );
      assert(
        api.output.text.includes(`Database schema is out of date; missing ${DROPPED_OBJECT}`),
        `The guard stopped the boot but did not name ${DROPPED_OBJECT}.\n${api.output.text}`,
      );
      assert(
        (await readiness(port, 2_000)) === null,
        `The API answered /health/ready although ${DROPPED_OBJECT} is missing.`,
      );

      say(`negative: dropping ${DROPPED_OBJECT} stopped the boot with exit code ${outcome.code}`);
    } finally {
      await stopApi(api);
    }
  } finally {
    await client.end();
    await dropDrillDatabase(database);
  }
}

function say(message) {
  process.stdout.write(`${message}\n`);
}

if (!existsSync(BUILD_FILE)) {
  console.error('dist/main.js is missing — run `npm run build` before this drill.');
  process.exit(1);
}

const basePort = Number(process.env.VIRGIN_DRILL_API_PORT ?? 4310);
say(`Virgin-database drill against ${connection.hostname}:${connection.port || '5432'}.`);

let failure;

try {
  await positiveDrill(basePort);
  await negativeDrill(basePort + 1);
  say('Virgin-database drill passed: migrations, seed, and both schema-guard paths.');
} catch (error) {
  failure = error;
} finally {
  for (const database of [...createdDatabases]) {
    await dropDrillDatabase(database).catch((error) => {
      say(`Drill database ${database} left behind: ${error.message}`);
    });
  }
}

if (failure) {
  console.error(`Virgin-database drill failed: ${failure.message}`);
  process.exit(1);
}
