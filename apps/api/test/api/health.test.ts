import type { ServerEnv } from '@mystock/config';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { SERVER_ENV } from '../../src/config/env.tokens';
import { DATABASE } from '../../src/database/database.tokens';
import { createTestContext, type TestContext } from './test-app';

async function appWithDatabase(handle: unknown): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE)
    .useValue(handle)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, app.get<ServerEnv>(SERVER_ENV));
  await app.init();

  return app;
}

describe('health probes', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('answers liveness without touching the database', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'mystock-api' });
    expect(typeof response.body.uptimeSeconds).toBe('number');
    expect(Number.isFinite(Date.parse(response.body.timestamp))).toBe(true);
  });

  it('answers readiness from the pool and reports its latency', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.database.status).toBe('up');
    expect(typeof response.body.database.latencyMs).toBe('number');
    expect(response.headers['x-request-id']).toBeTypeOf('string');
  });

  it('serves both probes outside the versioned prefix only', async () => {
    const server = ctx.app.getHttpServer();

    await request(server).get('/api/v1/health/live').expect(404);
    await request(server).get('/api/v1/health/ready').expect(404);
  });

  it('serves every probe without a bearer token', async () => {
    const server = ctx.app.getHttpServer();

    for (const path of ['/health', '/health/live', '/health/ready']) {
      const response = await request(server).get(path);

      expect(response.status).toBe(200);
    }
  });

  it('reports 503 with the failure reason when the database is down', async () => {
    const app = await appWithDatabase({
      db: {
        execute: async () => {
          throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
            code: 'ECONNREFUSED',
          });
        },
      },
      close: async () => undefined,
    });

    try {
      const live = await request(app.getHttpServer()).get('/health/live');
      const ready = await request(app.getHttpServer()).get('/health/ready');

      expect(live.status).toBe(200);
      expect(ready.status).toBe(503);
      expect(ready.body.error.code).toBe('service_unavailable');
      expect(ready.body.error.details).toMatchObject({ database: 'unreachable' });
      expect(ready.body.error.message).toBe('The database is not answering.');
      expect(JSON.stringify(ready.body)).not.toContain('5432');
      expect(JSON.stringify(ready.body)).not.toContain('ECONNREFUSED');
    } finally {
      await app.close();
    }
  });
});
