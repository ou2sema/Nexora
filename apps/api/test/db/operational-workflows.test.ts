import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const FINGERPRINT_A = 'a'.repeat(64);
const YEAR = new Date().getFullYear();

interface SupplierResult {
  supplierId: string;
  name: string;
  isActive: boolean;
}

interface OrderResult {
  orderId: string;
  number: string;
  status: string;
  lineCount: number;
  totalQuantity: number;
  duplicate: boolean;
}

interface TransitionResult {
  orderId: string;
  number: string;
  status: string;
  duplicate: boolean;
  receivedLines?: number;
  receivedQuantity?: number;
  reservedQuantity?: number;
  issuedQuantity?: number;
  releasedReservations?: number;
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
        public.stock_balances
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
  user?: string;
  fingerprint?: string;
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
      options.fingerprint ?? FINGERPRINT_A,
    ],
    options.user,
  );
}

function orderPurchaseOrder(
  orderId: string,
  key: string,
  user?: string,
): Promise<TransitionResult> {
  return call(
    `select app.order_purchase_order($1::uuid, $2::uuid, $3, $4) as result`,
    [ORGS.a, orderId, key, FINGERPRINT_A],
    user,
  );
}

function receivePurchaseOrder(
  orderId: string,
  lines: unknown[],
  key: string,
  user?: string,
): Promise<TransitionResult> {
  return call(
    `select app.receive_purchase_order($1::uuid, $2::uuid, $3::jsonb, $4, $5, null) as result`,
    [ORGS.a, orderId, JSON.stringify(lines), key, FINGERPRINT_A],
    user,
  );
}

function cancelPurchaseOrder(
  orderId: string,
  key: string,
  reason?: string,
  user?: string,
): Promise<TransitionResult> {
  return call(
    `select app.cancel_purchase_order($1::uuid, $2::uuid, $3, $4, $5) as result`,
    [ORGS.a, orderId, key, FINGERPRINT_A, reason ?? null],
    user,
  );
}

function createSalesOrder(options: {
  key: string;
  lines?: unknown[];
  customerName?: string;
  user?: string;
}): Promise<OrderResult> {
  return call(
    `select app.create_sales_order(
       $1::uuid, $2, $3::uuid, $4::uuid, $5::jsonb, $6, $7, null, null, null, null
     ) as result`,
    [
      ORGS.a,
      options.customerName ?? 'Northwind Traders',
      WAREHOUSES.a,
      LOCATIONS.a,
      JSON.stringify(options.lines ?? [{ productId: PRODUCTS.a2, quantity: 5 }]),
      options.key,
      FINGERPRINT_A,
    ],
    options.user,
  );
}

function confirmSalesOrder(orderId: string, key: string, user?: string): Promise<TransitionResult> {
  return call(
    `select app.confirm_sales_order($1::uuid, $2::uuid, $3, $4) as result`,
    [ORGS.a, orderId, key, FINGERPRINT_A],
    user,
  );
}

function fulfilSalesOrder(orderId: string, key: string, user?: string): Promise<TransitionResult> {
  return call(
    `select app.fulfil_sales_order($1::uuid, $2::uuid, $3, $4) as result`,
    [ORGS.a, orderId, key, FINGERPRINT_A],
    user,
  );
}

function cancelSalesOrder(
  orderId: string,
  key: string,
  reason?: string,
  user?: string,
): Promise<TransitionResult> {
  return call(
    `select app.cancel_sales_order($1::uuid, $2::uuid, $3, $4, $5) as result`,
    [ORGS.a, orderId, key, FINGERPRINT_A, reason ?? null],
    user,
  );
}

async function receiveStock(productId: string, quantity: number, key: string): Promise<void> {
  await call(
    `select app.post_stock_movement(
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'receipt'::app.stock_movement_type,
       $5::numeric, $6, $7
     ) as result`,
    [ORGS.a, productId, WAREHOUSES.a, LOCATIONS.a, quantity, key, FINGERPRINT_A],
  );
}

async function purchaseLineId(orderId: string, productId: string = PRODUCTS.a2): Promise<string> {
  const result = await database.asPostgres((client) =>
    client.query<{ id: string }>(
      `select id from public.purchase_order_lines
       where organization_id = $1 and purchase_order_id = $2 and product_id = $3`,
      [ORGS.a, orderId, productId],
    ),
  );

  return result.rows[0]!.id;
}

async function stockLevel(productId: string): Promise<{
  onHand: number;
  reserved: number;
  available: number;
}> {
  const result = await database.asUser(USERS.alice, (client) =>
    client.query<{ on_hand: string; reserved: string; available: string }>(
      `select on_hand, reserved, available from public.stock_levels
       where organization_id = $1 and product_id = $2`,
      [ORGS.a, productId],
    ),
  );

  const row = result.rows[0];
  return {
    onHand: row ? Number(row.on_hand) : 0,
    reserved: row ? Number(row.reserved) : 0,
    available: row ? Number(row.available) : 0,
  };
}

describe('suppliers', () => {
  it('creates suppliers, rejects duplicate names, and supports deactivation', async () => {
    const supplier = await createSupplier();
    expect(supplier.name).toBe('Acme Electronics');
    expect(supplier.isActive).toBe(true);

    await expect(createSupplier()).rejects.toThrow(/supplier_name_conflict/);

    const deactivated = await call<SupplierResult>(
      `select app.set_supplier_active($1::uuid, $2::uuid, false) as result`,
      [ORGS.a, supplier.supplierId],
    );
    expect(deactivated.isActive).toBe(false);

    await expect(
      createPurchaseOrder({ supplierId: supplier.supplierId, key: 'po-inactive-0001' }),
    ).rejects.toThrow(/supplier_inactive/);
  });

  it('refuses supplier writes from a viewer', async () => {
    await expect(
      call(
        `select app.save_supplier($1::uuid, null::uuid, 'Viewer Supply') as result`,
        [ORGS.a],
        USERS.dave,
      ),
    ).rejects.toThrow(/forbidden/);
  });
});

describe('purchase orders', () => {
  it('numbers orders per organization and advances through partial receipts', async () => {
    const supplier = await createSupplier();

    const first = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'po-create-0001',
      lines: [{ productId: PRODUCTS.a2, quantity: 10 }],
    });
    expect(first.number).toBe(`PO-${YEAR}-0001`);
    expect(first.status).toBe('draft');
    expect(first.lineCount).toBe(1);
    expect(first.totalQuantity).toBe(10);

    const second = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'po-create-0002',
      lines: [{ productId: PRODUCTS.a2, quantity: 2 }],
    });
    expect(second.number).toBe(`PO-${YEAR}-0002`);

    const ordered = await orderPurchaseOrder(first.orderId, 'po-order-0001');
    expect(ordered.status).toBe('ordered');

    const lineId = await purchaseLineId(first.orderId);

    const partial = await receivePurchaseOrder(
      first.orderId,
      [{ lineId, quantity: 4 }],
      'po-receive-0001',
    );
    expect(partial.status).toBe('partially_received');
    expect(partial.receivedQuantity).toBe(4);
    expect((await stockLevel(PRODUCTS.a2)).onHand).toBe(4);

    const complete = await receivePurchaseOrder(
      first.orderId,
      [{ lineId, quantity: 6 }],
      'po-receive-0002',
    );
    expect(complete.status).toBe('received');
    expect((await stockLevel(PRODUCTS.a2)).onHand).toBe(10);

    const movements = await database.asPostgres((client) =>
      client.query<{ count: string }>(
        `select count(*)::text as count from public.stock_movements
         where reference_type = 'purchase_order' and reference_id = $1`,
        [first.orderId],
      ),
    );
    expect(movements.rows[0]!.count).toBe('2');
  });

  it('rejects over-receipt without changing the order or the ledger', async () => {
    const supplier = await createSupplier();
    const order = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'po-over-create',
      lines: [{ productId: PRODUCTS.a2, quantity: 5 }],
    });
    await orderPurchaseOrder(order.orderId, 'po-over-order');
    const lineId = await purchaseLineId(order.orderId);

    await receivePurchaseOrder(order.orderId, [{ lineId, quantity: 4 }], 'po-over-first');

    await expect(
      receivePurchaseOrder(order.orderId, [{ lineId, quantity: 2 }], 'po-over-second'),
    ).rejects.toThrow(/purchase_order_over_receipt/);

    expect((await stockLevel(PRODUCTS.a2)).onHand).toBe(4);

    const status = await database.asPostgres((client) =>
      client.query<{ status: string }>(`select status from public.purchase_orders where id = $1`, [
        order.orderId,
      ]),
    );
    expect(status.rows[0]!.status).toBe('partially_received');
  });

  it('registers serialized devices on receipt and posts no quantity movement', async () => {
    const supplier = await createSupplier();
    const order = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'po-serial-create',
      lines: [{ productId: PRODUCTS.a1, quantity: 2, unitCostMinor: 3000000 }],
    });
    await orderPurchaseOrder(order.orderId, 'po-serial-order');
    const lineId = await purchaseLineId(order.orderId, PRODUCTS.a1);

    await expect(
      receivePurchaseOrder(
        order.orderId,
        [{ lineId, quantity: 2, serials: [{ serialNumber: 'SN-ONLY-ONE' }] }],
        'po-serial-mismatch',
      ),
    ).rejects.toThrow(/serial_count_mismatch/);

    const received = await receivePurchaseOrder(
      order.orderId,
      [
        {
          lineId,
          quantity: 2,
          serials: [
            { serialNumber: 'SN-IPHONE-9001', imei: '356789012345671' },
            { serialNumber: 'SN-IPHONE-9002' },
          ],
        },
      ],
      'po-serial-good',
    );
    expect(received.status).toBe('received');

    const devices = await database.asPostgres((client) =>
      client.query<{ serial_number: string; status: string; supplier_reference: string }>(
        `select serial_number, status, supplier_reference from public.devices
         where organization_id = $1 order by serial_number`,
        [ORGS.a],
      ),
    );
    expect(devices.rows.map((row) => row.serial_number)).toEqual([
      'SN-IPHONE-9001',
      'SN-IPHONE-9002',
    ]);
    expect(devices.rows.every((row) => row.status === 'in_stock')).toBe(true);
    expect(devices.rows.every((row) => row.supplier_reference === order.number)).toBe(true);

    const events = await database.asPostgres((client) =>
      client.query<{ count: string }>(
        `select count(*)::text as count from public.device_events
         where organization_id = $1 and event_type = 'registered'`,
        [ORGS.a],
      ),
    );
    expect(events.rows[0]!.count).toBe('2');

    expect((await stockLevel(PRODUCTS.a1)).onHand).toBe(0);

    const movements = await database.asPostgres((client) =>
      client.query<{ count: string }>(
        `select count(*)::text as count from public.stock_movements where reference_id = $1`,
        [order.orderId],
      ),
    );
    expect(movements.rows[0]!.count).toBe('0');
  });

  it('replays an idempotent create and conflicts on a different payload', async () => {
    const supplier = await createSupplier();
    const lines = [{ productId: PRODUCTS.a2, quantity: 3 }];

    const first = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'po-idem-0001',
      lines,
    });
    const replay = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'po-idem-0001',
      lines,
    });
    expect(replay.orderId).toBe(first.orderId);
    expect(replay.duplicate).toBe(true);

    await expect(
      createPurchaseOrder({
        supplierId: supplier.supplierId,
        key: 'po-idem-0001',
        lines: [{ productId: PRODUCTS.a2, quantity: 4 }],
        fingerprint: 'b'.repeat(64),
      }),
    ).rejects.toThrow(/idempotency_key_conflict/);

    const count = await database.asPostgres((client) =>
      client.query<{ count: string }>(`select count(*)::text as count from public.purchase_orders`),
    );
    expect(count.rows[0]!.count).toBe('1');
  });

  it('cancels only orders that never received stock', async () => {
    const supplier = await createSupplier();
    const received = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'po-cancel-create-1',
      lines: [{ productId: PRODUCTS.a2, quantity: 2 }],
    });
    await orderPurchaseOrder(received.orderId, 'po-cancel-order-1');
    await receivePurchaseOrder(
      received.orderId,
      [{ lineId: await purchaseLineId(received.orderId), quantity: 1 }],
      'po-cancel-receive-1',
    );

    await expect(cancelPurchaseOrder(received.orderId, 'po-cancel-0001')).rejects.toThrow(
      /purchase_order_not_cancellable/,
    );

    const draft = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'po-cancel-create-2',
    });
    const cancelled = await cancelPurchaseOrder(
      draft.orderId,
      'po-cancel-0002',
      'Supplier out of stock',
    );
    expect(cancelled.status).toBe('cancelled');
  });

  it('rejects duplicate lines and foreign products at creation', async () => {
    const supplier = await createSupplier();

    await expect(
      createPurchaseOrder({
        supplierId: supplier.supplierId,
        key: 'po-dupe-0001',
        lines: [
          { productId: PRODUCTS.a2, quantity: 1 },
          { productId: PRODUCTS.a2, quantity: 2 },
        ],
      }),
    ).rejects.toThrow(/duplicate_order_line/);

    await expect(
      createPurchaseOrder({
        supplierId: supplier.supplierId,
        key: 'po-foreign-0001',
        lines: [{ productId: PRODUCTS.b1, quantity: 1 }],
      }),
    ).rejects.toThrow(/product_not_found/);
  });
});

describe('outgoing orders', () => {
  it('reserves on confirm, issues on fulfil, and refuses to oversell', async () => {
    await receiveStock(PRODUCTS.a2, 8, 'seed-outgoing-stock');

    const order = await createSalesOrder({ key: 'so-create-0001' });
    expect(order.number).toBe(`SO-${YEAR}-0001`);
    expect(order.status).toBe('draft');

    const confirmed = await confirmSalesOrder(order.orderId, 'so-confirm-0001');
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.reservedQuantity).toBe(5);
    expect((await stockLevel(PRODUCTS.a2)).available).toBe(3);

    const oversell = await createSalesOrder({
      key: 'so-create-0002',
      customerName: 'Contoso',
      lines: [{ productId: PRODUCTS.a2, quantity: 4 }],
    });
    await expect(confirmSalesOrder(oversell.orderId, 'so-confirm-0002')).rejects.toThrow(
      /insufficient_stock/,
    );

    const oversellState = await database.asPostgres((client) =>
      client.query<{ status: string; reservations: string }>(
        `select o.status,
                (select count(*)::text from public.stock_reservations r
                 where r.organization_id = o.organization_id and r.reference_id = o.id) as reservations
         from public.sales_orders o where o.id = $1`,
        [oversell.orderId],
      ),
    );
    expect(oversellState.rows[0]!.status).toBe('draft');
    expect(oversellState.rows[0]!.reservations).toBe('0');

    const fulfilled = await fulfilSalesOrder(order.orderId, 'so-fulfil-0001');
    expect(fulfilled.status).toBe('fulfilled');
    expect(fulfilled.issuedQuantity).toBe(5);

    const level = await stockLevel(PRODUCTS.a2);
    expect(level.onHand).toBe(3);
    expect(level.reserved).toBe(0);
    expect(level.available).toBe(3);

    const reservations = await database.asPostgres((client) =>
      client.query<{ status: string }>(
        `select status from public.stock_reservations where reference_id = $1`,
        [order.orderId],
      ),
    );
    expect(reservations.rows.map((row) => row.status)).toEqual(['fulfilled']);
  });

  it('cancels a confirmed order and releases its reservations', async () => {
    await receiveStock(PRODUCTS.a2, 6, 'seed-cancel-stock');

    const order = await createSalesOrder({
      key: 'so-cancel-create',
      lines: [{ productId: PRODUCTS.a2, quantity: 4 }],
    });
    await confirmSalesOrder(order.orderId, 'so-cancel-confirm');
    expect((await stockLevel(PRODUCTS.a2)).available).toBe(2);

    const cancelled = await cancelSalesOrder(
      order.orderId,
      'so-cancel-0001',
      'Customer changed their mind',
    );
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.releasedReservations).toBe(1);
    expect((await stockLevel(PRODUCTS.a2)).available).toBe(6);

    await expect(fulfilSalesOrder(order.orderId, 'so-cancel-fulfil')).rejects.toThrow(
      /sales_order_not_fulfillable/,
    );
  });

  it('rejects serialized products and duplicate lines at creation', async () => {
    await expect(
      createSalesOrder({
        key: 'so-serial-0001',
        lines: [{ productId: PRODUCTS.a1, quantity: 1 }],
      }),
    ).rejects.toThrow(/product_serialized_order_unsupported/);

    await expect(
      createSalesOrder({
        key: 'so-dupe-0001',
        lines: [
          { productId: PRODUCTS.a2, quantity: 1 },
          { productId: PRODUCTS.a2, quantity: 1 },
        ],
      }),
    ).rejects.toThrow(/duplicate_order_line/);
  });

  it('requires positive quantities and a customer name', async () => {
    await expect(
      createSalesOrder({
        key: 'so-zero-0001',
        lines: [{ productId: PRODUCTS.a2, quantity: 0 }],
      }),
    ).rejects.toThrow(/order_line_invalid/);

    await expect(createSalesOrder({ key: 'so-name-0001', customerName: '   ' })).rejects.toThrow(
      /customer_name_required/,
    );
  });
});

describe('tenant isolation and roles', () => {
  it('keeps orders inside the tenant and blocks non-writers', async () => {
    const supplier = await createSupplier();
    const order = await createPurchaseOrder({
      supplierId: supplier.supplierId,
      key: 'po-tenant-0001',
    });

    await expect(
      createPurchaseOrder({
        supplierId: supplier.supplierId,
        key: 'po-tenant-0002',
        user: USERS.bob,
      }),
    ).rejects.toThrow(/forbidden/);

    await expect(
      createPurchaseOrder({
        supplierId: supplier.supplierId,
        key: 'po-tenant-0003',
        user: USERS.dave,
      }),
    ).rejects.toThrow(/forbidden/);

    await expect(orderPurchaseOrder(order.orderId, 'po-tenant-0004', USERS.bob)).rejects.toThrow(
      /forbidden/,
    );

    const visible = await database.asUser(USERS.bob, (client) =>
      client.query(`select id from public.purchase_orders`),
    );
    expect(visible.rows).toHaveLength(0);

    const visibleLines = await database.asUser(USERS.bob, (client) =>
      client.query(`select id from public.purchase_order_lines`),
    );
    expect(visibleLines.rows).toHaveLength(0);
  });
});
