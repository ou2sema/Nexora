import { describe, expect, it } from 'vitest';

import { parseServerEnv, serverEnvSchema } from '../src/env';

const validEnv = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'debug',
  WEB_ORIGIN: 'http://localhost:5173',
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
  SUPABASE_ANON_KEY: 'a'.repeat(40),
  SUPABASE_JWT_ISSUER: 'https://abcdefgh.supabase.co/auth/v1',
  SUPABASE_JWT_AUDIENCE: 'authenticated',
  DATABASE_URL: 'postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres',
  DATABASE_SSL: 'true',
} satisfies NodeJS.ProcessEnv;

describe('parseServerEnv', () => {
  it('parses a minimal valid environment and applies defaults', () => {
    const env = parseServerEnv(validEnv);

    expect(env.API_PORT).toBe(4100);
    expect(env.DATABASE_SSL).toBe(true);
    expect(env.SUPABASE_JWT_AUDIENCE).toBe('authenticated');
    expect(env.RATE_LIMIT_TTL_SECONDS).toBe(60);
    expect(env.RATE_LIMIT_LIMIT).toBe(120);
  });

  it('coerces numeric and boolean strings', () => {
    const env = parseServerEnv({
      ...validEnv,
      API_PORT: '8080',
      DATABASE_SSL: 'false',
      RATE_LIMIT_TTL_SECONDS: '30',
      RATE_LIMIT_LIMIT: '200',
    });

    expect(env.API_PORT).toBe(8080);
    expect(env.DATABASE_SSL).toBe(false);
    expect(env.RATE_LIMIT_TTL_SECONDS).toBe(30);
    expect(env.RATE_LIMIT_LIMIT).toBe(200);
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

  it('does not require a service role key in production but requires TLS', () => {
    const production = serverEnvSchema.safeParse({
      ...validEnv,
      NODE_ENV: 'production',
      DATABASE_SSL: 'true',
    });

    expect(production.success).toBe(true);

    const insecureProduction = serverEnvSchema.safeParse({
      ...validEnv,
      NODE_ENV: 'production',
      DATABASE_SSL: 'false',
    });
    expect(insecureProduction.success).toBe(false);
    const paths = insecureProduction.error?.issues.map((issue) => issue.path.join('.')) ?? [];
    expect(paths).toContain('DATABASE_SSL');
  });
});
