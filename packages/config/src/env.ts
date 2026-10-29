import { z } from 'zod';

const booleanish = z.enum(['true', 'false']).transform((value) => value === 'true');

const databaseUrl = z
  .string()
  .min(1)
  .refine((value) => /^postgres(ql)?:\/\//.test(value), {
    message: 'must be a postgresql:// connection string',
  });

const cronExpression = z
  .string()
  .trim()
  .regex(/^(\S+\s+){4}\S+$/, { message: 'must be a 5-field cron expression' });

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    API_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    WEB_ORIGIN: z.url(),

    SUPABASE_URL: z.url(),
    SUPABASE_ANON_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    SUPABASE_JWT_ISSUER: z.url(),
    SUPABASE_JWT_AUDIENCE: z.string().min(1).default('authenticated'),

    DATABASE_URL: databaseUrl,
    DATABASE_SSL: booleanish.default(true),

    ALLOW_NEGATIVE_STOCK: booleanish.default(false),
    IDEMPOTENCY_KEY_TTL_HOURS: z.coerce.number().int().positive().default(24),
    RECONCILIATION_CRON: cronExpression.default('0 2 * * *'),

    SUPABASE_STORAGE_BUCKET: z.string().min(3),
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 * 1024),

    RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(120),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') {
      return;
    }
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'is required in production',
      });
    }
    if (!env.DATABASE_SSL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_SSL'],
        message: 'must remain enabled in production',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

export function parseServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${formatIssues(result.error)}`);
  }
  return result.data;
}
