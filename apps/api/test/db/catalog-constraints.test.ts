import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, SHARED_BARCODE, USERS, WAREHOUSES, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);
});

afterAll(async () => {
  await database.client.close();
});

describe('catalog constraints', () => {
  it('rejects a duplicate barcode inside one organization', async () => {
    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query(
            `insert into public.products (organization_id, sku, name, barcode)
             values ($1, 'NEW-SKU', 'Clone', $2)`,
            [ORGS.a, SHARED_BARCODE],
          ),
        { commit: true },
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('allows the same barcode in a different organization', async () => {
    const barcode = '5901234123457';

    await database.asUser(
      USERS.alice,
      (client) =>
        client.query(
          `insert into public.products (organization_id, sku, name, barcode)
           values ($1, 'SHARED-BC-A', 'Shared A', $2)`,
          [ORGS.a, barcode],
        ),
      { commit: true },
    );

    const inserted = await database.asUser(
      USERS.bob,
      (client) =>
        client.query<{ id: string }>(
          `insert into public.products (organization_id, sku, name, barcode)
           values ($1, 'SHARED-BC-B', 'Shared B', $2)
           returning id`,
          [ORGS.b, barcode],
        ),
      { commit: true },
    );

    expect(inserted.rows).toHaveLength(1);
  });

  it('treats SKUs as case-insensitive within an organization only', async () => {
    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query(
            `insert into public.products (organization_id, sku, name)
             values ($1, 'iphone-15', 'Lowercase clone')`,
            [ORGS.a],
          ),
        { commit: true },
      ),
    ).rejects.toThrow(/duplicate key|unique/i);

    const acrossOrgs = await database.asUser(
      USERS.bob,
      (client) =>
        client.query<{ id: string }>(
          `insert into public.products (organization_id, sku, name)
           values ($1, 'CABLE-USB-C', 'Cable in B') returning id`,
          [ORGS.b],
        ),
      { commit: true },
    );

    expect(acrossOrgs.rows).toHaveLength(1);
  });

  it('rejects a category that would become its own ancestor', async () => {
    const child = await database.asUser(
      USERS.alice,
      (client) =>
        client.query<{ id: string }>(
          `insert into public.categories (organization_id, parent_id, name, slug)
           values ($1, '30000000-0000-4000-8000-0000000000a0', 'Accessories', 'accessories')
           returning id`,
          [ORGS.a],
        ),
      { commit: true },
    );

    const grandchild = await database.asUser(
      USERS.alice,
      (client) =>
        client.query<{ id: string }>(
          `insert into public.categories (organization_id, parent_id, name, slug)
           values ($1, $2, 'Cases', 'cases') returning id`,
          [ORGS.a, child.rows[0]?.id],
        ),
      { commit: true },
    );

    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query('update public.categories set parent_id = $1 where id = $2', [
            grandchild.rows[0]?.id,
            '30000000-0000-4000-8000-0000000000a0',
          ]),
        { commit: true },
      ),
    ).rejects.toThrow(/category_cycle/);
  });

  it('rejects a storage location pointing at another organization warehouse', async () => {
    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query(
            `insert into public.storage_locations (organization_id, warehouse_id, code, name)
             values ($1, $2, 'X-01', 'Cross org shelf')`,
            [ORGS.a, WAREHOUSES.b],
          ),
        { commit: true },
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it('rejects negative prices and non-numeric barcodes', async () => {
    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query(
            `insert into public.products (organization_id, sku, name, purchase_price_minor)
             values ($1, 'NEG-1', 'Negative price', -1)`,
            [ORGS.a],
          ),
        { commit: true },
      ),
    ).rejects.toThrow(/check constraint|violates/i);

    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query(
            `insert into public.products (organization_id, sku, name, barcode)
             values ($1, 'BAD-BC', 'Bad barcode', 'ABC-123')`,
            [ORGS.a],
          ),
        { commit: true },
      ),
    ).rejects.toThrow(/check constraint|violates/i);
  });
});
