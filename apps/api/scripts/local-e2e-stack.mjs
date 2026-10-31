import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import EmbeddedPostgres from 'embedded-postgres';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const PG_PORT = 55432;
const AUTH_PORT = 4200;
const API_PORT = 4101;
const WEB_ORIGIN = 'http://localhost:5174';
const AUTH_ORIGIN = `http://localhost:${AUTH_PORT}`;
const ISSUER = `${AUTH_ORIGIN}/auth/v1`;
const API_DIR = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(API_DIR, '..', '..');

const USERS = {
  'alice@example.com': {
    id: '00000000-0000-4000-8000-00000000000a',
    role: 'owner',
  },
  'dave@example.com': {
    id: '00000000-0000-4000-8000-00000000000d',
    role: 'viewer',
  },
};

const AUTH_SHIM = `
create schema auth;
create table auth.users (
  id uuid primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);
create role authenticated nologin;
`;

const FIXTURES = `
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.com'),
  ('00000000-0000-4000-8000-00000000000d', 'dave@example.com');

insert into public.organizations (id, name, slug) values
  ('10000000-0000-4000-8000-00000000000a', 'Org A', 'org-a');

insert into public.memberships (organization_id, user_id, role) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'owner'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000d', 'viewer');

insert into public.categories (id, organization_id, parent_id, name, slug) values
  ('30000000-0000-4000-8000-0000000000a0', '10000000-0000-4000-8000-00000000000a', null, 'Phones', 'phones'),
  ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-0000000000a0', 'Smartphones', 'smartphones');

insert into public.brands (id, organization_id, name) values
  ('40000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'Apple');

insert into public.products (
  id, organization_id, sku, name, category_id, brand_id, barcode,
  internal_code, purchase_price_minor, sale_price_minor, is_serialized
) values
  ('20000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a',
   'IPHONE-15', 'iPhone 15 128GB', '30000000-0000-4000-8000-0000000000a1',
   '40000000-0000-4000-8000-00000000000a', '2000000000015', 'MS-A-0001', 3150000, 3690000, true),
  ('20000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a',
   'CABLE-USB-C', 'USB-C cable 2m', '30000000-0000-4000-8000-0000000000a0',
   null, null, 'MS-A-0002', 4500, 8900, false);

insert into public.warehouses (id, organization_id, code, name) values
  ('50000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'MAIN', 'Main warehouse');

insert into public.storage_locations (id, organization_id, warehouse_id, code, name) values
  ('60000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a',
   '50000000-0000-4000-8000-00000000000a', 'A-01', 'Aisle A shelf 01');
`;

const { publicKey, privateKey } = await generateKeyPair('ES256');
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: 'local-e2e',
  alg: 'ES256',
  use: 'sig',
};

async function tokenFor(email) {
  const user = USERS[email.toLowerCase()];
  if (!user) throw new Error(`Unknown local user ${email}`);

  return new SignJWT({ email, role: 'authenticated', session_id: 'local-e2e-session' })
    .setProtectedHeader({ alg: 'ES256', kid: 'local-e2e' })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(privateKey);
}

function sessionFor(email) {
  const user = USERS[email.toLowerCase()];
  const now = Math.floor(Date.now() / 1000);

  return {
    access_token: null,
    token_type: 'bearer',
    expires_in: 7200,
    expires_at: now + 7200,
    refresh_token: `local-e2e-refresh-${user.id}`,
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    },
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const authServer = createServer(async (request, response) => {
  response.setHeader('access-control-allow-origin', WEB_ORIGIN);
  response.setHeader(
    'access-control-allow-headers',
    request.headers['access-control-request-headers'] ??
      'authorization, apikey, content-type, x-client-info',
  );
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  response.setHeader('vary', 'origin, access-control-request-headers');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? '/', AUTH_ORIGIN);

  if (url.pathname === '/auth/v1/.well-known/jwks.json') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [jwk] }));
    return;
  }

  if (url.pathname === '/auth/v1/token' && request.method === 'POST') {
    let email;

    if (url.searchParams.get('grant_type') === 'password') {
      try {
        const body = JSON.parse(await readBody(request));
        email = String(body.email ?? '').toLowerCase();
      } catch {
        email = '';
      }
    } else {
      try {
        const body = JSON.parse(await readBody(request));
        const refresh = String(body.refresh_token ?? '');
        const match = Object.entries(USERS).find(([, user]) => refresh.endsWith(user.id));
        email = match ? match[0] : '';
      } catch {
        email = '';
      }
    }

    if (!USERS[email]) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      );
      return;
    }

    const session = sessionFor(email);
    session.access_token = await tokenFor(email);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(session));
    return;
  }

  if (url.pathname === '/auth/v1/logout') {
    response.writeHead(204);
    response.end();
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

const databaseDir = mkdtempSync(join(tmpdir(), 'mystock-e2e-'));
const embedded = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port: PG_PORT,
  persistent: true,
  onLog: () => undefined,
  onError: () => undefined,
});

let apiProcess;
let shuttingDown = false;

async function stop() {
  if (shuttingDown) return;
  shuttingDown = true;

  apiProcess?.kill();
  await new Promise((resolveClose) => authServer.close(resolveClose));
  await embedded.stop().catch(() => undefined);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));

  try {
    rmSync(databaseDir, { recursive: true, force: true });
  } catch {
    // Windows may retain a handle briefly; the temp directory is disposable.
  }

  process.exit(0);
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

async function waitForHealth(maxAttempts = 60) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${API_PORT}/health`);
      if (response.ok) return;
    } catch {
      // API still booting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
  }

  throw new Error('The local API did not become healthy in time.');
}

await authServer.listen(AUTH_PORT, '127.0.0.1');
await embedded.initialise();
await embedded.start();

const admin = embedded.getPgClient('postgres', '127.0.0.1');
await admin.connect();
await admin.query(AUTH_SHIM);

const migrationsDir = join(REPO_ROOT, 'supabase', 'migrations');
for (const file of readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  await admin.query(readFileSync(join(migrationsDir, file), 'utf8'));
}

await admin.query(FIXTURES);
await admin.end();

apiProcess = spawn(process.execPath, ['dist/main.js'], {
  cwd: API_DIR,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    API_PORT: String(API_PORT),
    WEB_ORIGIN,
    SUPABASE_URL: AUTH_ORIGIN,
    SUPABASE_ANON_KEY: 'a'.repeat(40),
    SUPABASE_JWT_ISSUER: ISSUER,
    SUPABASE_JWT_AUDIENCE: 'authenticated',
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`,
    DATABASE_SSL: 'false',
    SUPABASE_STORAGE_BUCKET: 'mystock-test',
  },
  stdio: 'inherit',
});

apiProcess.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`Local API exited with code ${code}.`);
    void stop();
  }
});

await waitForHealth();
process.stdout.write(
  `Local E2E stack ready: API ${API_PORT}, auth ${AUTH_PORT}, PostgreSQL ${PG_PORT}.\n`,
);
