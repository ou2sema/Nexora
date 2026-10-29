import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, PRODUCTS, USERS, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);
});

afterAll(async () => {
  await database.client.close();
});

describe('organization bootstrap and owner protection', () => {
  it('creates an organization and its first owner membership for the caller', async () => {
    const created = await database.asUser(
      USERS.carol,
      (client) =>
        client.query<{ create_organization: string }>(
          "select app.create_organization('Carol Trading', 'Carol-Trading') as create_organization",
        ),
      { commit: true },
    );

    const organizationId = created.rows[0]?.create_organization;
    expect(organizationId).toBeTruthy();

    const visible = await database.asUser(USERS.carol, (client) =>
      client.query<{ id: string; slug: string }>('select id, slug from public.organizations'),
    );
    const membership = await database.asUser(USERS.carol, (client) =>
      client.query<{ role: string }>(
        'select role from public.memberships where organization_id = $1',
        [organizationId],
      ),
    );

    expect(visible.rows).toEqual([{ id: organizationId, slug: 'carol-trading' }]);
    expect(membership.rows).toEqual([{ role: 'owner' }]);
  });

  it('refuses organization creation without an authenticated subject', async () => {
    await expect(
      database.asUser(null, (client) =>
        client.query("select app.create_organization('Anon', 'anon-org')"),
      ),
    ).rejects.toThrow(/authentication_required/);
  });

  it('refuses a duplicate organization slug', async () => {
    await expect(
      database.asUser(
        USERS.carol,
        (client) => client.query("select app.create_organization('Copycat', 'org-a')"),
        { commit: true },
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('does not allow removing the last owner', async () => {
    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query(
          "update public.memberships set role = 'viewer' where organization_id = $1 and user_id = $2",
          [ORGS.a, USERS.alice],
        ),
      ),
    ).rejects.toThrow(/organization_requires_owner/);

    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query('delete from public.memberships where organization_id = $1 and user_id = $2', [
          ORGS.a,
          USERS.alice,
        ]),
      ),
    ).rejects.toThrow(/organization_requires_owner/);
  });

  it('lets an owner add a member, who then gains read access', async () => {
    await database.asUser(
      USERS.alice,
      (client) =>
        client.query(
          "insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'viewer')",
          [ORGS.a, USERS.carol],
        ),
      { commit: true },
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
