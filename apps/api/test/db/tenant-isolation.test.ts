import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PRODUCTS, ORGS, USERS, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);
});

afterAll(async () => {
  await database.client.close();
});

const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

describe('tenant isolation under RLS', () => {
  it('shows each member only their own organization products', async () => {
    const aliceProducts = await database.asUser(USERS.alice, (client) =>
      client.query<{ id: string }>('select id from public.products'),
    );
    const bobProducts = await database.asUser(USERS.bob, (client) =>
      client.query<{ id: string }>('select id from public.products'),
    );

    expect(ids(aliceProducts.rows)).toEqual([PRODUCTS.a1, PRODUCTS.a2]);
    expect(ids(bobProducts.rows)).toEqual([PRODUCTS.b1]);
  });

  it('lets a user read the same barcode their organization owns without leaking the other tenant', async () => {
    const aliceMatch = await database.asUser(USERS.alice, (client) =>
      client.query<{ id: string; organization_id: string }>(
        'select id, organization_id from public.products where barcode = $1',
        ['4006381333931'],
      ),
    );

    expect(aliceMatch.rows).toHaveLength(1);
    expect(aliceMatch.rows[0]?.organization_id).toBe(ORGS.a);
  });

  it('rejects inserting into another organization with an RLS violation', async () => {
    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query(
          "insert into public.products (organization_id, sku, name) values ($1, 'INTRUDER', 'Intruder')",
          [ORGS.b],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('silently updates and deletes zero rows in another organization', async () => {
    const update = await database.asUser(USERS.alice, (client) =>
      client.query('update public.products set name = $1 where id = $2 returning id', [
        'Hijacked',
        PRODUCTS.b1,
      ]),
    );
    const remove = await database.asUser(USERS.alice, (client) =>
      client.query('delete from public.products where id = $1 returning id', [PRODUCTS.b1]),
    );

    expect(update.rows).toHaveLength(0);
    expect(remove.rows).toHaveLength(0);
  });

  it('lets a viewer read but not write', async () => {
    const readable = await database.asUser(USERS.dave, (client) =>
      client.query('select id from public.products'),
    );

    expect(readable.rows).toHaveLength(2);
    await expect(
      database.asUser(USERS.dave, (client) =>
        client.query(
          "insert into public.products (organization_id, sku, name) values ($1, 'DAVE-1', 'Dave')",
          [ORGS.a],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('shows nothing to a signed-in user without a membership', async () => {
    const products = await database.asUser(USERS.carol, (client) =>
      client.query('select id from public.products'),
    );
    const organizations = await database.asUser(USERS.carol, (client) =>
      client.query('select id from public.organizations'),
    );

    expect(products.rows).toHaveLength(0);
    expect(organizations.rows).toHaveLength(0);
  });

  it('shows nothing to an anonymous caller', async () => {
    const products = await database.asUser(null, (client) =>
      client.query('select id from public.products'),
    );
    const organizations = await database.asUser(null, (client) =>
      client.query('select id from public.organizations'),
    );

    expect(products.rows).toHaveLength(0);
    expect(organizations.rows).toHaveLength(0);
  });

  it('exposes only memberships of organizations the caller belongs to', async () => {
    const aliceMembers = await database.asUser(USERS.alice, (client) =>
      client.query<{ organization_id: string }>('select organization_id from public.memberships'),
    );
    const bobMembers = await database.asUser(USERS.bob, (client) =>
      client.query<{ organization_id: string }>('select organization_id from public.memberships'),
    );

    expect(aliceMembers.rows.map((row) => row.organization_id)).toEqual([ORGS.a, ORGS.a]);
    expect(bobMembers.rows.map((row) => row.organization_id)).toEqual([ORGS.b]);
  });

  it('denies direct membership writes regardless of tenant boundary', async () => {
    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query(
          "insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'admin')",
          [ORGS.b, USERS.alice],
        ),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);

    await expect(
      database.asUser(USERS.bob, (client) =>
        client.query('delete from public.memberships where organization_id = $1 returning id', [
          ORGS.a,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);
  });

  it('isolates warehouses and storage locations', async () => {
    const locations = await database.asUser(USERS.bob, (client) =>
      client.query<{ id: string }>('select id from public.storage_locations'),
    );
    const warehouses = await database.asUser(USERS.bob, (client) =>
      client.query<{ id: string }>('select id from public.warehouses'),
    );

    expect(locations.rows).toHaveLength(1);
    expect(warehouses.rows).toHaveLength(1);
  });

  it('refuses a category parent that belongs to another organization', async () => {
    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query(
          `insert into public.categories (organization_id, parent_id, name, slug)
           values ($1, '30000000-0000-4000-8000-0000000000b0', 'Cross org', 'cross-org')`,
          [ORGS.a],
        ),
      ),
    ).rejects.toThrow(/foreign key/i);
  });
});
