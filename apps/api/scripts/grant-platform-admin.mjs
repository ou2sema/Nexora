// Grants the platform-administrator flag to an existing profile and records the
// grant in the operator audit trail. Run with the database administration role:
//
//   DATABASE_URL=postgres://... node apps/api/scripts/grant-platform-admin.mjs person@example.com
//
// This is the supported alternative to ad-hoc SQL; it never prints the connection
// string and is idempotent.

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

const email = (process.argv[2] ?? '').trim().toLowerCase();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required (set it in the environment or the repository .env).');
  process.exit(1);
}

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: node apps/api/scripts/grant-platform-admin.mjs <email>');
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

let exitCode = 0;

try {
  const outcome = await sql.begin(async (tx) => {
    const [profile] = await tx`
      select id, email, is_platform_admin
      from public.profiles
      where lower(email) = ${email}
      limit 1
    `;

    if (!profile) {
      return { status: 'missing' };
    }

    if (profile.is_platform_admin) {
      return { status: 'already', profile };
    }

    await tx`
      update public.profiles
      set is_platform_admin = true, updated_at = now()
      where id = ${profile.id}
    `;

    await tx`
      insert into public.admin_audit_events (
        actor_id, action, target_user_id, target_email, detail
      )
      values (
        null,
        'platform_admin_granted',
        ${profile.id},
        ${profile.email},
        jsonb_build_object('source', 'grant-platform-admin.mjs')
      )
    `;

    return { status: 'granted', profile };
  });

  if (outcome.status === 'missing') {
    console.error(`No profile found for ${email}. The person must sign in at least once.`);
    exitCode = 1;
  } else if (outcome.status === 'already') {
    console.log(`${email} is already a platform administrator (${outcome.profile.id}).`);
  } else {
    console.log(`Granted platform administrator to ${email} (${outcome.profile.id}).`);
  }
} catch (error) {
  console.error(
    `Platform administrator grant failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

process.exit(exitCode);
