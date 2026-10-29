import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, type TestDatabase } from './harness';

let database: TestDatabase;
let seedSql: string;

const USER_ID = '00000000-0000-4000-8000-00000000feed';

beforeAll(async () => {
  database = await createTestDatabase();
  seedSql = await readFile(resolve(process.cwd(), '../../supabase/seed.sql'), 'utf8');

  await database.client.query('insert into auth.users (id, email) values ($1, $2)', [
    USER_ID,
    'owner@sbs-vision.tn',
  ]);
});

afterAll(async () => {
  await database.client.close();
});

describe('development seed', () => {
  it('refuses to run before any user has signed up', async () => {
    const empty = await createTestDatabase();

    try {
      await expect(empty.client.exec(seedSql)).rejects.toThrow(/seed_requires_auth_user/);
    } finally {
      await empty.client.close();
    }
  });

  it('builds the demo organization with an owner membership', async () => {
    await database.client.exec(seedSql);

    const org = await database.client.query<{ id: string; slug: string }>(
      'select id, slug from public.organizations',
    );
    const membership = await database.client.query<{ role: string; user_id: string }>(
      'select role, user_id from public.memberships',
    );

    expect(org.rows).toEqual([{ id: '0a000000-0000-4000-8000-000000000001', slug: 'sbs-vision' }]);
    expect(membership.rows).toEqual([{ role: 'owner', user_id: USER_ID }]);
  });

  it('seeds a complete catalog with valid barcode lengths', async () => {
    const counts = await database.client.query<{
      products: number;
      categories: number;
      brands: number;
      warehouses: number;
      locations: number;
    }>(`
      select
        (select count(*)::int from public.products) as products,
        (select count(*)::int from public.categories) as categories,
        (select count(*)::int from public.brands) as brands,
        (select count(*)::int from public.warehouses) as warehouses,
        (select count(*)::int from public.storage_locations) as locations
    `);

    expect(counts.rows[0]).toEqual({
      products: 7,
      categories: 7,
      brands: 7,
      warehouses: 2,
      locations: 3,
    });

    const barcodes = await database.client.query<{ barcode: string }>(
      'select barcode from public.products where barcode is not null',
    );
    for (const row of barcodes.rows) {
      expect(row.barcode).toMatch(/^[0-9]{13}$/);
    }
  });

  it('is safe to run twice', async () => {
    await database.client.exec(seedSql);

    const products = await database.client.query<{ count: number }>(
      'select count(*)::int as count from public.products',
    );
    const memberships = await database.client.query<{ count: number }>(
      'select count(*)::int as count from public.memberships',
    );

    expect(products.rows[0]?.count).toBe(7);
    expect(memberships.rows[0]?.count).toBe(1);
  });
});
