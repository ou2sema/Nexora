import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { USERS } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

describe('authentication', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('keeps the health endpoint public', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('rejects requests without a bearer token', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('unauthenticated');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('rejects malformed tokens, wrong audiences, expired tokens and foreign keys', async () => {
    const server = ctx.app.getHttpServer();

    const malformed = await request(server)
      .get('/api/v1/me')
      .set('authorization', 'Bearer not-a-jwt');
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe('invalid_token');

    const wrongAudience = await ctx.tokenFor(USERS.alice, { audience: 'another-service' });
    const wrongAudienceResponse = await request(server)
      .get('/api/v1/me')
      .set('authorization', `Bearer ${wrongAudience}`);
    expect(wrongAudienceResponse.status).toBe(401);

    const expired = await ctx.tokenFor(USERS.alice, { expiresIn: '-1m' });
    const expiredResponse = await request(server)
      .get('/api/v1/me')
      .set('authorization', `Bearer ${expired}`);
    expect(expiredResponse.status).toBe(401);

    const forged = await ctx.tokenFor(USERS.alice, { signWith: 'attacker' });
    const forgedResponse = await request(server)
      .get('/api/v1/me')
      .set('authorization', `Bearer ${forged}`);
    expect(forgedResponse.status).toBe(401);
  });

  it('returns the caller and their memberships', async () => {
    const token = await ctx.tokenFor(USERS.alice, { email: 'alice@example.com' });

    const response = await request(ctx.app.getHttpServer())
      .get('/api/v1/me')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ id: USERS.alice, email: 'alice@example.com' });
    expect(response.body.memberships).toEqual([
      {
        organizationId: '10000000-0000-4000-8000-00000000000a',
        organizationName: 'Org A',
        organizationSlug: 'org-a',
        role: 'owner',
      },
    ]);
  });

  it('reports a viewer role and an empty list for users without memberships', async () => {
    const server = ctx.app.getHttpServer();

    const daveToken = await ctx.tokenFor(USERS.dave);
    const dave = await request(server)
      .get('/api/v1/me')
      .set('authorization', `Bearer ${daveToken}`);
    expect(dave.body.memberships[0].role).toBe('viewer');

    const carolToken = await ctx.tokenFor(USERS.carol);
    const carol = await request(server)
      .get('/api/v1/me')
      .set('authorization', `Bearer ${carolToken}`);
    expect(carol.status).toBe(200);
    expect(carol.body.memberships).toEqual([]);
  });

  it('creates an organization owned by the caller', async () => {
    const token = await ctx.tokenFor(USERS.carol);

    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Carol Trading' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Carol Trading',
      slug: 'carol-trading',
      role: 'owner',
    });

    const me = await request(ctx.app.getHttpServer())
      .get('/api/v1/me')
      .set('authorization', `Bearer ${token}`);
    expect(me.body.memberships).toHaveLength(1);
    expect(me.body.memberships[0]).toMatchObject({
      organizationId: response.body.id,
      role: 'owner',
    });
  });

  it('rejects a duplicate organization slug', async () => {
    const token = await ctx.tokenFor(USERS.carol);

    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Another Carol', slug: 'carol-trading' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('conflict');
  });

  it('validates the organization payload', async () => {
    const token = await ctx.tokenFor(USERS.carol);

    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });
});
