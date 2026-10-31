import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DATABASE } from './database.tokens';
import type { AppTransaction, DatabaseHandle } from './database.types';

/**
 * Every request-scoped query runs inside a transaction that impersonates the
 * caller: `set local role authenticated` plus the claims PostgREST would set.
 * That keeps row-level security authoritative even though the connection
 * itself uses the migration/administration role.
 */
@Injectable()
export class TenantDatabase {
  constructor(@Inject(DATABASE) private readonly handle: DatabaseHandle) {}

  async asUser<T>(
    userId: string,
    fn: (tx: AppTransaction) => Promise<T>,
    options: { email?: string | null } = {},
  ): Promise<T> {
    const claims = JSON.stringify({
      sub: userId,
      role: 'authenticated',
      ...(options.email ? { email: options.email } : {}),
    });

    return this.handle.db.transaction(async (tx) => {
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
      return fn(tx);
    });
  }
}
