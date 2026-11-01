import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, USERS, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const ERIN = '00000000-0000-4000-8000-00000000000e';
const FRANK = '00000000-0000-4000-8000-00000000000f';
const ALICE_EMAIL = 'alice@example.com';
const CAROL_EMAIL = 'carol@example.com';
const DAVE_EMAIL = 'dave@example.com';
const FRANK_EMAIL = 'frank@example.com';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);

  await database.client.exec(`
    insert into auth.users (id, email) values
      ('${ERIN}', 'erin@example.com'),
      ('${FRANK}', '${FRANK_EMAIL}');

    insert into public.memberships (organization_id, user_id, role) values
      ('${ORGS.a}', '${ERIN}', 'admin');
  `);
});

afterAll(async () => {
  await database.client.close();
});

async function createInvitation(userId: string, email: string, role: string) {
  return database.asUser(
    userId,
    (client) =>
      client.query<{ id: string }>(
        'select app.create_organization_invitation($1, $2, $3::app.member_role) as id',
        [ORGS.a, email, role],
      ),
    { commit: true },
  );
}

describe('profiles and invitation identity', () => {
  it('backfills profiles and shares emails only with organization peers', async () => {
    const alicePeers = await database.asUser(USERS.alice, (client) =>
      client.query<{ email: string }>('select email from public.profiles order by email'),
    );
    const bobPeers = await database.asUser(USERS.bob, (client) =>
      client.query<{ email: string }>('select email from public.profiles order by email'),
    );
    const carolSelf = await database.asUser(USERS.carol, (client) =>
      client.query<{ email: string }>('select email from public.profiles order by email'),
    );
    const anonymous = await database.asUser(null, (client) =>
      client.query('select id from public.profiles'),
    );

    expect(alicePeers.rows.map((row) => row.email)).toEqual([
      ALICE_EMAIL,
      DAVE_EMAIL,
      'erin@example.com',
    ]);
    expect(bobPeers.rows.map((row) => row.email)).toEqual(['bob@example.com']);
    expect(carolSelf.rows.map((row) => row.email)).toEqual([CAROL_EMAIL]);
    expect(anonymous.rows).toHaveLength(0);
  });

  it('updates the profile when the auth email changes', async () => {
    await database.client.query('update auth.users set email = $1 where id = $2', [
      'dave.renamed@example.com',
      USERS.dave,
    ]);

    const profile = await database.asUser(USERS.dave, (client) =>
      client.query<{ email: string }>('select email from public.profiles where id = $1', [
        USERS.dave,
      ]),
    );

    expect(profile.rows).toEqual([{ email: 'dave.renamed@example.com' }]);

    await database.client.query('update auth.users set email = $1 where id = $2', [
      DAVE_EMAIL,
      USERS.dave,
    ]);
  });
});

describe('invitations', () => {
  it('lets an owner invite an email with a normalized address and expiry', async () => {
    await createInvitation(USERS.alice, '  Carol@Example.COM ', 'manager');

    const rows = await database.asUser(USERS.alice, (client) =>
      client.query<{
        email: string;
        role: string;
        invited_by: string;
        expires_in: string;
      }>(
        `select email, role, invited_by,
                (expires_at > now() + interval '13 days') as expires_in
         from public.organization_invitations`,
      ),
    );

    expect(rows.rows).toEqual([
      {
        email: CAROL_EMAIL,
        role: 'manager',
        invited_by: USERS.alice,
        expires_in: true,
      },
    ]);
  });

  it('refuses duplicate pending invitations, owner roles, and existing members', async () => {
    await expect(createInvitation(USERS.alice, CAROL_EMAIL, 'viewer')).rejects.toThrow(
      /invitation_already_pending/,
    );
    await expect(createInvitation(USERS.alice, 'new@example.com', 'owner')).rejects.toThrow(
      /invitation_role_owner/,
    );
    await expect(createInvitation(USERS.alice, DAVE_EMAIL, 'viewer')).rejects.toThrow(
      /already_member/,
    );
  });

  it('keeps invitations away from viewers and admin-only for admins', async () => {
    await expect(createInvitation(USERS.dave, 'new@example.com', 'viewer')).rejects.toThrow(
      /forbidden/,
    );

    const viewerRows = await database.asUser(USERS.dave, (client) =>
      client.query('select id from public.organization_invitations'),
    );
    const adminRows = await database.asUser(ERIN, (client) =>
      client.query('select id from public.organization_invitations'),
    );

    expect(viewerRows.rows).toHaveLength(0);
    expect(adminRows.rows).toHaveLength(1);
  });

  it('reissues an expired invitation after retiring the stale row', async () => {
    await database.client.query(
      `update public.organization_invitations set expires_at = now() - interval '1 day'
       where organization_id = $1 and email = $2`,
      [ORGS.a, CAROL_EMAIL],
    );

    await createInvitation(USERS.alice, CAROL_EMAIL, 'manager');

    const rows = await database.asUser(USERS.alice, (client) =>
      client.query<{ revoked: boolean }>(
        `select revoked_at is not null as revoked
         from public.organization_invitations
         order by created_at`,
      ),
    );

    expect(rows.rows).toEqual([{ revoked: true }, { revoked: false }]);
  });
});

describe('invitation acceptance', () => {
  it('lists pending invitations only for the matching signed-in email', async () => {
    const withEmail = await database.asUser(
      USERS.carol,
      (client) =>
        client.query<{ organization_name: string; role: string }>(
          'select organization_name, role from app.my_pending_invitations()',
        ),
      { email: CAROL_EMAIL },
    );
    const withoutEmail = await database.asUser(
      USERS.carol,
      (client) => client.query('select * from app.my_pending_invitations()'),
      { email: DAVE_EMAIL },
    );

    expect(withEmail.rows).toEqual([{ organization_name: 'Org A', role: 'manager' }]);
    expect(withoutEmail.rows).toHaveLength(0);
  });

  it('accepts an invitation for the matching email and is idempotent', async () => {
    const invitation = await database.asUser(
      USERS.carol,
      (client) =>
        client.query<{ invitation_id: string }>(
          'select invitation_id from app.my_pending_invitations()',
        ),
      { email: CAROL_EMAIL },
    );
    const invitationId = invitation.rows[0]?.invitation_id;
    expect(invitationId).toBeTruthy();

    const accepted = await database.asUser(
      USERS.carol,
      (client) =>
        client.query<{ organization_id: string }>(
          'select app.accept_invitation($1) as organization_id',
          [invitationId],
        ),
      { email: CAROL_EMAIL, commit: true },
    );
    expect(accepted.rows).toEqual([{ organization_id: ORGS.a }]);

    const membership = await database.asUser(USERS.carol, (client) =>
      client.query<{ role: string }>(
        'select role from public.memberships where organization_id = $1 and user_id = $2',
        [ORGS.a, USERS.carol],
      ),
    );
    const acceptedAgain = await database.asUser(
      USERS.carol,
      (client) =>
        client.query<{ organization_id: string }>(
          'select app.accept_invitation($1) as organization_id',
          [invitationId],
        ),
      { email: CAROL_EMAIL, commit: true },
    );

    expect(membership.rows).toEqual([{ role: 'manager' }]);
    expect(acceptedAgain.rows).toEqual([{ organization_id: ORGS.a }]);

    await expect(createInvitation(USERS.alice, CAROL_EMAIL, 'viewer')).rejects.toThrow(
      /already_member/,
    );
  });

  it('rejects acceptance by a different email', async () => {
    const created = await createInvitation(USERS.alice, FRANK_EMAIL, 'viewer');
    const invitationId = created.rows[0]?.id;

    await expect(
      database.asUser(
        USERS.dave,
        (client) => client.query('select app.accept_invitation($1)', [invitationId]),
        { email: DAVE_EMAIL },
      ),
    ).rejects.toThrow(/invitation_email_mismatch/);
  });
});

describe('member management', () => {
  it('denies direct membership writes even to organization admins', async () => {
    await expect(
      database.asUser(ERIN, (client) =>
        client.query(
          "update public.memberships set role = 'viewer' where organization_id = $1 and user_id = $2",
          [ORGS.a, USERS.alice],
        ),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);

    await expect(
      database.asUser(ERIN, (client) =>
        client.query(
          "insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'owner')",
          [ORGS.a, FRANK],
        ),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);

    await expect(
      database.asUser(ERIN, (client) =>
        client.query('delete from public.memberships where organization_id = $1 and user_id = $2', [
          ORGS.a,
          USERS.dave,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);
  });

  it('only lets an owner manage owners', async () => {
    await expect(
      database.asUser(ERIN, (client) =>
        client.query("select app.change_member_role($1, $2, 'viewer')", [ORGS.a, USERS.alice]),
      ),
    ).rejects.toThrow(/owner_required/);

    await expect(
      database.asUser(ERIN, (client) =>
        client.query('select app.remove_organization_member($1, $2)', [ORGS.a, USERS.alice]),
      ),
    ).rejects.toThrow(/owner_required/);

    await expect(
      database.asUser(ERIN, (client) =>
        client.query("select app.change_member_role($1, $2, 'owner')", [ORGS.a, USERS.dave]),
      ),
    ).rejects.toThrow(/owner_required/);

    const promoted = await database.asUser(
      ERIN,
      (client) =>
        client.query("select app.change_member_role($1, $2, 'manager')", [ORGS.a, USERS.dave]),
      { commit: true },
    );
    expect(promoted.rows).toHaveLength(1);
  });

  it('protects the last owner and lets owners hand over ownership', async () => {
    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query("select app.change_member_role($1, $2, 'viewer')", [ORGS.a, USERS.alice]),
      ),
    ).rejects.toThrow(/organization_requires_owner/);

    await database.asUser(
      USERS.alice,
      (client) =>
        client.query("select app.change_member_role($1, $2, 'owner')", [ORGS.a, USERS.dave]),
      { commit: true },
    );

    const owners = await database.asUser(USERS.alice, (client) =>
      client.query<{ user_id: string }>(
        "select user_id from public.memberships where organization_id = $1 and role = 'owner' order by user_id",
        [ORGS.a],
      ),
    );
    expect(owners.rows.map((row) => row.user_id)).toEqual([USERS.alice, USERS.dave]);
  });

  it('removes a member and still guards the last owner', async () => {
    await database.asUser(
      USERS.alice,
      (client) =>
        client.query('select app.remove_organization_member($1, $2)', [ORGS.a, USERS.dave]),
      { commit: true },
    );

    const daveOrgs = await database.asUser(USERS.dave, (client) =>
      client.query('select id from public.organizations'),
    );
    expect(daveOrgs.rows).toHaveLength(0);

    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query('select app.remove_organization_member($1, $2)', [ORGS.a, USERS.alice]),
        { commit: true },
      ),
    ).rejects.toThrow(/organization_requires_owner/);
  });
});
