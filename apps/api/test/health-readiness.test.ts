import { describe, expect, it } from 'vitest';

import type { DatabaseHandle } from '../src/database/database.types';
import type { DocumentPrinterService } from '../src/documents/print/document-printer.service';
import { RENDERER_PROBE_TIMEOUT_MS } from '../src/documents/print/document-printer.service';
import { DATABASE_PROBE_TIMEOUT_MS, ReadinessService } from '../src/health/readiness.service';

function handleWith(execute: () => Promise<unknown>): DatabaseHandle {
  return {
    db: { execute } as unknown as DatabaseHandle['db'],
    close: async () => undefined,
  };
}

type ProbeResult = { ok: boolean; latencyMs: number; error: string | null };

const READY: ProbeResult = { ok: true, latencyMs: 3, error: null };
const MISSING_BROWSER: ProbeResult = {
  ok: false,
  latencyMs: 5_000,
  error: 'browserType.launch: Executable does not exist',
};

function serviceWith(probe: ProbeResult, execute = async (): Promise<unknown> => [{}]) {
  const printer = { probe: async () => probe } as unknown as DocumentPrinterService;

  return new ReadinessService(handleWith(execute), printer);
}

describe('readiness database check', () => {
  it('reports the pool as up with a latency', async () => {
    const service = serviceWith(READY, async () => [{ '?column?': 1 }]);

    await expect(service.checkDatabase()).resolves.toEqual({
      status: 'up',
      latencyMs: expect.any(Number),
    });
  });

  it('classifies a refused connection as unreachable', async () => {
    const service = serviceWith(READY, async () => {
      throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
        code: 'ECONNREFUSED',
      });
    });

    await expect(service.checkDatabase()).resolves.toEqual({
      status: 'down',
      reason: 'unreachable',
    });
  });

  it('gives a stuck pool its own deadline instead of the driver timeout', async () => {
    const service = serviceWith(READY, () => new Promise(() => undefined));

    await expect(service.checkDatabase(25)).resolves.toEqual({
      status: 'down',
      reason: 'timeout',
    });
  });

  it('reports any other failure as an error', async () => {
    const service = serviceWith(READY, async () => {
      throw new Error('permission denied for relation pg_class');
    });

    await expect(service.checkDatabase()).resolves.toEqual({ status: 'down', reason: 'error' });
  });

  it('keeps a generous default deadline so probes survive a cold pool', () => {
    expect(DATABASE_PROBE_TIMEOUT_MS).toBeGreaterThanOrEqual(1000);
  });
});

describe('readiness renderer check', () => {
  it('reports the browser as up when the probe answers', async () => {
    await expect(serviceWith(READY).checkRenderer()).resolves.toEqual({
      status: 'up',
      latencyMs: 3,
    });
  });

  it('carries what the renderer said into the reason', async () => {
    await expect(serviceWith(MISSING_BROWSER).checkRenderer()).resolves.toEqual({
      status: 'down',
      error: 'browserType.launch: Executable does not exist',
    });
  });

  it('proves the renderer without touching the pool', async () => {
    const service = serviceWith(READY, async () => {
      throw new Error('the pool was not asked');
    });

    await expect(service.checkRenderer()).resolves.toMatchObject({ status: 'up' });
  });

  it('keeps a deadline an orchestrator can poll inside', () => {
    expect(RENDERER_PROBE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(RENDERER_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});
