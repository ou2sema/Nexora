import 'reflect-metadata';

import type { ServerEnv } from '@mystock/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { SERVER_ENV } from '../src/config/env.tokens';

describe('API shell', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get<ServerEnv>(SERVER_ENV));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the health endpoint outside the versioned prefix', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('mystock-api');
    expect(typeof response.headers['x-request-id']).toBe('string');
  });

  it('propagates a client supplied request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'client-correlation-1')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('client-correlation-1');
  });

  it('does not expose health under the versioned prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(404);
  });

  it('returns the error envelope with a correlation id for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/missing').expect(404);

    expect(response.body.error.code).toBe('not_found');
    expect(response.body.error.message).toBeTypeOf('string');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('sets hardening headers', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
