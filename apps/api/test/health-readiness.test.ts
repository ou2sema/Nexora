import { describe, expect, it } from 'vitest';

import type { DatabaseHandle } from '../src/database/database.types';
import { DATABASE_PROBE_TIMEOUT_MS, ReadinessService } from '../src/health/readiness.service';

function handleWith(execute: () => Promise<unknown>): DatabaseHandle {
  return {
    db: { execute } as unknown as DatabaseHandle['db'],
    close: async () => undefined,
  };
}

describe('readiness database check', () => {
  it('reports the pool as up with a latency', async () => {
    const service = new ReadinessService(handleWith(async () => [{ '?column?': 1 }]));

    await expect(service.checkDatabase()).resolves.toEqual({
      status: 'up',
      latencyMs: expect.any(Number),
    });
  });

  it('classifies a refused connection as unreachable', async () => {
    const service = new ReadinessService(
      handleWith(async () => {
        throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
          code: 'ECONNREFUSED',
        });
      }),
    );

    await expect(service.checkDatabase()).resolves.toEqual({
      status: 'down',
      reason: 'unreachable',
    });
  });

  it('gives a stuck pool its own deadline instead of the driver timeout', async () => {
    const service = new ReadinessService(handleWith(() => new Promise(() => undefined)));

    await expect(service.checkDatabase(25)).resolves.toEqual({
      status: 'down',
      reason: 'timeout',
    });
  });

  it('reports any other failure as an error', async () => {
    const service = new ReadinessService(
      handleWith(async () => {
        throw new Error('permission denied for relation pg_class');
      }),
    );

    await expect(service.checkDatabase()).resolves.toEqual({ status: 'down', reason: 'error' });
  });

  it('keeps a generous default deadline so probes survive a cold pool', () => {
    expect(DATABASE_PROBE_TIMEOUT_MS).toBeGreaterThanOrEqual(1000);
  });
});
