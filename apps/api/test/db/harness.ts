import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/**
 * Minimal stand-in for the pieces Supabase owns. Migrations only reference
 * `auth.users` and the `authenticated` role; everything else is our own SQL.
 */
const AUTH_SHIM = `
create schema auth;
create table auth.users (
  id uuid primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);
create role authenticated nologin;
`;

export interface TestDatabase {
  client: PGlite;
  /** Runs with the session's own (superuser) privileges, bypassing RLS. */
  asPostgres<T>(fn: (client: PGlite) => Promise<T>): Promise<T>;
  /** Runs as `authenticated` with the given JWT subject; rolls back unless told to commit. */
  asUser<T>(
    userId: string | null,
    fn: (client: PGlite) => Promise<T>,
    options?: { commit?: boolean },
  ): Promise<T>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  await client.exec(AUTH_SHIM);

  const migrationsDir = resolve(process.cwd(), '../../supabase/migrations');
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();

  if (files.length === 0) {
    throw new Error(`No SQL migrations found in ${migrationsDir}`);
  }

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await client.exec(sql);
  }

  async function asUser<T>(
    userId: string | null,
    fn: (client: PGlite) => Promise<T>,
    options: { commit?: boolean } = {},
  ): Promise<T> {
    await client.exec('begin');
    try {
      await client.exec('set local role authenticated');
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        userId ? JSON.stringify({ sub: userId, role: 'authenticated' }) : '',
      ]);

      const result = await fn(client);

      await client.exec(options.commit ? 'commit' : 'rollback');
      return result;
    } catch (error) {
      await client.exec('rollback');
      throw error;
    }
  }

  return { client, asPostgres: (fn) => fn(client), asUser };
}
