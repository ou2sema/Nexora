import type { LoggerService } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { DatabaseHandle } from './database.types';
import { resultRows } from './results';

interface SchemaProbe {
  label: string;
  expression: string;
}

/**
 * Objects the running API assumes exist. Probing by name (instead of reading a
 * migration-history table) also works for the local test stack, which applies the
 * raw SQL without Supabase's bookkeeping.
 */
export const REQUIRED_SCHEMA: readonly SchemaProbe[] = [
  { label: 'public.organizations', expression: "to_regclass('public.organizations')" },
  { label: 'public.memberships', expression: "to_regclass('public.memberships')" },
  { label: 'public.stock_levels', expression: "to_regclass('public.stock_levels')" },
  {
    label: 'public.organization_invitations',
    expression: "to_regclass('public.organization_invitations')",
  },
  { label: 'public.admin_audit_events', expression: "to_regclass('public.admin_audit_events')" },
  { label: 'app.current_user_id()', expression: "to_regprocedure('app.current_user_id()')" },
  { label: 'app.is_platform_admin()', expression: "to_regprocedure('app.is_platform_admin()')" },
  {
    label: 'app.create_organization(text, text)',
    expression: "to_regprocedure('app.create_organization(text,text)')",
  },
  {
    label: 'app.stock_reconciliation(uuid)',
    expression: "to_regprocedure('app.stock_reconciliation(uuid)')",
  },
  {
    label: 'app.repair_stock_balances(uuid, boolean)',
    expression: "to_regprocedure('app.repair_stock_balances(uuid,boolean)')",
  },
];

export async function findMissingSchemaObjects(handle: DatabaseHandle): Promise<string[]> {
  const projection = REQUIRED_SCHEMA.map(
    (probe, index) => `${probe.expression} is not null as present_${index}`,
  ).join(', ');

  const [row] = resultRows<Record<string, boolean>>(
    await handle.db.execute(sql.raw(`select ${projection}`)),
  );

  return REQUIRED_SCHEMA.filter((_, index) => row?.[`present_${index}`] !== true).map(
    (probe) => probe.label,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Socket-level failures mean "no database to inspect"; the API keeps booting so
 * health checks and local shell tests work without Postgres. A reachable database
 * with missing objects is a deployment ordering bug and stops the process.
 */
function isUnreachable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') {
    if (code.startsWith('08')) return true;
    if (
      ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'CONNECT_TIMEOUT'].includes(code)
    ) {
      return true;
    }
  }

  if (error.name === 'AggregateError') {
    const nested = (error as { errors?: unknown[] }).errors ?? [];
    return nested.length > 0 && nested.every((item) => isUnreachable(item));
  }

  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|CONNECT_TIMEOUT/.test(error.message);
}

export async function assertSchemaCompatible(
  handle: DatabaseHandle,
  logger: Pick<LoggerService, 'log' | 'warn'>,
): Promise<void> {
  let missing: string[];

  try {
    missing = await findMissingSchemaObjects(handle);
  } catch (error) {
    if (isUnreachable(error)) {
      logger.warn(
        `Database schema check skipped: database unreachable (${errorMessage(error)}). ` +
          'The API will start; requests fail until the database is available.',
      );
      return;
    }

    throw new Error(
      `Database schema check failed: ${errorMessage(error)}. ` +
        'Apply supabase/migrations before starting the API.',
      { cause: error },
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Database schema is out of date; missing ${missing.join(', ')}. ` +
        'Apply supabase/migrations before starting the API.',
    );
  }

  logger.log(`Database schema verified (${REQUIRED_SCHEMA.length} required objects present).`);
}
