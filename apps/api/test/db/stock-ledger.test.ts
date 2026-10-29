import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const SECOND_WAREHOUSE = '50000000-0000-4000-8000-0000000000a2';
const SECOND_LOCATION = '60000000-0000-4000-8000-0000000000a2';
const SECOND_WAREHOUSE_LOCATION = '60000000-0000-4000-8000-0000000000a3';

const FINGERPRINT_A = 'a'.repeat(64);
const FINGERPRINT_B = 'b'.repeat(64);

interface PostingResult {
  movementId: string;
  onHand: number;
  available: number;
  duplicate: boolean;
}

interface TransferResult {
  transferId: string;
  quantity: number;
  sourceOnHand: number;
  targetOnHand: number;
  duplicate: boolean;
}

interface ReservationResult {
  reservationId: string;
  quantity: number;
  reserved: number;
  available: number;
  duplicate: boolean;
}

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);

  await database.asPostgres((client) =>
    client.query(
      `insert into public.warehouses (id, organization_id, code, name)
       values ($1, $2, 'SECOND', 'Second warehouse')`,
      [SECOND_WAREHOUSE, ORGS.a],
    ),
  );

  await database.asPostgres((client) =>
    client.query(
      `insert into public.storage_locations (id, organization_id, warehouse_id, code, name)
       values ($1, $4, $2, 'A-02', 'Aisle A shelf 02'),
              ($3, $4, $5, 'SEC-01', 'Second aisle 01')`,
      [SECOND_LOCATION, WAREHOUSES.a, SECOND_WAREHOUSE_LOCATION, ORGS.a, SECOND_WAREHOUSE],
    ),
  );
});

afterAll(async () => {
  await database.client.close();
});

beforeEach(async () => {
  await database.asPostgres((client) =>
    client.query(
      'truncate public.stock_movements, public.stock_balances, public.stock_reservations, public.stock_operations',
    ),
  );
});

async function postMovement(options: {
  userId?: string;
  organizationId?: string;
  productId?: string;
  warehouseId?: string;
  locationId?: string;
  type?: 'receipt' | 'issue' | 'adjustment';
  quantity: number;
  key: string;
  fingerprint?: string;
  reason?: string | null;
  reservationId?: string | null;
}): Promise<PostingResult> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ result: PostingResult }>(
        `select app.post_stock_movement(
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::app.stock_movement_type,
           $6::numeric, $7, $8, $9, $10::app.stock_reference_type, null, $11::uuid, null
         ) as result`,
        [
          options.organizationId ?? ORGS.a,
          options.productId ?? PRODUCTS.a1,
          options.warehouseId ?? WAREHOUSES.a,
          options.locationId ?? LOCATIONS.a,
          options.type ?? 'receipt',
          String(options.quantity),
          options.key,
          options.fingerprint ?? FINGERPRINT_A,
          options.reason === undefined ? 'Goods received' : options.reason,
          'manual',
          options.reservationId ?? null,
        ],
      ),
    { commit: true },
  );

  return result.rows[0]!.result;
}

async function transfer(options: {
  userId?: string;
  quantity: number;
  key: string;
  fingerprint?: string;
  sourceWarehouse?: string;
  sourceLocation?: string;
  targetWarehouse?: string;
  targetLocation?: string;
}): Promise<TransferResult> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ result: TransferResult }>(
        `select app.post_stock_transfer(
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
           $7::numeric, $8, $9, $10, null
         ) as result`,
        [
          ORGS.a,
          PRODUCTS.a1,
          options.sourceWarehouse ?? WAREHOUSES.a,
          options.sourceLocation ?? LOCATIONS.a,
          options.targetWarehouse ?? SECOND_WAREHOUSE,
          options.targetLocation ?? SECOND_WAREHOUSE_LOCATION,
          String(options.quantity),
          'Transfer between shelves',
          options.key,
          options.fingerprint ?? FINGERPRINT_A,
        ],
      ),
    { commit: true },
  );

  return result.rows[0]!.result;
}

async function reserve(options: {
  userId?: string;
  quantity: number;
  key: string;
  fingerprint?: string;
  expiresAt?: string | null;
}): Promise<ReservationResult> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ result: ReservationResult }>(
        `select app.reserve_stock(
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::numeric, $6, $7, $8::timestamptz,
           'outgoing_order'::app.stock_reference_type, null, null
         ) as result`,
        [
          ORGS.a,
          PRODUCTS.a1,
          WAREHOUSES.a,
          LOCATIONS.a,
          String(options.quantity),
          options.key,
          options.fingerprint ?? FINGERPRINT_A,
          options.expiresAt ?? null,
        ],
      ),
    { commit: true },
  );

  return result.rows[0]!.result;
}

async function onHand(): Promise<string> {
  const result = await database.asUser(USERS.alice, (client) =>
    client.query<{ on_hand: string }>(
      `select on_hand from public.stock_balances
       where organization_id = $1 and product_id = $2 and warehouse_id = $3 and location_id = $4`,
      [ORGS.a, PRODUCTS.a1, WAREHOUSES.a, LOCATIONS.a],
    ),
  );
  return result.rows[0]!.on_hand;
}

describe('stock ledger posting', () => {
  it('records a receipt in the ledger and projects the balance', async () => {
    const posting = await postMovement({ quantity: 10, key: 'receipt-0001' });

    expect(posting).toMatchObject({ onHand: 10, available: 10, duplicate: false });

    const movements = await database.asUser(USERS.alice, (client) =>
      client.query<{
        movement_type: string;
        quantity_delta: string;
        on_hand_after: string;
        actor_id: string;
      }>(
        'select movement_type, quantity_delta, on_hand_after, actor_id from public.stock_movements',
      ),
    );

    expect(movements.rows).toEqual([
      {
        movement_type: 'receipt',
        quantity_delta: '10.0000',
        on_hand_after: '10.0000',
        actor_id: USERS.alice,
      },
    ]);
    expect(await onHand()).toBe('10.0000');
  });

  it('returns the original result for a retried idempotency key', async () => {
    const first = await postMovement({ quantity: 10, key: 'receipt-retry' });
    const retry = await postMovement({ quantity: 10, key: 'receipt-retry' });

    expect(retry).toMatchObject({
      movementId: first.movementId,
      onHand: 10,
      available: 10,
      duplicate: true,
    });

    const count = await database.asUser(USERS.alice, (client) =>
      client.query<{ count: number }>('select count(*)::int as count from public.stock_movements'),
    );
    expect(count.rows[0]?.count).toBe(1);
    expect(await onHand()).toBe('10.0000');
  });

  it('rejects a reused idempotency key with a different request', async () => {
    await postMovement({ quantity: 10, key: 'receipt-conflict' });

    await expect(
      postMovement({ quantity: 5, key: 'receipt-conflict', fingerprint: FINGERPRINT_B }),
    ).rejects.toThrow(/idempotency_key_conflict/);
  });

  it('refuses postings from a viewer and from another organization', async () => {
    await expect(
      postMovement({ userId: USERS.dave, quantity: 1, key: 'viewer-receipt' }),
    ).rejects.toThrow(/forbidden/);

    await expect(
      postMovement({ userId: USERS.bob, quantity: 1, key: 'bob-org-a' }),
    ).rejects.toThrow(/forbidden/);
  });

  it('rejects an issue larger than the physical stock and rolls back', async () => {
    await postMovement({ quantity: 4, key: 'receipt-rollback' });

    await expect(
      postMovement({ type: 'issue', quantity: 5, key: 'issue-too-many', reason: null }),
    ).rejects.toThrow(/insufficient_stock/);

    const count = await database.asUser(USERS.alice, (client) =>
      client.query<{ count: number }>('select count(*)::int as count from public.stock_movements'),
    );

    expect(count.rows[0]?.count).toBe(1);
    expect(await onHand()).toBe('4.0000');
  });

  it('requires a reason and an authorized actor for adjustments', async () => {
    await postMovement({ quantity: 10, key: 'receipt-adjustment' });

    await expect(
      postMovement({ type: 'adjustment', quantity: -3, key: 'adjust-no-reason', reason: null }),
    ).rejects.toThrow(/adjustment_requires_reason/);

    await expect(
      postMovement({
        type: 'adjustment',
        quantity: -3,
        key: 'adjust-viewer',
        userId: USERS.dave,
        reason: 'Damaged unit',
      }),
    ).rejects.toThrow(/forbidden/);

    const adjusted = await postMovement({
      type: 'adjustment',
      quantity: -3,
      key: 'adjust-ok',
      reason: 'Damaged unit',
    });
    expect(adjusted.onHand).toBe(7);

    await expect(
      postMovement({
        type: 'adjustment',
        quantity: -8,
        key: 'adjust-negative',
        reason: 'Another loss',
      }),
    ).rejects.toThrow(/insufficient_stock/);
  });

  it('marks the ledger immutable for application roles', async () => {
    const posting = await postMovement({ quantity: 1, key: 'receipt-immutable' });

    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query('update public.stock_movements set reason = $1 where id = $2', [
            'Rewritten history',
            posting.movementId,
          ]),
        { commit: true },
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query('delete from public.stock_movements where id = $1', [posting.movementId]),
        { commit: true },
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('stock transfers', () => {
  it('moves stock atomically with a shared transfer id', async () => {
    await postMovement({ quantity: 10, key: 'receipt-for-transfer' });

    const first = await transfer({ quantity: 4, key: 'transfer-0001' });
    expect(first).toMatchObject({
      quantity: 4,
      sourceOnHand: 6,
      targetOnHand: 4,
      duplicate: false,
    });

    const movements = await database.asUser(USERS.alice, (client) =>
      client.query<{ movement_type: string; quantity_delta: string; transfer_id: string }>(
        `select movement_type, quantity_delta, transfer_id
         from public.stock_movements
         where movement_type in ('transfer_out', 'transfer_in')
         order by movement_type`,
      ),
    );

    expect(movements.rows).toHaveLength(2);
    expect(new Set(movements.rows.map((row) => row.transfer_id))).toEqual(
      new Set([first.transferId]),
    );
    expect(movements.rows.map((row) => [row.movement_type, row.quantity_delta])).toEqual([
      ['transfer_out', '-4.0000'],
      ['transfer_in', '4.0000'],
    ]);
  });

  it('returns the same transfer for a retried key', async () => {
    await postMovement({ quantity: 10, key: 'receipt-transfer-retry' });
    const first = await transfer({ quantity: 4, key: 'transfer-retry' });
    const retry = await transfer({ quantity: 4, key: 'transfer-retry' });

    expect(retry).toMatchObject({ transferId: first.transferId, duplicate: true });

    const count = await database.asUser(USERS.alice, (client) =>
      client.query<{ count: number }>(
        "select count(*)::int as count from public.stock_movements where movement_type = 'transfer_out'",
      ),
    );
    expect(count.rows[0]?.count).toBe(1);
  });

  it('rejects a transfer larger than the source and a self-transfer', async () => {
    await postMovement({ quantity: 3, key: 'receipt-small-source' });

    await expect(transfer({ quantity: 4, key: 'transfer-too-big' })).rejects.toThrow(
      /insufficient_stock/,
    );

    await expect(
      transfer({
        quantity: 1,
        key: 'transfer-self',
        targetWarehouse: WAREHOUSES.a,
        targetLocation: LOCATIONS.a,
      }),
    ).rejects.toThrow(/transfer_requires_distinct_locations/);

    expect(await onHand()).toBe('3.0000');
  });

  it('does not move reserved stock', async () => {
    await postMovement({ quantity: 5, key: 'receipt-reserved-transfer' });
    await reserve({ quantity: 5, key: 'reserve-transfer' });

    await expect(transfer({ quantity: 1, key: 'transfer-reserved' })).rejects.toThrow(
      /stock_reserved/,
    );
  });
});

describe('stock reservations', () => {
  it('distinguishes reserved from physical stock and releases availability', async () => {
    await postMovement({ quantity: 10, key: 'receipt-reservation' });

    const reserved = await reserve({ quantity: 4, key: 'reserve-0001' });
    expect(reserved).toMatchObject({ quantity: 4, reserved: 4, available: 6 });

    const levels = await database.asUser(USERS.alice, (client) =>
      client.query<{ on_hand: string; reserved: string; available: string }>(
        'select on_hand, reserved, available from public.stock_levels where organization_id = $1',
        [ORGS.a],
      ),
    );
    expect(levels.rows[0]).toEqual({
      on_hand: '10.0000',
      reserved: '4.0000',
      available: '6.0000',
    });

    await expect(reserve({ quantity: 7, key: 'reserve-too-many' })).rejects.toThrow(
      /insufficient_stock/,
    );

    await expect(
      postMovement({ type: 'issue', quantity: 10, key: 'issue-reserved-stock', reason: null }),
    ).rejects.toThrow(/stock_reserved/);

    const released = await database.asUser(
      USERS.alice,
      (client) =>
        client.query<{ result: { status: string } }>(
          'select app.release_stock_reservation($1::uuid, $2::uuid, $3, $4) as result',
          [ORGS.a, reserved.reservationId, 'release-0001', FINGERPRINT_A],
        ),
      { commit: true },
    );
    expect(released.rows[0]?.result.status).toBe('released');

    const issued = await postMovement({
      type: 'issue',
      quantity: 10,
      key: 'issue-after-release',
      reason: null,
    });
    expect(issued.onHand).toBe(0);
  });

  it('fulfils a reservation inside the issuing transaction', async () => {
    await postMovement({ quantity: 10, key: 'receipt-fulfilment' });
    const reserved = await reserve({ quantity: 3, key: 'reserve-fulfilment' });

    const issued = await postMovement({
      type: 'issue',
      quantity: 3,
      key: 'issue-fulfilment',
      reason: null,
      reservationId: reserved.reservationId,
    });
    expect(issued).toMatchObject({ onHand: 7, available: 7 });

    const status = await database.asUser(USERS.alice, (client) =>
      client.query<{ status: string; released_at: string | null }>(
        'select status, released_at from public.stock_reservations where id = $1',
        [reserved.reservationId],
      ),
    );
    expect(status.rows[0]?.status).toBe('fulfilled');
    expect(status.rows[0]?.released_at).not.toBeNull();

    const movement = await database.asUser(USERS.alice, (client) =>
      client.query<{ reservation_id: string }>(
        "select reservation_id from public.stock_movements where movement_type = 'issue'",
      ),
    );
    expect(movement.rows[0]?.reservation_id).toBe(reserved.reservationId);

    await expect(
      postMovement({
        type: 'issue',
        quantity: 3,
        key: 'issue-fulfilment-again',
        reason: null,
        reservationId: reserved.reservationId,
      }),
    ).rejects.toThrow(/reservation_not_active/);
  });

  it('expires overdue reservations and restores availability', async () => {
    await postMovement({ quantity: 5, key: 'receipt-expiry' });
    const reserved = await reserve({
      quantity: 2,
      key: 'reserve-expiry',
      expiresAt: '2999-01-01T00:00:00Z',
    });

    await database.asPostgres((client) =>
      client.query(
        "update public.stock_reservations set expires_at = now() - interval '1 minute' where id = $1",
        [reserved.reservationId],
      ),
    );

    const expired = await database.asUser(
      USERS.alice,
      (client) =>
        client.query<{ expired: number }>(
          'select app.expire_stock_reservations($1::uuid) as expired',
          [ORGS.a],
        ),
      { commit: true },
    );
    expect(expired.rows[0]?.expired).toBe(1);

    const levels = await database.asUser(USERS.alice, (client) =>
      client.query<{ reserved: string; available: string }>(
        'select reserved, available from public.stock_levels where organization_id = $1',
        [ORGS.a],
      ),
    );
    expect(levels.rows[0]).toEqual({ reserved: '0.0000', available: '5.0000' });
  });
});

describe('tenant isolation and reconciliation', () => {
  it('hides another organization ledger from members', async () => {
    await postMovement({ quantity: 2, key: 'receipt-isolation' });

    const bobBalances = await database.asUser(USERS.bob, (client) =>
      client.query('select * from public.stock_balances'),
    );
    const bobMovements = await database.asUser(USERS.bob, (client) =>
      client.query('select * from public.stock_movements'),
    );
    const bobLevels = await database.asUser(USERS.bob, (client) =>
      client.query('select * from public.stock_levels'),
    );

    expect(bobBalances.rows).toHaveLength(0);
    expect(bobMovements.rows).toHaveLength(0);
    expect(bobLevels.rows).toHaveLength(0);
  });

  it('reports a drift between projection and ledger and repairs it', async () => {
    await postMovement({ quantity: 10, key: 'receipt-reconcile' });

    const clean = await database.asUser(USERS.alice, (client) =>
      client.query<{ balance_on_hand: string; ledger_on_hand: string; difference: string }>(
        'select balance_on_hand, ledger_on_hand, difference from app.stock_reconciliation($1::uuid)',
        [ORGS.a],
      ),
    );
    expect(clean.rows).toEqual([
      { balance_on_hand: '10.0000', ledger_on_hand: '10.0000', difference: '0.0000' },
    ]);

    await database.asPostgres((client) =>
      client.query(
        `update public.stock_balances set on_hand = on_hand + 5
         where organization_id = $1 and product_id = $2`,
        [ORGS.a, PRODUCTS.a1],
      ),
    );

    const drift = await database.asUser(USERS.alice, (client) =>
      client.query<{ balance_on_hand: string; ledger_on_hand: string; difference: string }>(
        'select balance_on_hand, ledger_on_hand, difference from app.stock_reconciliation($1::uuid)',
        [ORGS.a],
      ),
    );
    expect(drift.rows).toEqual([
      { balance_on_hand: '15.0000', ledger_on_hand: '10.0000', difference: '5.0000' },
    ]);

    const dryRun = await database.asUser(USERS.alice, (client) =>
      client.query<{ repaired: boolean }>(
        'select repaired from app.repair_stock_balances($1::uuid, true)',
        [ORGS.a],
      ),
    );
    expect(dryRun.rows).toEqual([{ repaired: false }]);
    expect(await onHand()).toBe('15.0000');

    const repaired = await database.asUser(
      USERS.alice,
      (client) =>
        client.query<{ previous_on_hand: string; ledger_on_hand: string; repaired: boolean }>(
          'select previous_on_hand, ledger_on_hand, repaired from app.repair_stock_balances($1::uuid, false)',
          [ORGS.a],
        ),
      { commit: true },
    );
    expect(repaired.rows).toEqual([
      { previous_on_hand: '15.0000', ledger_on_hand: '10.0000', repaired: true },
    ]);
    expect(await onHand()).toBe('10.0000');

    const movements = await database.asUser(USERS.alice, (client) =>
      client.query<{ count: number }>('select count(*)::int as count from public.stock_movements'),
    );
    expect(movements.rows[0]?.count).toBe(1);
  });

  it('restricts reconciliation to owners and admins', async () => {
    await postMovement({ quantity: 1, key: 'receipt-reconcile-role' });

    await expect(
      database.asUser(USERS.dave, (client) =>
        client.query('select * from app.stock_reconciliation($1::uuid)', [ORGS.a]),
      ),
    ).rejects.toThrow(/forbidden/);
  });
});
