import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const FINGERPRINT = 'c'.repeat(64);

const TRACKED = {
  a1: '20000000-0000-4000-8000-0000000000c1',
  a2: '20000000-0000-4000-8000-0000000000c2',
} as const;

interface SupplierResult {
  supplierId: string;
  name: string;
}

interface OrderResult {
  orderId: string;
  number: string;
  status: string;
}

interface TrackedUnit {
  id: string;
  productId: string;
  lineId: string;
  unitCode: string;
  serialNumber: string | null;
  imei: string | null;
}

interface ReceiptResult {
  orderId: string;
  number: string;
  status: string;
  receivedLines: number;
  receivedQuantity: number;
  trackedItems: TrackedUnit[];
  duplicate: boolean;
}

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);
  await database.asPostgres((client) =>
    client.query(
      `insert into public.products (id, organization_id, sku, name, is_individually_tracked)
       values ($1, $2, 'WIDGET-NX-1', 'Widget unit tracked', true),
              ($3, $2, 'WIDGET-NX-2', 'Widget second tracked', true)`,
      [TRACKED.a1, ORGS.a, TRACKED.a2],
    ),
  );
});

afterAll(async () => {
  await database.client.close();
});

beforeEach(async () => {
  await database.asPostgres((client) =>
    client.query(`
      truncate public.tracked_item_events, public.tracked_items,
        public.purchase_return_devices, public.purchase_return_lines,
        public.purchase_returns, public.sales_return_lines, public.sales_returns,
        public.purchase_order_lines, public.sales_order_lines,
        public.purchase_orders, public.sales_orders, public.suppliers,
        public.document_sequences, public.device_events, public.devices,
        public.stock_operations, public.stock_movements, public.stock_reservations,
        public.stock_balances, public.sales_invoice_payments, public.sales_invoice_lines,
        public.sales_invoices, public.customers
    `),
  );
});

async function call<T>(sql: string, params: unknown[], user: string = USERS.alice): Promise<T> {
  const result = await database.asUser(user, (client) => client.query<{ result: T }>(sql, params), {
    commit: true,
  });

  return result.rows[0]!.result;
}

async function createSupplier(name = 'Tracked Supply'): Promise<SupplierResult> {
  return call(`select app.save_supplier($1::uuid, null::uuid, $2) as result`, [ORGS.a, name]);
}

async function createPurchaseOrder(
  supplierId: string,
  lines: { productId: string; quantity: number }[],
  key: string,
): Promise<OrderResult> {
  return call(
    `select app.create_purchase_order(
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::jsonb, $6, $7,
       null::date, null, null
     ) as result`,
    [ORGS.a, supplierId, WAREHOUSES.a, LOCATIONS.a, JSON.stringify(lines), key, FINGERPRINT],
  );
}

async function orderPurchaseOrder(orderId: string, key: string): Promise<void> {
  await call(`select app.order_purchase_order($1::uuid, $2::uuid, $3, $4) as result`, [
    ORGS.a,
    orderId,
    key,
    FINGERPRINT,
  ]);
}

async function receivePurchaseOrder(
  orderId: string,
  lines: unknown[],
  key: string,
  user?: string,
): Promise<ReceiptResult> {
  return call(
    `select app.receive_purchase_order($1::uuid, $2::uuid, $3::jsonb, $4, $5, null) as result`,
    [ORGS.a, orderId, JSON.stringify(lines), key, FINGERPRINT],
    user,
  );
}

async function purchaseLineId(orderId: string, productId: string): Promise<string> {
  const result = await database.asPostgres((client) =>
    client.query<{ id: string }>(
      `select id from public.purchase_order_lines
       where organization_id = $1 and purchase_order_id = $2 and product_id = $3`,
      [ORGS.a, orderId, productId],
    ),
  );

  return result.rows[0]!.id;
}

async function trackedCount(): Promise<number> {
  const result = await database.asPostgres((client) =>
    client.query<{ count: string }>(
      `select count(*)::text as count from public.tracked_items where organization_id = $1`,
      [ORGS.a],
    ),
  );

  return Number(result.rows[0]!.count);
}

async function onHand(productId: string): Promise<number> {
  const result = await database.asPostgres((client) =>
    client.query<{ on_hand: string }>(
      `select on_hand from public.stock_balances
       where organization_id = $1 and product_id = $2 and warehouse_id = $3 and location_id = $4`,
      [ORGS.a, productId, WAREHOUSES.a, LOCATIONS.a],
    ),
  );

  return result.rows[0] ? Number(result.rows[0].on_hand) : 0;
}

async function ledgerMovements(orderId: string): Promise<number> {
  const result = await database.asPostgres((client) =>
    client.query<{ count: string }>(
      `select count(*)::text as count from public.stock_movements
       where reference_type = 'purchase_order' and reference_id = $1`,
      [orderId],
    ),
  );

  return Number(result.rows[0]!.count);
}

async function receiveFiveUnits(): Promise<{
  orderId: string;
  lineId: string;
  receipt: ReceiptResult;
}> {
  const supplier = await createSupplier();
  const order = await createPurchaseOrder(
    supplier.supplierId,
    [{ productId: TRACKED.a1, quantity: 5 }],
    'tracked-po-create',
  );
  await orderPurchaseOrder(order.orderId, 'tracked-po-order');
  const lineId = await purchaseLineId(order.orderId, TRACKED.a1);

  const receipt = await receivePurchaseOrder(
    order.orderId,
    [{ lineId, quantity: 5 }],
    'tracked-po-receive',
  );

  return { orderId: order.orderId, lineId, receipt };
}

describe('individually tracked units', () => {
  it('creates one record and one opaque code per unit actually received', async () => {
    const supplier = await createSupplier();
    const order = await createPurchaseOrder(
      supplier.supplierId,
      [{ productId: TRACKED.a1, quantity: 5 }],
      'tracked-create',
    );
    await orderPurchaseOrder(order.orderId, 'tracked-order');
    const lineId = await purchaseLineId(order.orderId, TRACKED.a1);

    // Ordered only: no unit exists until stock arrives.
    expect(await trackedCount()).toBe(0);

    const receipt = await receivePurchaseOrder(
      order.orderId,
      [{ lineId, quantity: 5 }],
      'tracked-receive',
    );

    expect(receipt.status).toBe('received');
    expect(receipt.receivedQuantity).toBe(5);
    expect(receipt.trackedItems).toHaveLength(5);
    expect(receipt.duplicate).toBe(false);

    const codes = receipt.trackedItems.map((unit) => unit.unitCode);
    expect(new Set(codes).size).toBe(5);
    expect(new Set(receipt.trackedItems.map((unit) => unit.id)).size).toBe(5);
    for (const code of codes) expect(code).toMatch(/^NX[A-F0-9]{20}$/);

    expect(await trackedCount()).toBe(5);
    expect(await onHand(TRACKED.a1)).toBe(5);
    expect(await ledgerMovements(order.orderId)).toBe(1);

    const rows = await database.asPostgres((client) =>
      client.query<{
        unit_code: string;
        status: string;
        purchase_order_id: string;
        purchase_order_line_id: string;
        supplier_reference: string;
        location_id: string;
      }>(
        `select unit_code, status, purchase_order_id, purchase_order_line_id,
                supplier_reference, location_id
         from public.tracked_items
         where organization_id = $1 order by unit_code`,
        [ORGS.a],
      ),
    );

    expect(rows.rows).toHaveLength(5);
    expect(rows.rows.every((row) => row.status === 'in_stock')).toBe(true);
    expect(rows.rows.every((row) => row.purchase_order_id === order.orderId)).toBe(true);
    expect(rows.rows.every((row) => row.purchase_order_line_id === lineId)).toBe(true);
    expect(rows.rows.every((row) => row.supplier_reference === order.number)).toBe(true);
    expect(rows.rows.every((row) => row.location_id === LOCATIONS.a)).toBe(true);

    const events = await database.asPostgres((client) =>
      client.query<{ count: string }>(
        `select count(*)::text as count from public.tracked_item_events
         where organization_id = $1 and event_type = 'received'`,
        [ORGS.a],
      ),
    );
    expect(events.rows[0]!.count).toBe('5');
  });

  it('keeps optional manufacturer attributes separate from the unit code', async () => {
    const supplier = await createSupplier();
    const order = await createPurchaseOrder(
      supplier.supplierId,
      [{ productId: TRACKED.a1, quantity: 2 }],
      'tracked-serial-create',
    );
    await orderPurchaseOrder(order.orderId, 'tracked-serial-order');
    const lineId = await purchaseLineId(order.orderId, TRACKED.a1);

    await expect(
      receivePurchaseOrder(
        order.orderId,
        [{ lineId, quantity: 2, serials: [{ serialNumber: 'MFG-1' }] }],
        'tracked-serial-mismatch',
      ),
    ).rejects.toThrow(/serial_count_mismatch/);
    expect(await trackedCount()).toBe(0);

    const receipt = await receivePurchaseOrder(
      order.orderId,
      [
        {
          lineId,
          quantity: 2,
          serials: [{ serialNumber: 'MFG-1', imei: '356789012345671' }, { serialNumber: 'MFG-2' }],
        },
      ],
      'tracked-serial-good',
    );

    expect(receipt.trackedItems.map((unit) => unit.serialNumber)).toEqual(['MFG-1', 'MFG-2']);
    expect(receipt.trackedItems[0]!.imei).toBe('356789012345671');
    expect(receipt.trackedItems[1]!.imei).toBeNull();

    const codes = receipt.trackedItems.map((unit) => unit.unitCode);
    expect(codes).not.toContain('MFG-1');
    expect(codes).not.toContain('MFG-2');
  });

  it('requires whole units and rolls the whole receipt back on a later failure', async () => {
    const supplier = await createSupplier();
    const order = await createPurchaseOrder(
      supplier.supplierId,
      [
        { productId: TRACKED.a1, quantity: 3 },
        { productId: TRACKED.a2, quantity: 3 },
      ],
      'tracked-rollback-create',
    );
    await orderPurchaseOrder(order.orderId, 'tracked-rollback-order');
    const firstLine = await purchaseLineId(order.orderId, TRACKED.a1);
    const secondLine = await purchaseLineId(order.orderId, TRACKED.a2);

    await expect(
      receivePurchaseOrder(
        order.orderId,
        [{ lineId: firstLine, quantity: 1.5 }],
        'tracked-fractional',
      ),
    ).rejects.toThrow(/tracked_item_quantity_must_be_whole/);
    expect(await trackedCount()).toBe(0);
    expect(await onHand(TRACKED.a1)).toBe(0);

    // The first line registers two units, then the second line fails validation.
    await expect(
      receivePurchaseOrder(
        order.orderId,
        [
          { lineId: firstLine, quantity: 2 },
          { lineId: secondLine, quantity: 2, serials: [{ serialNumber: 'ONLY-ONE' }] },
        ],
        'tracked-rollback',
      ),
    ).rejects.toThrow(/serial_count_mismatch/);

    expect(await trackedCount()).toBe(0);
    expect(await onHand(TRACKED.a1)).toBe(0);
    expect(await onHand(TRACKED.a2)).toBe(0);
    expect(await ledgerMovements(order.orderId)).toBe(0);

    const status = await database.asPostgres((client) =>
      client.query<{ status: string }>(`select status from public.purchase_orders where id = $1`, [
        order.orderId,
      ]),
    );
    expect(status.rows[0]!.status).toBe('ordered');
  });

  it('replays the receipt without creating a second set of units', async () => {
    const { orderId, lineId, receipt } = await receiveFiveUnits();
    const firstCodes = receipt.trackedItems.map((unit) => unit.unitCode).sort();

    const replay = await receivePurchaseOrder(
      orderId,
      [{ lineId, quantity: 5 }],
      'tracked-po-receive',
    );

    expect(replay.duplicate).toBe(true);
    expect(replay.trackedItems.map((unit) => unit.unitCode).sort()).toEqual(firstCodes);
    expect(await trackedCount()).toBe(5);
    expect(await onHand(TRACKED.a1)).toBe(5);
    expect(await ledgerMovements(orderId)).toBe(1);
  });

  it('enforces the unit-code format, tenant uniqueness and tracked-product opt-in', async () => {
    await receiveFiveUnits();
    const existing = await database.asPostgres((client) =>
      client.query<{ unit_code: string }>(
        `select unit_code from public.tracked_items where organization_id = $1 limit 1`,
        [ORGS.a],
      ),
    );
    const unitCode = existing.rows[0]!.unit_code;

    const insert = (productId: string, code: string) =>
      database.asPostgres((client) =>
        client.query(
          `insert into public.tracked_items
             (organization_id, product_id, unit_code, warehouse_id, location_id)
           values ($1, $2, $3, $4, $5)`,
          [ORGS.a, productId, code, WAREHOUSES.a, LOCATIONS.a],
        ),
      );

    await expect(insert(TRACKED.a1, 'NOT-A-UNIT-CODE')).rejects.toThrow(
      /tracked_items_unit_code_check/,
    );
    await expect(insert(TRACKED.a1, unitCode)).rejects.toThrow(/tracked_items_org_unit_code_key/);
    await expect(insert(PRODUCTS.a2, 'NX00000000000000000001')).rejects.toThrow(
      /product_not_individually_tracked/,
    );

    await expect(
      database.asPostgres((client) =>
        client.query(`update public.products set is_individually_tracked = true where id = $1`, [
          PRODUCTS.a1,
        ]),
      ),
    ).rejects.toThrow(/products_single_tracking_mode/);

    const event = await database.asPostgres((client) =>
      client.query<{ id: string }>(`select id from public.tracked_item_events limit 1`),
    );
    await expect(
      database.asPostgres((client) =>
        client.query(`update public.tracked_item_events set note = 'edited' where id = $1`, [
          event.rows[0]!.id,
        ]),
      ),
    ).rejects.toThrow(/tracked_item_history_is_immutable/);
  });

  it('keeps units inside the tenant and refuses cross-tenant receipts', async () => {
    const { orderId } = await receiveFiveUnits();

    const outsider = await database.asUser(USERS.bob, (client) =>
      client.query(`select id from public.tracked_items`),
    );
    expect(outsider.rows).toHaveLength(0);

    const outsiderEvents = await database.asUser(USERS.bob, (client) =>
      client.query(`select id from public.tracked_item_events`),
    );
    expect(outsiderEvents.rows).toHaveLength(0);

    const viewer = await database.asUser(USERS.dave, (client) =>
      client.query(`select id from public.tracked_items`),
    );
    expect(viewer.rows).toHaveLength(5);

    await expect(
      receivePurchaseOrder(
        orderId,
        [{ lineId: await purchaseLineId(orderId, TRACKED.a1), quantity: 1 }],
        'tracked-cross-tenant',
        USERS.bob,
      ),
    ).rejects.toThrow(/forbidden/);
  });

  it('still receives ordinary bulk lines as quantities only', async () => {
    const supplier = await createSupplier();
    const order = await createPurchaseOrder(
      supplier.supplierId,
      [{ productId: PRODUCTS.a2, quantity: 4 }],
      'bulk-create',
    );
    await orderPurchaseOrder(order.orderId, 'bulk-order');
    const lineId = await purchaseLineId(order.orderId, PRODUCTS.a2);

    const receipt = await receivePurchaseOrder(
      order.orderId,
      [{ lineId, quantity: 4 }],
      'bulk-receive',
    );

    expect(receipt.trackedItems).toEqual([]);
    expect(await trackedCount()).toBe(0);
    expect(await onHand(PRODUCTS.a2)).toBe(4);
    expect(await ledgerMovements(order.orderId)).toBe(1);
  });
});
