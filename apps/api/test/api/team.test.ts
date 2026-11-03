import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, USERS } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const ERIN = '00000000-0000-4000-8000-00000000000e';

describe('team access', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let daveToken: string;
  let bobToken: string;
  let erinToken: string;
  let carolToken: string;

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const membersUrl = `/api/v1/organizations/${ORGS.a}/members`;
  const invitationsUrl = `/api/v1/organizations/${ORGS.a}/invitations`;

  beforeAll(async () => {
    ctx = await createTestContext();

    await ctx.database.exec(`
      insert into auth.users (id, email) values ('${ERIN}', 'erin@example.com');
      insert into public.memberships (organization_id, user_id, role)
      values ('${ORGS.a}', '${ERIN}', 'admin');
    `);

    aliceToken = await ctx.tokenFor(USERS.alice, { email: 'alice@example.com' });
    daveToken = await ctx.tokenFor(USERS.dave, { email: 'dave@example.com' });
    bobToken = await ctx.tokenFor(USERS.bob, { email: 'bob@example.com' });
    erinToken = await ctx.tokenFor(ERIN, { email: 'erin@example.com' });
    carolToken = await ctx.tokenFor(USERS.carol, { email: 'carol@example.com' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists members with emails for any member and hides the org from outsiders', async () => {
    const aliceView = await request(server())
      .get(membersUrl)
      .set('authorization', auth(aliceToken));
    const daveView = await request(server()).get(membersUrl).set('authorization', auth(daveToken));
    const bobView = await request(server()).get(membersUrl).set('authorization', auth(bobToken));

    expect(aliceView.status).toBe(200);
    expect(aliceView.body.items).toEqual([
      {
        userId: USERS.alice,
        email: 'alice@example.com',
        role: 'owner',
        joinedAt: expect.any(String),
      },
      { userId: ERIN, email: 'erin@example.com', role: 'admin', joinedAt: expect.any(String) },
      {
        userId: USERS.dave,
        email: 'dave@example.com',
        role: 'viewer',
        joinedAt: expect.any(String),
      },
    ]);
    expect(daveView.status).toBe(200);
    expect(daveView.body.items).toHaveLength(3);
    expect(bobView.status).toBe(404);
    expect(bobView.body.error.code).toBe('organization_not_found');
  });

  it('keeps invitations and role management away from viewers', async () => {
    const invitations = await request(server())
      .get(invitationsUrl)
      .set('authorization', auth(daveToken));
    const invite = await request(server())
      .post(invitationsUrl)
      .set('authorization', auth(daveToken))
      .send({ email: 'new@example.com', role: 'viewer' });
    const change = await request(server())
      .patch(`${membersUrl}/${USERS.dave}`)
      .set('authorization', auth(daveToken))
      .send({ role: 'manager' });

    expect(invitations.status).toBe(403);
    expect(invite.status).toBe(403);
    expect(change.status).toBe(403);
    expect(change.body.error.message).toBe('Your role does not allow this action.');
  });

  it('lets an owner invite and refuses duplicates and owner grants', async () => {
    const created = await request(server())
      .post(invitationsUrl)
      .set('authorization', auth(aliceToken))
      .send({ email: ' Carol@Example.com ', role: 'manager' });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      email: 'carol@example.com',
      role: 'manager',
      status: 'pending',
      invitedByEmail: 'alice@example.com',
    });

    const duplicate = await request(server())
      .post(invitationsUrl)
      .set('authorization', auth(aliceToken))
      .send({ email: 'carol@example.com', role: 'viewer' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('invitation_already_pending');

    const owner = await request(server())
      .post(invitationsUrl)
      .set('authorization', auth(aliceToken))
      .send({ email: 'someone@example.com', role: 'owner' });
    expect(owner.status).toBe(400);
    expect(owner.body.error.code).toBe('validation_error');

    const member = await request(server())
      .post(invitationsUrl)
      .set('authorization', auth(aliceToken))
      .send({ email: 'dave@example.com', role: 'viewer' });
    expect(member.status).toBe(409);
    expect(member.body.error.code).toBe('already_member');
  });

  it('shows the invitation history to admins only', async () => {
    const response = await request(server())
      .get(invitationsUrl)
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      expect.objectContaining({
        email: 'carol@example.com',
        role: 'manager',
        status: 'pending',
        invitedByEmail: 'alice@example.com',
      }),
    ]);
  });

  it('lists pending invitations only for the matching signed-in email', async () => {
    const withEmail = await request(server())
      .get('/api/v1/me/invitations')
      .set('authorization', auth(carolToken));
    const daveSees = await request(server())
      .get('/api/v1/me/invitations')
      .set('authorization', auth(daveToken));
    const withoutEmail = await ctx.tokenFor(USERS.carol);
    const anonymousEmail = await request(server())
      .get('/api/v1/me/invitations')
      .set('authorization', auth(withoutEmail));

    expect(withEmail.status).toBe(200);
    expect(withEmail.body.items).toEqual([
      {
        id: expect.any(String),
        organizationId: ORGS.a,
        organizationName: 'Org A',
        organizationSlug: 'org-a',
        role: 'manager',
        expiresAt: expect.any(String),
      },
    ]);
    expect(daveSees.body.items).toEqual([]);
    expect(anonymousEmail.body.items).toEqual([]);
  });

  it('rejects acceptance by a different email and accepts for the invitee', async () => {
    const pending = await request(server())
      .get('/api/v1/me/invitations')
      .set('authorization', auth(carolToken));
    const invitationId = pending.body.items[0].id as string;

    const wrongAccount = await request(server())
      .post(`/api/v1/me/invitations/${invitationId}/acceptance`)
      .set('authorization', auth(daveToken));
    expect(wrongAccount.status).toBe(403);
    expect(wrongAccount.body.error.code).toBe('invitation_email_mismatch');

    const accepted = await request(server())
      .post(`/api/v1/me/invitations/${invitationId}/acceptance`)
      .set('authorization', auth(carolToken));
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({
      organizationId: ORGS.a,
      organizationName: 'Org A',
      organizationSlug: 'org-a',
      role: 'manager',
      logo: null,
    });

    const me = await request(server()).get('/api/v1/me').set('authorization', auth(carolToken));
    expect(me.body.memberships).toEqual([
      expect.objectContaining({ organizationId: ORGS.a, role: 'manager' }),
    ]);

    const reinvite = await request(server())
      .post(invitationsUrl)
      .set('authorization', auth(aliceToken))
      .send({ email: 'carol@example.com', role: 'viewer' });
    expect(reinvite.status).toBe(409);
    expect(reinvite.body.error.code).toBe('already_member');
  });

  it('enforces the owner hierarchy for admins', async () => {
    const demoteOwner = await request(server())
      .patch(`${membersUrl}/${USERS.alice}`)
      .set('authorization', auth(erinToken))
      .send({ role: 'viewer' });
    const removeOwner = await request(server())
      .delete(`${membersUrl}/${USERS.alice}`)
      .set('authorization', auth(erinToken));
    const promoteOwner = await request(server())
      .patch(`${membersUrl}/${USERS.dave}`)
      .set('authorization', auth(erinToken))
      .send({ role: 'owner' });

    expect(demoteOwner.status).toBe(403);
    expect(demoteOwner.body.error.code).toBe('owner_required');
    expect(removeOwner.status).toBe(403);
    expect(removeOwner.body.error.code).toBe('owner_required');
    expect(promoteOwner.status).toBe(403);
    expect(promoteOwner.body.error.code).toBe('owner_required');

    const manage = await request(server())
      .patch(`${membersUrl}/${USERS.dave}`)
      .set('authorization', auth(erinToken))
      .send({ role: 'manager' });
    expect(manage.status).toBe(200);
    expect(manage.body.role).toBe('manager');
  });

  it('changes roles, protects the last owner, and removes members', async () => {
    const demoted = await request(server())
      .patch(`${membersUrl}/${USERS.carol}`)
      .set('authorization', auth(aliceToken))
      .send({ role: 'viewer' });
    expect(demoted.status).toBe(200);
    expect(demoted.body).toMatchObject({ userId: USERS.carol, role: 'viewer' });

    const lastOwner = await request(server())
      .patch(`${membersUrl}/${USERS.alice}`)
      .set('authorization', auth(aliceToken))
      .send({ role: 'viewer' });
    expect(lastOwner.status).toBe(400);
    expect(lastOwner.body.error.message).toBe('An organization must keep at least one owner.');

    const removed = await request(server())
      .delete(`${membersUrl}/${USERS.dave}`)
      .set('authorization', auth(aliceToken));
    expect(removed.status).toBe(204);

    const daveView = await request(server()).get(membersUrl).set('authorization', auth(daveToken));
    expect(daveView.status).toBe(404);

    const missing = await request(server())
      .delete(`${membersUrl}/${USERS.dave}`)
      .set('authorization', auth(aliceToken));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('not_found');
    expect(missing.body.error.message).toBe('Team member not found.');
  });

  it('revokes a pending invitation and refuses a second revocation', async () => {
    const created = await request(server())
      .post(invitationsUrl)
      .set('authorization', auth(aliceToken))
      .send({ email: 'temp@example.com', role: 'viewer' });
    const invitationId = created.body.id as string;

    const revoked = await request(server())
      .post(`${invitationsUrl}/${invitationId}/revocation`)
      .set('authorization', auth(aliceToken));
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({ status: 'revoked', email: 'temp@example.com' });

    const again = await request(server())
      .post(`${invitationsUrl}/${invitationId}/revocation`)
      .set('authorization', auth(aliceToken));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('invitation_not_pending');

    const history = await request(server())
      .get(invitationsUrl)
      .set('authorization', auth(aliceToken));
    const entry = (history.body.items as { email: string; status: string }[]).find(
      (item) => item.email === 'temp@example.com',
    );
    expect(entry?.status).toBe('revoked');
  });
});
