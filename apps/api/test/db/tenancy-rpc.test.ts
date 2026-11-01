import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, PRODUCTS, USERS, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const PLATFORM_ADMIN = '00000000-0000-4000-8000-0000000000f1';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);

  await database.client.exec(`
    insert into auth.users (id, email) values ('${PLATFORM_ADMIN}', 'operator@example.com');
    update public.profiles set is_platform_admin = true where id = '${PLATFORM_ADMIN}';
  `);
});

afterAll(async () => {
  await database.client.close();
});

describe('organization bootstrap and owner protection', () => {
  it('creates an organization and its first owner membership for a platform admin', async () => {
    const created = await database.asUser(
      PLATFORM_ADMIN,
      (client) =>
        client.query<{ create_organization: string }>(
          "select app.create_organization('Operator Trading', 'Operator-Trading') as create_organization",
        ),
      { commit: true },
    );

    const organizationId = created.rows[0]?.create_organization;
    expect(organizationId).toBeTruthy();

    const visible = await database.asUser(PLATFORM_ADMIN, (client) =>
      client.query<{ id: string; slug: string }>(
        'select id, slug from public.organizations where id = $1',
        [organizationId],
      ),
    );
    const membership = await database.asUser(PLATFORM_ADMIN, (client) =>
      client.query<{ role: string }>(
        'select role from public.memberships where organization_id = $1 and user_id = $2',
        [organizationId, PLATFORM_ADMIN],
      ),
    );

    expect(visible.rows).toEqual([{ id: organizationId, slug: 'operator-trading' }]);
    expect(membership.rows).toEqual([{ role: 'owner' }]);
  });

  it('refuses organization creation without an authenticated subject', async () => {
    await expect(
      database.asUser(null, (client) =>
        client.query("select app.create_organization('Anon', 'anon-org')"),
      ),
    ).rejects.toThrow(/authentication_required/);
  });

  it('refuses organization creation for users without the platform flag', async () => {
    await expect(
      database.asUser(
        USERS.carol,
        (client) =>
          client.query("select app.create_organization('Carol Trading', 'carol-trading')"),
        { commit: true },
      ),
    ).rejects.toThrow(/platform_admin_required/);

    const visible = await database.asUser(USERS.carol, (client) =>
      client.query('select id from public.organizations where slug = $1', ['carol-trading']),
    );
    expect(visible.rows).toHaveLength(0);
  });

  it('refuses a duplicate organization slug', async () => {
    await expect(
      database.asUser(
        PLATFORM_ADMIN,
        (client) => client.query("select app.create_organization('Copycat', 'org-a')"),
        { commit: true },
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('refuses direct writes even when an owner tries to change the last owner', async () => {
    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query(
          "update public.memberships set role = 'viewer' where organization_id = $1 and user_id = $2",
          [ORGS.a, USERS.alice],
        ),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);

    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query('delete from public.memberships where organization_id = $1 and user_id = $2', [
          ORGS.a,
          USERS.alice,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);
  });

  it('lets an owner invite a member through the RPC, who then gains read access', async () => {
    const invitation = await database.asUser(
      USERS.alice,
      (client) =>
        client.query<{ id: string }>(
          "select app.create_organization_invitation($1, 'carol@example.com', 'viewer') as id",
          [ORGS.a],
        ),
      { commit: true },
    );
    await database.asUser(
      USERS.carol,
      (client) => client.query('select app.accept_invitation($1)', [invitation.rows[0]?.id]),
      { email: 'carol@example.com', commit: true },
    );

    const products = await database.asUser(USERS.carol, (client) =>
      client.query<{ id: string }>('select id from public.products order by id'),
    );

    expect(products.rows.map((row) => row.id)).toEqual([PRODUCTS.a1, PRODUCTS.a2]);
  });

  it('prevents a viewer from renaming the organization', async () => {
    const updated = await database.asUser(USERS.dave, (client) =>
      client.query('update public.organizations set name = $1 where id = $2 returning id', [
        'Renamed',
        ORGS.a,
      ]),
    );

    expect(updated.rows).toHaveLength(0);
  });

  it('lets an owner rename the organization and maintains updated_at', async () => {
    const updated = await database.asUser(USERS.alice, (client) =>
      client.query<{ name: string; touched: boolean }>(
        'update public.organizations set name = $1 where id = $2 returning name, updated_at > created_at as touched',
        ['Org A Renamed', ORGS.a],
      ),
    );

    expect(updated.rows).toEqual([{ name: 'Org A Renamed', touched: true }]);
  });
});
