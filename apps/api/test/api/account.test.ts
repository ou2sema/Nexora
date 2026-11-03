import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { USERS } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const PLATFORM_ADMIN = '00000000-0000-4000-8000-0000000000f0';

describe('authentication', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();

    await ctx.database.exec(`
      insert into auth.users (id, email) values ('${PLATFORM_ADMIN}', 'operator@example.com');
      update public.profiles set is_platform_admin = true where id = '${PLATFORM_ADMIN}';
    `);
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
    expect(response.body.user).toEqual({
      id: USERS.alice,
      email: 'alice@example.com',
      platformAdmin: false,
    });
    expect(response.body.memberships).toEqual([
      {
        organizationId: '10000000-0000-4000-8000-00000000000a',
        organizationName: 'Org A',
        organizationSlug: 'org-a',
        role: 'owner',
        logo: null,
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

  it('reports the platform admin flag', async () => {
    const token = await ctx.tokenFor(PLATFORM_ADMIN, { email: 'operator@example.com' });

    const response = await request(ctx.app.getHttpServer())
      .get('/api/v1/me')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: PLATFORM_ADMIN,
      email: 'operator@example.com',
      platformAdmin: true,
    });
    expect(response.body.memberships).toEqual([]);
  });

  it('creates an organization owned by the platform admin', async () => {
    const token = await ctx.tokenFor(PLATFORM_ADMIN);

    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Operator Trading' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Operator Trading',
      slug: 'operator-trading',
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

  it('refuses organization creation without the platform flag', async () => {
    const token = await ctx.tokenFor(USERS.carol);

    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Carol Trading' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('platform_admin_required');
  });

  it('invites the chosen first member for the new organization', async () => {
    const token = await ctx.tokenFor(PLATFORM_ADMIN);

    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({
        name: 'Invite Org',
        firstMemberEmail: 'carol@example.com',
        firstMemberRole: 'manager',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: 'Invite Org', role: 'owner' });

    const carolToken = await ctx.tokenFor(USERS.carol, { email: 'carol@example.com' });
    const pending = await request(ctx.app.getHttpServer())
      .get('/api/v1/me/invitations')
      .set('authorization', `Bearer ${carolToken}`);

    expect(pending.status).toBe(200);
    expect(pending.body.items).toEqual([
      expect.objectContaining({
        organizationId: response.body.id,
        organizationName: 'Invite Org',
        role: 'manager',
      }),
    ]);
  });

  it('rejects a duplicate organization slug', async () => {
    const token = await ctx.tokenFor(PLATFORM_ADMIN);

    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Another Operator', slug: 'operator-trading' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('conflict');
  });

  it('validates the organization payload', async () => {
    const token = await ctx.tokenFor(PLATFORM_ADMIN);

    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });
});
