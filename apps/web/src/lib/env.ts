import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_API_BASE_URL: z.url(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.map(String).join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid web environment configuration:\n${details}`);
}

export const env = parsed.data;

export const apiOrigin = new URL(env.VITE_API_BASE_URL).origin;
