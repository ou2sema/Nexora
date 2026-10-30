import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { isValidEan13 } from '@mystock/domain';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const SECOND_LOCATION = '60000000-0000-4000-8000-0000000000a2';

const FINGERPRINT_A = 'a'.repeat(64);

interface CountStart {
  countId: string;
  warehouseId: string;
  locationId: string;
  status: string;
  createdAt: string;
}

interface CountRecord {
  lineId: string;
  productId: string;
  countedQuantity: number;
}

interface CountPost {
  countId: string;
  status: string;
  lineCount: number;
  adjustedLines: number;
  adjustments: {
    productId: string;
    previousOnHand: number;
    countedQuantity: number;
    delta: number;
  }[];
  duplicate: boolean;
}

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);
  await database.asPostgres((client) =>
    client.query(
      `insert into public.storage_locations (id, organization_id, warehouse_id, code, name)
       values ($1, $2, $3, 'A-02', 'Aisle A shelf 02')`,
      [SECOND_LOCATION, ORGS.a, WAREHOUSES.a],
    ),
  );
});

afterAll(async () => {
  await database.client.close();
});

beforeEach(async () => {
  await database.asPostgres(async (client) => {
    await client.exec(`
      truncate public.stock_count_lines, public.stock_counts, public.stock_movements,
               public.stock_balances, public.stock_reservations, public.stock_operations;
      update public.products set barcode = null where id = '${PRODUCTS.a2}';
    `);
  });
});

async function assignBarcode(options: {
  userId?: string;
  organizationId?: string;
  productId?: string;
}): Promise<string> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ barcode: string }>(
        'select app.assign_product_barcode($1::uuid, $2::uuid) as barcode',
        [options.organizationId ?? ORGS.a, options.productId ?? PRODUCTS.a2],
      ),
    { commit: true },
  );
  return result.rows[0]!.barcode;
}

async function postMovement(options: {
  productId?: string;
  quantity: number;
  key: string;
  userId?: string;
}): Promise<void> {
  await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query(
        `select app.post_stock_movement(
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'receipt'::app.stock_movement_type,
           $5::numeric, $6, $7, 'Goods received', 'manual'::app.stock_reference_type,
           null, null, null
         )`,
        [
          ORGS.a,
          options.productId ?? PRODUCTS.a2,
          WAREHOUSES.a,
          LOCATIONS.a,
          String(options.quantity),
          options.key,
          FINGERPRINT_A,
        ],
      ),
    { commit: true },
  );
}

async function startCount(
  options: {
    userId?: string;
    locationId?: string;
    note?: string | null;
  } = {},
): Promise<CountStart> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ result: CountStart }>(
        'select app.start_stock_count($1::uuid, $2::uuid, $3::uuid, $4) as result',
        [ORGS.a, WAREHOUSES.a, options.locationId ?? LOCATIONS.a, options.note ?? null],
      ),
    { commit: true },
  );
  return result.rows[0]!.result;
}

async function recordCount(options: {
  countId: string;
  userId?: string;
  productId?: string;
  quantity: number;
  mode?: 'increment' | 'set';
}): Promise<CountRecord> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ result: CountRecord }>(
        `select app.record_stock_count($1::uuid, $2::uuid, $3::uuid, $4::numeric, $5) as result`,
        [
          ORGS.a,
          options.countId,
          options.productId ?? PRODUCTS.a2,
          String(options.quantity),
          options.mode ?? 'increment',
        ],
      ),
    { commit: true },
  );
  return result.rows[0]!.result;
}

async function postCount(options: {
  countId: string;
  userId?: string;
  key?: string;
}): Promise<CountPost> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ result: CountPost }>(
        'select app.post_stock_count($1::uuid, $2::uuid, $3, $4) as result',
        [ORGS.a, options.countId, options.key ?? 'post-count-key', FINGERPRINT_A],
      ),
    { commit: true },
  );
  return result.rows[0]!.result;
}

async function discardCount(countId: string, userId = USERS.alice): Promise<void> {
  await database.asUser(
    userId,
    (client) =>
      client.query('select app.discard_stock_count($1::uuid, $2::uuid)', [ORGS.a, countId]),
    { commit: true },
  );
}

async function onHand(productId = PRODUCTS.a2, locationId = LOCATIONS.a): Promise<string> {
  const result = await database.asUser(USERS.alice, (client) =>
    client.query<{ on_hand: string }>(
      `select on_hand from public.stock_balances
       where organization_id = $1 and product_id = $2 and warehouse_id = $3 and location_id = $4`,
      [ORGS.a, productId, WAREHOUSES.a, locationId],
    ),
  );
  return result.rows[0]!.on_hand;
}

describe('internal barcode assignment', () => {
  it('generates a valid EAN-13 in the GS1 internal range', async () => {
    const barcode = await assignBarcode({});

    expect(barcode).toMatch(/^2[0-9]{12}$/);
    expect(isValidEan13(barcode)).toBe(true);
    expect(await assignBarcode({})).toBe(barcode);
  });

  it('keeps a manufacturer barcode untouched', async () => {
    const barcode = await assignBarcode({ productId: PRODUCTS.a1 });
    expect(barcode).toBe('4006381333931');
  });

  it('rejects a viewer and a product from another organization', async () => {
    await expect(assignBarcode({ userId: USERS.dave })).rejects.toThrow(/forbidden/);
    await expect(
      assignBarcode({ userId: USERS.bob, organizationId: ORGS.b, productId: PRODUCTS.a2 }),
    ).rejects.toThrow(/product_not_found/);
  });

  it('rejects a barcode whose GTIN check digit is wrong', async () => {
    await expect(
      database.asPostgres((client) =>
        client.query(`update public.products set barcode = '4006381333932' where id = $1`, [
          PRODUCTS.a2,
        ]),
      ),
    ).rejects.toThrow(/products_barcode_gtin_check/);
  });
});

describe('stock counts', () => {
  it('opens one count per location and rejects a second open count', async () => {
    const count = await startCount({ note: 'Cycle count' });
    expect(count).toMatchObject({
      warehouseId: WAREHOUSES.a,
      locationId: LOCATIONS.a,
      status: 'open',
    });

    await expect(startCount()).rejects.toThrow(/stock_count_already_open/);
    await expect(startCount({ locationId: SECOND_LOCATION })).resolves.toMatchObject({
      status: 'open',
    });
  });

  it('accumulates increments and supports absolute recounts', async () => {
    const count = await startCount();

    const first = await recordCount({ countId: count.countId, quantity: 2 });
    expect(first.countedQuantity).toBe(2);

    const second = await recordCount({ countId: count.countId, quantity: 3 });
    expect(second.countedQuantity).toBe(5);

    const absolute = await recordCount({ countId: count.countId, quantity: 4, mode: 'set' });
    expect(absolute.countedQuantity).toBe(4);
  });

  it('rejects serialized products, viewers, and posted counts', async () => {
    const count = await startCount();

    await expect(
      recordCount({ countId: count.countId, productId: PRODUCTS.a1, quantity: 1 }),
    ).rejects.toThrow(/product_not_countable/);
    await expect(
      recordCount({ countId: count.countId, quantity: 1, userId: USERS.dave }),
    ).rejects.toThrow(/forbidden/);

    await recordCount({ countId: count.countId, quantity: 1 });
    await postCount({ countId: count.countId });
    await expect(recordCount({ countId: count.countId, quantity: 2 })).rejects.toThrow(
      /stock_count_not_open/,
    );
  });

  it('posts variances to the ledger and is idempotent', async () => {
    await postMovement({ quantity: 10, key: 'count-receipt' });
    const count = await startCount();
    await recordCount({ countId: count.countId, quantity: 7 });

    const posted = await postCount({ countId: count.countId, key: 'count-post-1' });
    expect(posted).toMatchObject({
      countId: count.countId,
      status: 'posted',
      lineCount: 1,
      adjustedLines: 1,
      duplicate: false,
    });
    expect(posted.adjustments[0]).toMatchObject({
      productId: PRODUCTS.a2,
      previousOnHand: 10,
      countedQuantity: 7,
      delta: -3,
    });
    expect(await onHand()).toBe('7.0000');

    const retry = await postCount({ countId: count.countId, key: 'count-post-1' });
    expect(retry).toMatchObject({ duplicate: true, adjustedLines: 1 });

    const movements = await database.asUser(USERS.alice, (client) =>
      client.query<{ movement_type: string; quantity_delta: string; reference_type: string }>(
        `select movement_type, quantity_delta, reference_type
         from public.stock_movements
         where reference_type = 'inventory_count'`,
      ),
    );
    expect(movements.rows).toEqual([
      {
        movement_type: 'adjustment',
        quantity_delta: '-3.0000',
        reference_type: 'inventory_count',
      },
    ]);
  });

  it('refuses a count that would drop stock below an active reservation', async () => {
    await postMovement({ quantity: 10, key: 'count-receipt-reserved' });
    await database.asUser(
      USERS.alice,
      (client) =>
        client.query(
          `select app.reserve_stock(
             $1::uuid, $2::uuid, $3::uuid, $4::uuid, 6, 'reserve-for-count', $5, null,
             'manual'::app.stock_reference_type, null, null
           )`,
          [ORGS.a, PRODUCTS.a2, WAREHOUSES.a, LOCATIONS.a, FINGERPRINT_A],
        ),
      { commit: true },
    );

    const count = await startCount();
    await recordCount({ countId: count.countId, quantity: 5 });

    await expect(postCount({ countId: count.countId })).rejects.toThrow(
      /stock_count_below_reserved/,
    );
    expect(await onHand()).toBe('10.0000');
  });

  it('refuses to post an empty count', async () => {
    const count = await startCount();
    await expect(postCount({ countId: count.countId })).rejects.toThrow(/stock_count_empty/);
  });

  it('discards an open count and allows a fresh one', async () => {
    const count = await startCount();
    await discardCount(count.countId);

    const row = await database.asUser(USERS.alice, (client) =>
      client.query<{ status: string }>('select status from public.stock_counts where id = $1', [
        count.countId,
      ]),
    );
    expect(row.rows[0]!.status).toBe('cancelled');

    await expect(startCount()).resolves.toMatchObject({ status: 'open' });
  });
});
