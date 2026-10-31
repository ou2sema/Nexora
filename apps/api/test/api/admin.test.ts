import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, USERS } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const PAT = '00000000-0000-4000-8000-0000000000f0';
const GINA = '00000000-0000-4000-8000-0000000000f2';

describe('platform administration', () => {
  let ctx: TestContext;
  let patToken: string;
  let ginaToken: string;
  let aliceToken: string;
  let bobToken: string;
  let carolToken: string;

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    ctx = await createTestContext();

    await ctx.database.exec(`
      insert into auth.users (id, email) values
        ('${PAT}', 'operator@example.com'),
        ('${GINA}', 'gina@example.com');

      update public.profiles set is_platform_admin = true where id = '${PAT}';

      insert into public.memberships (organization_id, user_id, role) values
        ('${ORGS.a}', '${GINA}', 'manager');
    `);

    patToken = await ctx.tokenFor(PAT, { email: 'operator@example.com' });
    ginaToken = await ctx.tokenFor(GINA, { email: 'gina@example.com' });
    aliceToken = await ctx.tokenFor(USERS.alice, { email: 'alice@example.com' });
    bobToken = await ctx.tokenFor(USERS.bob, { email: 'bob@example.com' });
    carolToken = await ctx.tokenFor(USERS.carol, { email: 'carol@example.com' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists every organization for platform admins only', async () => {
    const forbidden = await request(server())
      .get('/api/v1/admin/organizations')
      .set('authorization', auth(aliceToken));
    const listed = await request(server())
      .get('/api/v1/admin/organizations')
      .set('authorization', auth(patToken));

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('platform_admin_required');

    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual([
      {
        id: ORGS.a,
        name: 'Org A',
        slug: 'org-a',
        createdAt: expect.any(String),
        memberCount: 3,
        pendingInvitationCount: 0,
      },
      {
        id: ORGS.b,
        name: 'Org B',
        slug: 'org-b',
        createdAt: expect.any(String),
        memberCount: 1,
        pendingInvitationCount: 0,
      },
    ]);
  });

  it('manages team access in an organization it does not belong to', async () => {
    await ctx.database.exec(`
      insert into public.memberships (organization_id, user_id, role)
      values ('${ORGS.b}', '${USERS.carol}', 'viewer');
    `);

    const members = await request(server())
      .get(`/api/v1/organizations/${ORGS.b}/members`)
      .set('authorization', auth(patToken));
    expect(members.status).toBe(200);
    expect(members.body.items.map((item: { email: string | null }) => item.email)).toEqual([
      'bob@example.com',
      'carol@example.com',
    ]);

    const invitation = await request(server())
      .post(`/api/v1/organizations/${ORGS.b}/invitations`)
      .set('authorization', auth(patToken))
      .send({ email: 'nextmanager@example.com', role: 'manager' });
    expect(invitation.status).toBe(201);
    expect(invitation.body).toMatchObject({
      email: 'nextmanager@example.com',
      role: 'manager',
      status: 'pending',
      invitedByEmail: 'operator@example.com',
    });

    const changed = await request(server())
      .patch(`/api/v1/organizations/${ORGS.b}/members/${USERS.carol}`)
      .set('authorization', auth(patToken))
      .send({ role: 'manager' });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ userId: USERS.carol, role: 'manager' });

    const removed = await request(server())
      .delete(`/api/v1/organizations/${ORGS.b}/members/${USERS.carol}`)
      .set('authorization', auth(patToken));
    expect(removed.status).toBe(204);

    const me = await request(server()).get('/api/v1/me').set('authorization', auth(carolToken));
    expect(me.body.memberships).toEqual([]);
  });

  it('remains subject to the last-owner guard', async () => {
    const demote = await request(server())
      .patch(`/api/v1/organizations/${ORGS.b}/members/${USERS.bob}`)
      .set('authorization', auth(patToken))
      .send({ role: 'viewer' });
    const remove = await request(server())
      .delete(`/api/v1/organizations/${ORGS.b}/members/${USERS.bob}`)
      .set('authorization', auth(patToken));

    expect(demote.status).toBe(400);
    expect(demote.body.error.message).toBe('An organization must keep at least one owner.');
    expect(remove.status).toBe(400);
    expect(remove.body.error.message).toBe('An organization must keep at least one owner.');
  });

  it('refuses team access to outsiders', async () => {
    const response = await request(server())
      .get(`/api/v1/organizations/${ORGS.a}/members`)
      .set('authorization', auth(bobToken));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('organization_not_found');
  });

  it('lets a manager invite viewers and read invitations but not manage members', async () => {
    const invitations = await request(server())
      .get(`/api/v1/organizations/${ORGS.a}/invitations`)
      .set('authorization', auth(ginaToken));
    expect(invitations.status).toBe(200);

    const viewer = await request(server())
      .post(`/api/v1/organizations/${ORGS.a}/invitations`)
      .set('authorization', auth(ginaToken))
      .send({ email: 'manager-viewer@example.com', role: 'viewer' });
    expect(viewer.status).toBe(201);
    expect(viewer.body).toMatchObject({ role: 'viewer', status: 'pending' });

    const manager = await request(server())
      .post(`/api/v1/organizations/${ORGS.a}/invitations`)
      .set('authorization', auth(ginaToken))
      .send({ email: 'manager-peer@example.com', role: 'manager' });
    expect(manager.status).toBe(403);
    expect(manager.body.error.code).toBe('manager_invites_viewers_only');

    const change = await request(server())
      .patch(`/api/v1/organizations/${ORGS.a}/members/${USERS.alice}`)
      .set('authorization', auth(ginaToken))
      .send({ role: 'viewer' });
    expect(change.status).toBe(403);
    expect(change.body.error.code).toBe('forbidden');

    const remove = await request(server())
      .delete(`/api/v1/organizations/${ORGS.a}/members/${USERS.alice}`)
      .set('authorization', auth(ginaToken));
    expect(remove.status).toBe(403);

    const revoke = await request(server())
      .post(`/api/v1/organizations/${ORGS.a}/invitations/${viewer.body.id}/revocation`)
      .set('authorization', auth(ginaToken));
    expect(revoke.status).toBe(403);
  });

  it('reflects pending invitations in the administration list', async () => {
    const response = await request(server())
      .get('/api/v1/admin/organizations')
      .set('authorization', auth(patToken));

    expect(response.status).toBe(200);
    const items = response.body.items as {
      id: string;
      memberCount: number;
      pendingInvitationCount: number;
    }[];
    const orgA = items.find((item) => item.id === ORGS.a);
    const orgB = items.find((item) => item.id === ORGS.b);

    expect(orgA).toMatchObject({ memberCount: 3, pendingInvitationCount: 1 });
    expect(orgB).toMatchObject({ memberCount: 1, pendingInvitationCount: 1 });
  });

  it('exposes the operator audit trail to platform admins only', async () => {
    const forbidden = await request(server())
      .get('/api/v1/admin/audit')
      .set('authorization', auth(aliceToken));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('platform_admin_required');

    const response = await request(server())
      .get('/api/v1/admin/audit')
      .set('authorization', auth(patToken));
    expect(response.status).toBe(200);

    const items = response.body.items as {
      action: string;
      actorEmail: string | null;
      organizationName: string | null;
      targetEmail: string | null;
      detail: Record<string, unknown>;
    }[];

    expect(items.map((item) => item.action).sort()).toEqual([
      'invitation_created',
      'member_removed',
      'member_role_changed',
    ]);
    expect(items.every((item) => item.actorEmail === 'operator@example.com')).toBe(true);

    const invitation = items.find((item) => item.action === 'invitation_created');
    expect(invitation).toMatchObject({
      organizationName: 'Org B',
      targetEmail: 'nextmanager@example.com',
      detail: { role: 'manager' },
    });

    const roleChange = items.find((item) => item.action === 'member_role_changed');
    expect(roleChange).toMatchObject({
      targetEmail: 'carol@example.com',
      detail: { from: 'viewer', to: 'manager' },
    });

    const removal = items.find((item) => item.action === 'member_removed');
    expect(removal).toMatchObject({
      targetEmail: 'carol@example.com',
      detail: { role: 'manager' },
    });

    expect(items.some((item) => item.targetEmail === 'manager-viewer@example.com')).toBe(false);
  });

  it('caps and validates the audit page size', async () => {
    const limited = await request(server())
      .get('/api/v1/admin/audit?limit=1')
      .set('authorization', auth(patToken));
    expect(limited.status).toBe(200);
    expect(limited.body.items).toHaveLength(1);

    const invalid = await request(server())
      .get('/api/v1/admin/audit?limit=0')
      .set('authorization', auth(patToken));
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('validation_error');
  });
});
