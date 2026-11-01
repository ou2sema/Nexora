import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, USERS, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const PAT = '00000000-0000-4000-8000-0000000000f0';
const GINA = '00000000-0000-4000-8000-0000000000f2';
const PAT_EMAIL = 'pat@example.com';
const GINA_EMAIL = 'gina@example.com';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);

  await database.client.exec(`
    insert into auth.users (id, email) values
      ('${PAT}', '${PAT_EMAIL}'),
      ('${GINA}', '${GINA_EMAIL}');

    update public.profiles set is_platform_admin = true where id = '${PAT}';

    insert into public.memberships (organization_id, user_id, role) values
      ('${ORGS.a}', '${GINA}', 'manager');
  `);
});

afterAll(async () => {
  await database.client.close();
});

async function createInvitation(
  userId: string,
  organizationId: string,
  email: string,
  role: string,
) {
  return database.asUser(
    userId,
    (client) =>
      client.query<{ id: string }>(
        'select app.create_organization_invitation($1, $2, $3::app.member_role) as id',
        [organizationId, email, role],
      ),
    { commit: true },
  );
}

describe('platform administrator visibility', () => {
  it('reads organizations and profiles across tenants without a membership', async () => {
    const organizations = await database.asUser(PAT, (client) =>
      client.query<{ id: string }>('select id from public.organizations order by id'),
    );
    const profiles = await database.asUser(PAT, (client) =>
      client.query<{ email: string }>('select email from public.profiles order by email'),
    );

    expect(organizations.rows.map((row) => row.id)).toEqual([ORGS.a, ORGS.b]);
    expect(profiles.rows.map((row) => row.email)).toEqual([
      'alice@example.com',
      'bob@example.com',
      'carol@example.com',
      'dave@example.com',
      GINA_EMAIL,
      PAT_EMAIL,
    ]);
  });

  it('does not gain business data access without membership', async () => {
    const products = await database.asUser(PAT, (client) =>
      client.query('select id from public.products'),
    );
    const stock = await database.asUser(PAT, (client) =>
      client.query('select organization_id, product_id from public.stock_levels'),
    );

    expect(products.rows).toHaveLength(0);
    expect(stock.rows).toHaveLength(0);
  });

  it('restricts organization creation to the platform flag', async () => {
    await expect(
      database.asUser(
        USERS.carol,
        (client) => client.query("select app.create_organization('Carol Co', 'carol-co')"),
        { commit: true },
      ),
    ).rejects.toThrow(/platform_admin_required/);

    const created = await database.asUser(
      PAT,
      (client) =>
        client.query<{ create_organization: string }>(
          "select app.create_organization('Operator Co', 'operator-co') as create_organization",
        ),
      { commit: true },
    );
    const organizationId = created.rows[0]?.create_organization;

    const membership = await database.asUser(PAT, (client) =>
      client.query<{ role: string }>(
        'select role from public.memberships where organization_id = $1 and user_id = $2',
        [organizationId, PAT],
      ),
    );

    expect(membership.rows).toEqual([{ role: 'owner' }]);
  });

  it('manages invitations and memberships in organizations it does not belong to', async () => {
    await createInvitation(PAT, ORGS.b, 'newmanager@example.com', 'manager');

    const invitations = await database.asUser(PAT, (client) =>
      client.query<{ email: string }>(
        'select email from public.organization_invitations where organization_id = $1',
        [ORGS.b],
      ),
    );
    expect(invitations.rows).toEqual([{ email: 'newmanager@example.com' }]);

    const invitedVisibleToOwner = await database.asUser(USERS.bob, (client) =>
      client.query('select id from public.organization_invitations where organization_id = $1', [
        ORGS.b,
      ]),
    );
    expect(invitedVisibleToOwner.rows).toHaveLength(1);

    const invitation = await createInvitation(PAT, ORGS.a, 'carol@example.com', 'viewer');
    await database.asUser(
      USERS.carol,
      (client) => client.query('select app.accept_invitation($1)', [invitation.rows[0]?.id]),
      { email: 'carol@example.com', commit: true },
    );
    await database.asUser(
      PAT,
      (client) =>
        client.query("select app.change_member_role($1, $2, 'manager')", [ORGS.a, USERS.carol]),
      { commit: true },
    );
    const promoted = await database.asUser(PAT, (client) =>
      client.query<{ role: string }>(
        'select role from public.memberships where organization_id = $1 and user_id = $2',
        [ORGS.a, USERS.carol],
      ),
    );
    expect(promoted.rows).toEqual([{ role: 'manager' }]);

    await database.asUser(
      PAT,
      (client) =>
        client.query('select app.remove_organization_member($1, $2)', [ORGS.a, USERS.carol]),
      { commit: true },
    );
    const removed = await database.asUser(PAT, (client) =>
      client.query('select 1 from public.memberships where organization_id = $1 and user_id = $2', [
        ORGS.a,
        USERS.carol,
      ]),
    );
    expect(removed.rows).toHaveLength(0);
  });
});

describe('manager access', () => {
  it('lets a manager invite viewers and read the invitation log only', async () => {
    await createInvitation(GINA, ORGS.a, 'manager-viewer@example.com', 'viewer');

    const invitations = await database.asUser(GINA, (client) =>
      client.query<{ email: string }>(
        `select email from public.organization_invitations
         where organization_id = $1 and email = 'manager-viewer@example.com'`,
        [ORGS.a],
      ),
    );
    expect(invitations.rows).toEqual([{ email: 'manager-viewer@example.com' }]);

    await expect(
      createInvitation(GINA, ORGS.a, 'manager-peer@example.com', 'manager'),
    ).rejects.toThrow(/manager_invites_viewers_only/);
    await expect(
      createInvitation(GINA, ORGS.a, 'manager-admin@example.com', 'admin'),
    ).rejects.toThrow(/manager_invites_viewers_only/);
  });

  it('keeps role changes, removal and revocation away from managers', async () => {
    await expect(
      database.asUser(GINA, (client) =>
        client.query("select app.change_member_role($1, $2, 'viewer')", [ORGS.a, USERS.alice]),
      ),
    ).rejects.toThrow(/forbidden/);

    await expect(
      database.asUser(GINA, (client) =>
        client.query('select app.remove_organization_member($1, $2)', [ORGS.a, USERS.alice]),
      ),
    ).rejects.toThrow(/forbidden/);

    const invitation = await database.asUser(GINA, (client) =>
      client.query<{ id: string }>(
        'select id from public.organization_invitations where organization_id = $1 and email = $2',
        [ORGS.a, 'manager-viewer@example.com'],
      ),
    );

    await expect(
      database.asUser(GINA, (client) =>
        client.query('select app.revoke_organization_invitation($1, $2)', [
          ORGS.a,
          invitation.rows[0]?.id,
        ]),
      ),
    ).rejects.toThrow(/forbidden/);
  });

  it('hides invitations from viewers', async () => {
    const rows = await database.asUser(USERS.dave, (client) =>
      client.query('select id from public.organization_invitations'),
    );
    expect(rows.rows).toHaveLength(0);
  });
});

describe('owner protection for platform administrators', () => {
  it('still protects the last owner', async () => {
    await expect(
      database.asUser(PAT, (client) =>
        client.query("select app.change_member_role($1, $2, 'viewer')", [ORGS.a, USERS.alice]),
      ),
    ).rejects.toThrow(/organization_requires_owner/);

    await expect(
      database.asUser(PAT, (client) =>
        client.query('select app.remove_organization_member($1, $2)', [ORGS.a, USERS.alice]),
      ),
    ).rejects.toThrow(/organization_requires_owner/);

    await database.asUser(
      PAT,
      (client) => client.query("select app.change_member_role($1, $2, 'owner')", [ORGS.a, GINA]),
      { commit: true },
    );
    await database.asUser(
      PAT,
      (client) =>
        client.query("select app.change_member_role($1, $2, 'viewer')", [ORGS.a, USERS.alice]),
      { commit: true },
    );

    const owners = await database.asUser(PAT, (client) =>
      client.query<{ user_id: string }>(
        "select user_id from public.memberships where organization_id = $1 and role = 'owner'",
        [ORGS.a],
      ),
    );
    expect(owners.rows.map((row) => row.user_id)).toEqual([GINA]);
  });
});
