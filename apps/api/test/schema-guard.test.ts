import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseHandle } from '../src/database/database.types';
import { assertSchemaCompatible, findMissingSchemaObjects } from '../src/database/schema-guard';

const AUTH_SHIM = `
create schema auth;
create table auth.users (
  id uuid primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);
create role authenticated nologin;
`;

const migrationsDir = resolve(process.cwd(), '../../supabase/migrations');
const openClients: PGlite[] = [];

async function createDatabase(include: (file: string) => boolean): Promise<DatabaseHandle> {
  const client = new PGlite();
  openClients.push(client);
  await client.exec(AUTH_SHIM);

  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) {
    if (!include(file)) continue;
    await client.exec(await readFile(join(migrationsDir, file), 'utf8'));
  }

  return {
    db: drizzle(client) as unknown as DatabaseHandle['db'],
    close: () => client.close(),
  };
}

function silentLogger() {
  return { log: vi.fn(), warn: vi.fn() };
}

afterEach(async () => {
  while (openClients.length > 0) {
    await openClients.pop()?.close();
  }
});

describe('database schema guard', () => {
  it('accepts a database with every migration applied', async () => {
    const handle = await createDatabase(() => true);
    const logger = silentLogger();

    await expect(findMissingSchemaObjects(handle)).resolves.toEqual([]);
    await expect(assertSchemaCompatible(handle, logger)).resolves.toBeUndefined();

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('schema verified'));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('lists objects from migrations the database has not received', async () => {
    const handle = await createDatabase(
      (file) => file.startsWith('20261029120000_') || file.startsWith('20261029121000_'),
    );
    const missing = await findMissingSchemaObjects(handle);

    expect(missing).toContain('public.admin_audit_events');
    expect(missing).toContain('app.is_platform_admin()');
    expect(missing).not.toContain('public.organizations');
    expect(missing).not.toContain('app.create_organization(text, text)');
  });

  it('refuses to start against an out-of-date schema', async () => {
    const handle = await createDatabase((file) => file.startsWith('20261029120000_'));

    await expect(assertSchemaCompatible(handle, silentLogger())).rejects.toThrow(
      /schema is out of date/i,
    );
  });

  it('reports an unreachable database without blocking startup', async () => {
    const unreachable = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    const handle = {
      db: {
        execute: async () => {
          throw unreachable;
        },
      },
      close: async () => undefined,
    } as unknown as DatabaseHandle;
    const logger = silentLogger();

    await expect(assertSchemaCompatible(handle, logger)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('unreachable'));
  });

  it('fails on a server-side error instead of treating it as unreachable', async () => {
    const failure = Object.assign(new Error('schema "app" does not exist'), { code: '3F000' });
    const handle = {
      db: {
        execute: async () => {
          throw failure;
        },
      },
      close: async () => undefined,
    } as unknown as DatabaseHandle;

    await expect(assertSchemaCompatible(handle, silentLogger())).rejects.toThrow(
      /schema check failed/i,
    );
  });
});
