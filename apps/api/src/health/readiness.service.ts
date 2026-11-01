import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DATABASE } from '../database/database.tokens';
import type { DatabaseHandle } from '../database/database.types';
import { isDatabaseUnreachable } from '../database/schema-guard';

export const DATABASE_PROBE_TIMEOUT_MS = 2000;

export type DatabaseCheck =
  | { status: 'up'; latencyMs: number }
  | { status: 'down'; reason: 'timeout' | 'unreachable' | 'error' };

class ProbeTimeoutError extends Error {}

/**
 * A readiness probe must answer quickly even when the pool is stuck, so the query
 * gets a deadline of its own instead of inheriting the driver's connect timeout.
 * A query that outlives the deadline is swallowed here so its late rejection
 * cannot crash the process.
 */
async function withinDeadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  void Promise.resolve(work).catch(() => undefined);

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new ProbeTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class ReadinessService {
  constructor(@Inject(DATABASE) private readonly handle: DatabaseHandle) {}

  async checkDatabase(timeoutMs: number = DATABASE_PROBE_TIMEOUT_MS): Promise<DatabaseCheck> {
    const startedAt = performance.now();

    try {
      await withinDeadline(this.handle.db.execute(sql.raw('select 1')), timeoutMs);
    } catch (error) {
      if (error instanceof ProbeTimeoutError) {
        return { status: 'down', reason: 'timeout' };
      }
      if (isDatabaseUnreachable(error)) {
        return { status: 'down', reason: 'unreachable' };
      }

      return { status: 'down', reason: 'error' };
    }

    return { status: 'up', latencyMs: Math.round(performance.now() - startedAt) };
  }
}
