import { describe, expect, it } from 'vitest';

import { parseServerEnv, serverEnvSchema } from '../src/env';

const validEnv = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'debug',
  WEB_ORIGIN: 'http://localhost:5173',
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
  SUPABASE_ANON_KEY: 'a'.repeat(40),
  SUPABASE_SERVICE_ROLE_KEY: 'b'.repeat(40),
  SUPABASE_JWT_ISSUER: 'https://abcdefgh.supabase.co/auth/v1',
  SUPABASE_JWT_AUDIENCE: 'authenticated',
  DATABASE_URL: 'postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres',
  DATABASE_SSL: 'true',
  SUPABASE_STORAGE_BUCKET: 'mystock-private',
} satisfies NodeJS.ProcessEnv;

describe('parseServerEnv', () => {
  it('parses a minimal valid environment and applies defaults', () => {
    const env = parseServerEnv(validEnv);

    expect(env.API_PORT).toBe(4100);
    expect(env.DATABASE_SSL).toBe(true);
    expect(env.ALLOW_NEGATIVE_STOCK).toBe(false);
    expect(env.IDEMPOTENCY_KEY_TTL_HOURS).toBe(24);
    expect(env.SUPABASE_JWT_AUDIENCE).toBe('authenticated');
    expect(env.RECONCILIATION_CRON).toBe('0 2 * * *');
  });

  it('coerces numeric and boolean strings', () => {
    const env = parseServerEnv({
      ...validEnv,
      API_PORT: '8080',
      DATABASE_SSL: 'false',
      ALLOW_NEGATIVE_STOCK: 'true',
      MAX_UPLOAD_BYTES: '2048',
    });

    expect(env.API_PORT).toBe(8080);
    expect(env.DATABASE_SSL).toBe(false);
    expect(env.ALLOW_NEGATIVE_STOCK).toBe(true);
    expect(env.MAX_UPLOAD_BYTES).toBe(2048);
  });

  it('rejects a missing required value and names the field', () => {
    const { WEB_ORIGIN: _omitted, ...incomplete } = validEnv;

    expect(() => parseServerEnv(incomplete)).toThrowError(/WEB_ORIGIN/);
  });

  it('rejects a non-postgres connection string', () => {
    expect(() =>
      parseServerEnv({ ...validEnv, DATABASE_URL: 'mysql://root@localhost/db' }),
    ).toThrowError(/DATABASE_URL/);
  });

  it('rejects an invalid URL', () => {
    expect(() => parseServerEnv({ ...validEnv, SUPABASE_URL: 'not-a-url' })).toThrowError(
      /SUPABASE_URL/,
    );
  });

  it('rejects a non-boolean flag', () => {
    expect(() => parseServerEnv({ ...validEnv, DATABASE_SSL: 'yes-please' })).toThrowError(
      /DATABASE_SSL/,
    );
  });

  it('requires the service role key and TLS in production', () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _omitted, ...withoutServiceRole } = validEnv;

    const production = serverEnvSchema.safeParse({
      ...withoutServiceRole,
      NODE_ENV: 'production',
      DATABASE_SSL: 'false',
    });

    expect(production.success).toBe(false);
    const paths = production.error?.issues.map((issue) => issue.path.join('.')) ?? [];
    expect(paths).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(paths).toContain('DATABASE_SSL');
  });

  it('rejects a malformed cron expression', () => {
    expect(() => parseServerEnv({ ...validEnv, RECONCILIATION_CRON: 'every night' })).toThrowError(
      /RECONCILIATION_CRON/,
    );
  });
});
