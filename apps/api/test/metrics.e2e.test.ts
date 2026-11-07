import 'reflect-metadata';

import { parseServerEnv, type ServerEnv } from '@mystock/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { SERVER_ENV } from '../src/config/env.tokens';

const TOKEN = 'test-metrics-token-0123456789';

async function createApp(envOverrides: Partial<ServerEnv> = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  if (Object.keys(envOverrides).length > 0) {
    builder
      .overrideProvider(SERVER_ENV)
      .useValue({ ...parseServerEnv(process.env), ...envOverrides });
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, app.get<ServerEnv>(SERVER_ENV));
  await app.init();

  return app;
}

describe('metrics endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves Prometheus text outside the versioned prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);

    const response = await request(app.getHttpServer()).get('/metrics').expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toContain('nexora_http_requests_total');
    expect(response.text).toContain('nexora_http_request_duration_seconds_bucket');
    expect(response.text).toContain('nexora_http_requests_in_flight');
    expect(response.text).toContain('nexora_process_resident_memory_bytes');
    expect(response.text).toContain('nexora_build_info');
    expect(response.text).toMatch(/nexora_http_requests_total\{[^}]*route="\/health"/);
  });

  it('does not expose metrics under the versioned prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/metrics').expect(404);
  });

  it('labels unknown paths without putting the raw URL in a series', async () => {
    await request(app.getHttpServer()).get('/api/v1/unknown/42').expect(404);

    const response = await request(app.getHttpServer()).get('/metrics').expect(200);

    expect(response.text).toContain('route="unmatched"');
    expect(response.text).not.toContain('/api/v1/unknown/42');
  });
});

describe('metrics endpoint with a token', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp({ METRICS_TOKEN: TOKEN });
  });

  afterAll(async () => {
    await app.close();
  });

  it('hides the endpoint without a credential', async () => {
    await request(app.getHttpServer()).get('/metrics').expect(404);
  });

  it('rejects a wrong bearer token', async () => {
    await request(app.getHttpServer())
      .get('/metrics')
      .set('authorization', 'Bearer wrong-token-0123456789')
      .expect(404);
  });

  it('accepts the bearer token Prometheus sends', async () => {
    const response = await request(app.getHttpServer())
      .get('/metrics')
      .set('authorization', `Bearer ${TOKEN}`)
      .expect(200);

    expect(response.text).toContain('nexora_http_requests_total');
  });

  it('accepts the x-metrics-token header', async () => {
    await request(app.getHttpServer()).get('/metrics').set('x-metrics-token', TOKEN).expect(200);
  });
});

describe('metrics endpoint in production without a token', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp({ NODE_ENV: 'production', METRICS_TOKEN: undefined });
  });

  afterAll(async () => {
    await app.close();
  });

  it('fails closed', async () => {
    await request(app.getHttpServer()).get('/metrics').expect(404);
  });
});
