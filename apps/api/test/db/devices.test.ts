import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const SECOND_LOCATION = '60000000-0000-4000-8000-0000000000a2';
const FINGERPRINT_A = 'a'.repeat(64);
const FINGERPRINT_B = 'b'.repeat(64);

interface RegistrationResult {
  deviceId: string;
  serialNumber: string;
  status: string;
  duplicate: boolean;
}

interface StatusResult {
  deviceId: string;
  status: string;
  previousStatus: string;
  duplicate: boolean;
}

interface MoveResult {
  deviceId: string;
  warehouseId: string;
  locationId: string;
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
  await database.asPostgres((client) =>
    client.query(
      'truncate public.purchase_return_devices, public.device_events, public.devices, public.stock_operations',
    ),
  );
});

async function registerDevice(options: {
  key: string;
  userId?: string;
  organizationId?: string;
  productId?: string;
  serialNumber?: string;
  fingerprint?: string;
  imei?: string | null;
  locationId?: string;
}): Promise<RegistrationResult> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ result: RegistrationResult }>(
        `select app.register_device(
           $1::uuid, $2::uuid, $3, $4, $5, $6, 'new'::app.device_condition,
           $7::uuid, $8::uuid, null::date, null::date, 'SUP-1', 'Received in good condition'
         ) as result`,
        [
          options.organizationId ?? ORGS.a,
          options.productId ?? PRODUCTS.a1,
          options.serialNumber ?? 'SN-IPHONE-0001',
          options.key,
          options.fingerprint ?? FINGERPRINT_A,
          options.imei ?? null,
          WAREHOUSES.a,
          options.locationId ?? LOCATIONS.a,
        ],
      ),
    { commit: true },
  );

  return result.rows[0]!.result;
}

async function changeStatus(options: {
  deviceId: string;
  status: string;
  key: string;
  userId?: string;
  fingerprint?: string;
}): Promise<StatusResult> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ result: StatusResult }>(
        `select app.change_device_status(
           $1::uuid, $2::uuid, $3::app.device_status, $4, $5, 'Lifecycle change'
         ) as result`,
        [
          ORGS.a,
          options.deviceId,
          options.status,
          options.key,
          options.fingerprint ?? FINGERPRINT_A,
        ],
      ),
    { commit: true },
  );

  return result.rows[0]!.result;
}

async function moveDevice(options: {
  deviceId: string;
  key: string;
  userId?: string;
  locationId?: string;
}): Promise<MoveResult> {
  const result = await database.asUser(
    options.userId ?? USERS.alice,
    (client) =>
      client.query<{ result: MoveResult }>(
        `select app.move_device($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, 'Shelf move') as result`,
        [
          ORGS.a,
          options.deviceId,
          WAREHOUSES.a,
          options.locationId ?? SECOND_LOCATION,
          options.key,
          FINGERPRINT_A,
        ],
      ),
    { commit: true },
  );

  return result.rows[0]!.result;
}

async function deviceRow(deviceId: string) {
  const result = await database.asUser(USERS.alice, (client) =>
    client.query<{ status: string; serial_number: string; location_id: string }>(
      'select status, serial_number, location_id from public.devices where id = $1',
      [deviceId],
    ),
  );
  return result.rows[0];
}

async function eventTypes(deviceId: string): Promise<string[]> {
  const result = await database.asUser(USERS.alice, (client) =>
    client.query<{ event_type: string }>(
      'select event_type from public.device_events where device_id = $1 order by created_at, id',
      [deviceId],
    ),
  );
  return result.rows.map((row) => row.event_type);
}

describe('device registration', () => {
  it('registers a serialized product and records the first event', async () => {
    const registered = await registerDevice({ key: 'device-register-0001' });

    expect(registered).toMatchObject({
      serialNumber: 'SN-IPHONE-0001',
      status: 'in_stock',
      duplicate: false,
    });
    expect(await deviceRow(registered.deviceId)).toMatchObject({
      status: 'in_stock',
      serial_number: 'SN-IPHONE-0001',
    });

    const events = await database.asUser(USERS.alice, (client) =>
      client.query<{ event_type: string; status_to: string; warehouse_to: string }>(
        'select event_type, status_to, warehouse_to from public.device_events',
      ),
    );
    expect(events.rows).toEqual([
      { event_type: 'registered', status_to: 'in_stock', warehouse_to: WAREHOUSES.a },
    ]);
  });

  it('replays a registration with the same idempotency key', async () => {
    const first = await registerDevice({ key: 'device-register-retry' });
    const retry = await registerDevice({ key: 'device-register-retry' });

    expect(retry).toMatchObject({ deviceId: first.deviceId, duplicate: true });

    const counts = await database.asUser(USERS.alice, (client) =>
      client.query<{ devices: number; events: number }>(
        'select (select count(*)::int from public.devices) as devices, (select count(*)::int from public.device_events) as events',
      ),
    );
    expect(counts.rows[0]).toEqual({ devices: 1, events: 1 });
  });

  it('rejects a reused key with a different device', async () => {
    await registerDevice({ key: 'device-register-conflict' });

    await expect(
      registerDevice({
        key: 'device-register-conflict',
        serialNumber: 'SN-OTHER-0001',
        fingerprint: FINGERPRINT_B,
      }),
    ).rejects.toThrow(/idempotency_key_conflict/);
  });

  it('rejects duplicate serial numbers case-insensitively and duplicate IMEIs', async () => {
    await registerDevice({ key: 'device-serial-1', serialNumber: 'SN-DUP-1' });

    await expect(
      registerDevice({ key: 'device-serial-2', serialNumber: 'sn-dup-1' }),
    ).rejects.toThrow(/duplicate key|unique/i);

    await registerDevice({
      key: 'device-imei-1',
      serialNumber: 'SN-IMEI-1',
      imei: '356789012345671',
    });

    await expect(
      registerDevice({ key: 'device-imei-2', serialNumber: 'SN-IMEI-2', imei: '356789012345671' }),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('rejects non-serialized products and unauthorized actors', async () => {
    await expect(
      registerDevice({ key: 'device-cable', productId: PRODUCTS.a2, serialNumber: 'SN-CABLE' }),
    ).rejects.toThrow(/product_not_serialized/);

    await expect(
      registerDevice({ key: 'device-viewer', userId: USERS.dave, serialNumber: 'SN-VIEWER' }),
    ).rejects.toThrow(/forbidden/);

    await expect(
      registerDevice({ key: 'device-outsider', userId: USERS.bob, serialNumber: 'SN-OUTSIDER' }),
    ).rejects.toThrow(/forbidden/);
  });
});

describe('device lifecycle', () => {
  it('walks the supported transitions with a complete event history', async () => {
    const { deviceId } = await registerDevice({ key: 'lifecycle-register' });

    await changeStatus({ deviceId, status: 'reserved', key: 'lifecycle-reserved' });
    await changeStatus({ deviceId, status: 'sold', key: 'lifecycle-sold' });
    await changeStatus({ deviceId, status: 'returned', key: 'lifecycle-returned' });
    await changeStatus({ deviceId, status: 'in_repair', key: 'lifecycle-repair' });
    await changeStatus({ deviceId, status: 'in_stock', key: 'lifecycle-repaired' });
    await changeStatus({ deviceId, status: 'disposed', key: 'lifecycle-disposed' });

    expect(await eventTypes(deviceId)).toEqual([
      'registered',
      'reserved',
      'issued',
      'returned',
      'repair_started',
      'repair_completed',
      'disposed',
    ]);
    expect(await deviceRow(deviceId)).toMatchObject({ status: 'disposed' });
  });

  it('rejects unsupported transitions, no-op changes, and terminal states', async () => {
    const { deviceId } = await registerDevice({ key: 'invalid-transition' });

    await expect(
      changeStatus({ deviceId, status: 'returned', key: 'invalid-returned' }),
    ).rejects.toThrow(/device_transition_not_allowed/);

    await expect(
      changeStatus({ deviceId, status: 'in_stock', key: 'invalid-same' }),
    ).rejects.toThrow(/device_status_unchanged/);

    await changeStatus({ deviceId, status: 'disposed', key: 'dispose-once' });
    await expect(
      changeStatus({ deviceId, status: 'in_stock', key: 'dispose-back' }),
    ).rejects.toThrow(/device_transition_not_allowed/);
  });

  it('records a location move and rejects moving sold or disposed devices', async () => {
    const { deviceId } = await registerDevice({ key: 'move-register' });

    const moved = await moveDevice({ deviceId, key: 'move-0001' });
    expect(moved).toMatchObject({ locationId: SECOND_LOCATION, duplicate: false });
    expect(await deviceRow(deviceId)).toMatchObject({ location_id: SECOND_LOCATION });

    const moveEvent = await database.asUser(USERS.alice, (client) =>
      client.query<{ event_type: string; location_from: string; location_to: string }>(
        "select event_type, location_from, location_to from public.device_events where event_type = 'moved'",
      ),
    );
    expect(moveEvent.rows).toEqual([
      { event_type: 'moved', location_from: LOCATIONS.a, location_to: SECOND_LOCATION },
    ]);

    await expect(moveDevice({ deviceId, key: 'move-again' })).rejects.toThrow(
      /device_location_unchanged/,
    );

    await expect(moveDevice({ deviceId, key: 'move-viewer', userId: USERS.dave })).rejects.toThrow(
      /forbidden/,
    );

    await changeStatus({ deviceId, status: 'sold', key: 'move-sold-status' });
    await expect(moveDevice({ deviceId, key: 'move-sold' })).rejects.toThrow(/device_already_sold/);
  });

  it('records the actor on every event', async () => {
    const { deviceId } = await registerDevice({ key: 'actor-register' });
    await changeStatus({ deviceId, status: 'reserved', key: 'actor-reserved' });

    const events = await database.asUser(USERS.alice, (client) =>
      client.query<{ event_type: string; actor_id: string }>(
        'select event_type, actor_id from public.device_events where device_id = $1 order by created_at',
        [deviceId],
      ),
    );

    expect(events.rows).toEqual([
      { event_type: 'registered', actor_id: USERS.alice },
      { event_type: 'reserved', actor_id: USERS.alice },
    ]);
  });
});

describe('device isolation', () => {
  it('keeps devices and history inside the organization', async () => {
    await registerDevice({ key: 'isolation-register' });

    const devices = await database.asUser(USERS.bob, (client) =>
      client.query('select * from public.devices'),
    );
    const events = await database.asUser(USERS.bob, (client) =>
      client.query('select * from public.device_events'),
    );

    expect(devices.rows).toHaveLength(0);
    expect(events.rows).toHaveLength(0);
  });

  it('treats device history as append-only for application roles', async () => {
    const { deviceId } = await registerDevice({ key: 'immutable-register' });

    await expect(
      database.asUser(
        USERS.alice,
        (client) =>
          client.query('update public.device_events set note = $1 where device_id = $2', [
            'Rewritten',
            deviceId,
          ]),
        { commit: true },
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
