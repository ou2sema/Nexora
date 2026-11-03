import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const FINGERPRINT_A = 'a'.repeat(64);
const YEAR = new Date().getFullYear();

interface SupplierResult {
  supplierId: string;
  name: string;
}

interface OrderResult {
  orderId: string;
  number: string;
  status: string;
}

interface ReturnResult {
  returnId: string;
  number: string;
  status: string;
  lineCount?: number;
  quantity?: number;
  releasedDevices?: number;
  duplicate: boolean;
}

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);
});

afterAll(async () => {
  await database.client.close();
});

beforeEach(async () => {
  await database.asPostgres((client) =>
    client.query(`
      truncate public.purchase_return_devices, public.purchase_return_lines,
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

function createSupplier(name = 'Acme Electronics'): Promise<SupplierResult> {
  return call(`select app.save_supplier($1::uuid, null::uuid, $2) as result`, [ORGS.a, name]);
}

function createPurchaseOrder(options: {
  supplierId: string;
  key: string;
  lines?: unknown[];
}): Promise<OrderResult> {
  return call(
    `select app.create_purchase_order(
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::jsonb, $6, $7,
       null::date, null, null
     ) as result`,
    [
      ORGS.a,
      options.supplierId,
      WAREHOUSES.a,
      LOCATIONS.a,
      JSON.stringify(options.lines ?? [{ productId: PRODUCTS.a2, quantity: 10 }]),
      options.key,
      FINGERPRINT_A,
    ],
  );
}

async function orderPurchaseOrder(orderId: string, key: string): Promise<void> {
  await call(`select app.order_purchase_order($1::uuid, $2::uuid, $3, $4) as result`, [
    ORGS.a,
    orderId,
    key,
    FINGERPRINT_A,
  ]);
}

async function receivePurchaseOrder(
  orderId: string,
  lines: unknown[],
  key: string,
): Promise<OrderResult> {
  return call(
    `select app.receive_purchase_order($1::uuid, $2::uuid, $3::jsonb, $4, $5, null) as result`,
    [ORGS.a, orderId, JSON.stringify(lines), key, FINGERPRINT_A],
  );
}

function createSalesOrder(options: { key: string; lines?: unknown[] }): Promise<OrderResult> {
  return call(
    `select app.create_sales_order(
       $1::uuid, $2, $3::uuid, $4::uuid, $5::jsonb, $6, $7, null, null, null, null
     ) as result`,
    [
      ORGS.a,
      'Northwind Traders',
      WAREHOUSES.a,
      LOCATIONS.a,
      JSON.stringify(options.lines ?? [{ productId: PRODUCTS.a2, quantity: 4 }]),
      options.key,
      FINGERPRINT_A,
    ],
  );
}

async function transition(fn: string, orderId: string, key: string): Promise<void> {
  await call(`select app.${fn}($1::uuid, $2::uuid, $3, $4) as result`, [
    ORGS.a,
    orderId,
    key,
    FINGERPRINT_A,
  ]);
}

async function receiveStock(quantity: number, key: string): Promise<void> {
  await call(
    `select app.post_stock_movement(
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'receipt'::app.stock_movement_type,
       $5::numeric, $6, $7
     ) as result`,
    [ORGS.a, PRODUCTS.a2, WAREHOUSES.a, LOCATIONS.a, quantity, key, FINGERPRINT_A],
  );
}

async function lineId(orderId: string, productId: string, kind: 'purchase' | 'sales') {
  const result = await database.asPostgres((client) =>
    client.query<{ id: string }>(
      `select id from public.${kind}_order_lines
       where organization_id = $1 and ${kind}_order_id = $2 and product_id = $3`,
      [ORGS.a, orderId, productId],
    ),
  );

  return result.rows[0]!.id;
}

function createPurchaseReturn(
  orderId: string,
  lines: unknown[],
  key: string,
  options: { user?: string; reason?: string } = {},
): Promise<ReturnResult> {
  return call(
    `select app.create_purchase_return(
       $1::uuid, $2::uuid, $3::jsonb, $4, $5, $6, null
     ) as result`,
    [ORGS.a, orderId, JSON.stringify(lines), key, FINGERPRINT_A, options.reason ?? 'Damaged units'],
    options.user,
  );
}

function postPurchaseReturn(returnId: string, key: string): Promise<ReturnResult> {
  return call(`select app.post_purchase_return($1::uuid, $2::uuid, $3, $4) as result`, [
    ORGS.a,
    returnId,
    key,
    FINGERPRINT_A,
  ]);
}

function cancelPurchaseReturn(returnId: string, key: string): Promise<ReturnResult> {
  return call(`select app.cancel_purchase_return($1::uuid, $2::uuid, $3, $4, $5) as result`, [
    ORGS.a,
    returnId,
    key,
    FINGERPRINT_A,
    'Ordered by mistake',
  ]);
}

function createSalesReturn(
  orderId: string,
  lines: unknown[],
  key: string,
  options: { user?: string } = {},
): Promise<ReturnResult> {
  return call(
    `select app.create_sales_return(
       $1::uuid, $2::uuid, $3::jsonb, $4, $5, $6, null
     ) as result`,
    [ORGS.a, orderId, JSON.stringify(lines), key, FINGERPRINT_A, 'Customer changed mind'],
    options.user,
  );
}

function postSalesReturn(returnId: string, key: string): Promise<ReturnResult> {
  return call(`select app.post_sales_return($1::uuid, $2::uuid, $3, $4) as result`, [
    ORGS.a,
    returnId,
    key,
    FINGERPRINT_A,
  ]);
}

function cancelSalesReturn(returnId: string, key: string): Promise<ReturnResult> {
  return call(`select app.cancel_sales_return($1::uuid, $2::uuid, $3, $4, $5) as result`, [
    ORGS.a,
    returnId,
    key,
    FINGERPRINT_A,
    'Duplicate entry',
  ]);
}

async function onHand(productId: string): Promise<number> {
  const result = await database.asUser(USERS.alice, (client) =>
    client.query<{ on_hand: string }>(
      `select on_hand from public.stock_levels
       where organization_id = $1 and product_id = $2`,
      [ORGS.a, productId],
    ),
  );

  return result.rows[0] ? Number(result.rows[0].on_hand) : 0;
}

async function returnMovements(returnId: string) {
  const result = await database.asPostgres((client) =>
    client.query<{ reference_type: string; quantity_delta: string }>(
      `select reference_type, quantity_delta from public.stock_movements
       where organization_id = $1 and reference_id = $2
       order by created_at`,
      [ORGS.a, returnId],
    ),
  );

  return result.rows;
}

async function receivedPurchaseOrder(quantity = 10) {
  const supplier = await createSupplier(`Acme Supply ${quantity}`);
  const order = await createPurchaseOrder({
    supplierId: supplier.supplierId,
    key: `po-create-${quantity}`,
    lines: [{ productId: PRODUCTS.a2, quantity }],
  });
  await orderPurchaseOrder(order.orderId, `po-order-${quantity}`);
  await receivePurchaseOrder(
    order.orderId,
    [{ lineId: await lineId(order.orderId, PRODUCTS.a2, 'purchase'), quantity }],
    `po-receive-${quantity}`,
  );

  return { orderId: order.orderId, lineId: await lineId(order.orderId, PRODUCTS.a2, 'purchase') };
}

describe('purchase returns', () => {
  it('posts a return as a ledger issue and numbers returns per organization', async () => {
    const { orderId, lineId: orderLineId } = await receivedPurchaseOrder(10);
    expect(await onHand(PRODUCTS.a2)).toBe(10);

    const created = await createPurchaseReturn(
      orderId,
      [{ purchaseOrderLineId: orderLineId, quantity: 4 }],
      'pr-create-0001',
    );
    expect(created.status).toBe('draft');
    expect(created.number).toBe(`PR-${YEAR}-0001`);
    expect(created.quantity).toBe(4);
    expect(await onHand(PRODUCTS.a2)).toBe(10);

    const second = await createPurchaseReturn(
      orderId,
      [{ purchaseOrderLineId: orderLineId, quantity: 1 }],
      'pr-create-0002',
    );
    expect(second.number).toBe(`PR-${YEAR}-0002`);

    const posted = await postPurchaseReturn(created.returnId, 'pr-post-0001');
    expect(posted.status).toBe('posted');
    expect(await onHand(PRODUCTS.a2)).toBe(6);

    const movements = await returnMovements(created.returnId);
    expect(movements).toHaveLength(1);
    expect(movements[0]!.reference_type).toBe('purchase_return');
    expect(Number(movements[0]!.quantity_delta)).toBe(-4);

    const replay = await postPurchaseReturn(created.returnId, 'pr-post-0001');
    expect(replay.duplicate).toBe(true);
    expect(await onHand(PRODUCTS.a2)).toBe(6);
  });

  it('rejects over-return at creation and again at posting for overlapping drafts', async () => {
    const { orderId, lineId: orderLineId } = await receivedPurchaseOrder(10);

    await expect(
      createPurchaseReturn(
        orderId,
        [{ purchaseOrderLineId: orderLineId, quantity: 11 }],
        'pr-over-create',
      ),
    ).rejects.toThrow(/purchase_return_exceeds_received/);

    const first = await createPurchaseReturn(
      orderId,
      [{ purchaseOrderLineId: orderLineId, quantity: 7 }],
      'pr-over-first',
    );
    const second = await createPurchaseReturn(
      orderId,
      [{ purchaseOrderLineId: orderLineId, quantity: 7 }],
      'pr-over-second',
    );

    await postPurchaseReturn(first.returnId, 'pr-over-post-first');
    expect(await onHand(PRODUCTS.a2)).toBe(3);

    await expect(postPurchaseReturn(second.returnId, 'pr-over-post-second')).rejects.toThrow(
      /purchase_return_exceeds_received/,
    );
    expect(await onHand(PRODUCTS.a2)).toBe(3);

    const cancelled = await cancelPurchaseReturn(second.returnId, 'pr-over-cancel');
    expect(cancelled.status).toBe('cancelled');
  });

  it('refuses returns on orders that never received stock and from non-writers', async () => {
    const supplier = await createSupplier();
    const order = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'pr-draft-order',
      lines: [{ productId: PRODUCTS.a2, quantity: 2 }],
    });
    const orderLineId = await lineId(order.orderId, PRODUCTS.a2, 'purchase');

    await expect(
      createPurchaseReturn(
        order.orderId,
        [{ purchaseOrderLineId: orderLineId, quantity: 1 }],
        'pr-draft-only',
      ),
    ).rejects.toThrow(/purchase_order_not_returnable/);

    await orderPurchaseOrder(order.orderId, 'pr-order-only');
    await expect(
      createPurchaseReturn(
        order.orderId,
        [{ purchaseOrderLineId: orderLineId, quantity: 1 }],
        'pr-ordered-only',
      ),
    ).rejects.toThrow(/purchase_order_not_returnable/);

    const { orderId, lineId: receivedLineId } = await receivedPurchaseOrder(2);
    await expect(
      createPurchaseReturn(
        orderId,
        [{ purchaseOrderLineId: receivedLineId, quantity: 1 }],
        'pr-viewer',
        { user: USERS.dave },
      ),
    ).rejects.toThrow(/forbidden/);
  });
});

describe('serialized purchase returns', () => {
  async function receivedIphones() {
    const supplier = await createSupplier();
    const order = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'pr-serial-create',
      lines: [{ productId: PRODUCTS.a1, quantity: 2, unitCostMinor: 3000000 }],
    });
    await orderPurchaseOrder(order.orderId, 'pr-serial-order');
    await receivePurchaseOrder(
      order.orderId,
      [
        {
          lineId: await lineId(order.orderId, PRODUCTS.a1, 'purchase'),
          quantity: 2,
          serials: [{ serialNumber: 'SN-RETURN-0001' }, { serialNumber: 'SN-RETURN-0002' }],
        },
      ],
      'pr-serial-receive',
    );

    const devices = await database.asPostgres((client) =>
      client.query<{ id: string; serial_number: string }>(
        `select id, serial_number from public.devices
         where organization_id = $1 order by serial_number`,
        [ORGS.a],
      ),
    );

    return {
      orderId: order.orderId,
      lineId: await lineId(order.orderId, PRODUCTS.a1, 'purchase'),
      devices: devices.rows,
    };
  }

  async function deviceRow(deviceId: string) {
    const result = await database.asPostgres((client) =>
      client.query<{ status: string }>('select status from public.devices where id = $1', [
        deviceId,
      ]),
    );

    return result.rows[0]!;
  }

  it('disposes the selected devices without posting quantity movements', async () => {
    const { orderId, lineId: orderLineId, devices } = await receivedIphones();

    await expect(
      createPurchaseReturn(
        orderId,
        [{ purchaseOrderLineId: orderLineId, quantity: 1, deviceIds: devices.map((d) => d.id) }],
        'pr-serial-count',
      ),
    ).rejects.toThrow(/serial_count_mismatch/);

    await expect(
      createPurchaseReturn(
        orderId,
        [
          {
            purchaseOrderLineId: orderLineId,
            quantity: 2,
            deviceIds: [devices[0]!.id, devices[0]!.id],
          },
        ],
        'pr-serial-dupe',
      ),
    ).rejects.toThrow(/duplicate_device/);

    const created = await createPurchaseReturn(
      orderId,
      [{ purchaseOrderLineId: orderLineId, quantity: 2, deviceIds: devices.map((d) => d.id) }],
      'pr-serial-good',
    );
    expect(created.status).toBe('draft');
    for (const device of devices) {
      expect((await deviceRow(device.id)).status).toBe('in_stock');
    }

    await postPurchaseReturn(created.returnId, 'pr-serial-post');

    for (const device of devices) {
      expect((await deviceRow(device.id)).status).toBe('disposed');
    }

    const events = await database.asPostgres((client) =>
      client.query<{ count: string }>(
        `select count(*)::text as count from public.device_events
         where organization_id = $1 and event_type = 'disposed'`,
        [ORGS.a],
      ),
    );
    expect(events.rows[0]!.count).toBe('2');
    expect(await returnMovements(created.returnId)).toHaveLength(0);

    await expect(
      createPurchaseReturn(
        orderId,
        [{ purchaseOrderLineId: orderLineId, quantity: 1, deviceIds: [devices[0]!.id] }],
        'pr-serial-after-post',
      ),
    ).rejects.toThrow(/device_not_in_stock|purchase_return_exceeds_received/);
  });

  it('releases a device claim when a draft is cancelled', async () => {
    const { orderId, lineId: orderLineId, devices } = await receivedIphones();
    const deviceId = devices[0]!.id;

    const first = await createPurchaseReturn(
      orderId,
      [{ purchaseOrderLineId: orderLineId, quantity: 1, deviceIds: [deviceId] }],
      'pr-serial-draft-a',
    );

    await expect(
      createPurchaseReturn(
        orderId,
        [{ purchaseOrderLineId: orderLineId, quantity: 1, deviceIds: [deviceId] }],
        'pr-serial-draft-b',
      ),
    ).rejects.toThrow(/device_already_returned/);

    const cancelled = await cancelPurchaseReturn(first.returnId, 'pr-serial-cancel');
    expect(cancelled.releasedDevices).toBe(1);

    const again = await createPurchaseReturn(
      orderId,
      [{ purchaseOrderLineId: orderLineId, quantity: 1, deviceIds: [deviceId] }],
      'pr-serial-draft-c',
    );
    expect(again.status).toBe('draft');
    expect((await deviceRow(deviceId)).status).toBe('in_stock');
  });
});

describe('sales returns', () => {
  async function fulfilledOrder(quantity = 4) {
    await receiveStock(10, `sr-stock-${quantity}`);
    const order = await createSalesOrder({
      key: `sr-create-${quantity}`,
      lines: [{ productId: PRODUCTS.a2, quantity }],
    });
    await transition('confirm_sales_order', order.orderId, `sr-confirm-${quantity}`);
    await transition('fulfil_sales_order', order.orderId, `sr-fulfil-${quantity}`);

    return {
      orderId: order.orderId,
      lineId: await lineId(order.orderId, PRODUCTS.a2, 'sales'),
    };
  }

  it('restocks a fulfilled line through a receipt movement', async () => {
    const { orderId, lineId: orderLineId } = await fulfilledOrder(4);
    expect(await onHand(PRODUCTS.a2)).toBe(6);

    const created = await createSalesReturn(
      orderId,
      [{ salesOrderLineId: orderLineId, quantity: 2 }],
      'sr-create-good',
    );
    expect(created.number).toBe(`SR-${YEAR}-0001`);

    const posted = await postSalesReturn(created.returnId, 'sr-post-good');
    expect(posted.status).toBe('posted');
    expect(await onHand(PRODUCTS.a2)).toBe(8);

    const movements = await returnMovements(created.returnId);
    expect(movements).toHaveLength(1);
    expect(movements[0]!.reference_type).toBe('sales_return');
    expect(Number(movements[0]!.quantity_delta)).toBe(2);
  });

  it('cannot return more than was fulfilled, even across overlapping drafts', async () => {
    const { orderId, lineId: orderLineId } = await fulfilledOrder(4);

    await expect(
      createSalesReturn(
        orderId,
        [{ salesOrderLineId: orderLineId, quantity: 5 }],
        'sr-over-create',
      ),
    ).rejects.toThrow(/sales_return_exceeds_fulfilled/);

    const first = await createSalesReturn(
      orderId,
      [{ salesOrderLineId: orderLineId, quantity: 4 }],
      'sr-over-first',
    );
    const second = await createSalesReturn(
      orderId,
      [{ salesOrderLineId: orderLineId, quantity: 4 }],
      'sr-over-second',
    );

    await postSalesReturn(first.returnId, 'sr-over-post-first');
    expect(await onHand(PRODUCTS.a2)).toBe(10);

    await expect(postSalesReturn(second.returnId, 'sr-over-post-second')).rejects.toThrow(
      /sales_return_exceeds_fulfilled/,
    );

    const cancelled = await cancelSalesReturn(second.returnId, 'sr-over-cancel');
    expect(cancelled.status).toBe('cancelled');
  });

  it('rejects returns before fulfilment and keeps tenants apart', async () => {
    await receiveStock(10, 'sr-confirm-stock');
    const order = await createSalesOrder({ key: 'sr-unfulfilled' });
    await transition('confirm_sales_order', order.orderId, 'sr-unfulfilled-confirm');
    const orderLineId = await lineId(order.orderId, PRODUCTS.a2, 'sales');

    await expect(
      createSalesReturn(
        order.orderId,
        [{ salesOrderLineId: orderLineId, quantity: 1 }],
        'sr-unfulfilled-return',
      ),
    ).rejects.toThrow(/sales_order_not_returnable/);

    const { orderId, lineId: fulfilledLineId } = await fulfilledOrder(2);
    await expect(
      createSalesReturn(
        orderId,
        [{ salesOrderLineId: fulfilledLineId, quantity: 1 }],
        'sr-viewer',
        { user: USERS.dave },
      ),
    ).rejects.toThrow(/forbidden/);

    const visible = await database.asUser(USERS.bob, (client) =>
      client.query<{ count: string }>(
        `select count(*)::text as count from public.sales_returns where organization_id = $1`,
        [ORGS.a],
      ),
    );
    expect(visible.rows[0]!.count).toBe('0');
  });
});
