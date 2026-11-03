import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const FINGERPRINT = 'c'.repeat(64);
const OTHER_FINGERPRINT = 'd'.repeat(64);
const YEAR = new Date().getFullYear();

/** Alice owns an unpriced accessory to prove the server refuses to guess a price. */
const EXTRA = {
  priced: '20000000-0000-4000-8000-0000000000c1',
  unpriced: '20000000-0000-4000-8000-0000000000c2',
} as const;

interface InvoiceResult {
  invoiceId: string;
  number: string;
  orderId: string | null;
  lineCount: number;
  netAmountMinor: number;
  taxAmountMinor: number;
  totalAmountMinor: number;
  paidAmountMinor: number;
  remainingAmountMinor: number;
  paymentStatus: string;
  paymentMethod: string | null;
  duplicate: boolean;
}

interface CustomerResult {
  customerId: string;
  name: string;
  isActive: boolean;
}

interface DeviceResult {
  deviceId: string;
}

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);

  await database.asPostgres((client) =>
    client.query(
      `insert into public.products (
         id, organization_id, sku, name, purchase_price_minor, sale_price_minor, is_serialized
       ) values
         ($1, $3, 'INVOICE-POWER-BANK', 'Power bank 20000mAh', 60000, 119000, false),
         ($2, $3, 'INVOICE-UNPRICED', 'Unknown accessory', null, null, false)`,
      [EXTRA.priced, EXTRA.unpriced, ORGS.a],
    ),
  );
});

afterAll(async () => {
  await database.client.close();
});

beforeEach(async () => {
  // `cascade` also clears the return lines that reference devices and order lines;
  // the seeded catalog, tenancy and storage layout stay in place for every test.
  await database.asPostgres((client) =>
    client.query(`
      truncate public.sales_invoice_payments, public.sales_invoice_lines, public.sales_invoices,
        public.customers, public.sales_order_lines, public.sales_orders,
        public.stock_operations, public.stock_movements, public.stock_reservations,
        public.stock_balances, public.device_events, public.devices, public.document_sequences
      restart identity cascade
    `),
  );
});

async function call<T>(sql: string, params: unknown[], user: string = USERS.alice): Promise<T> {
  const result = await database.asUser(user, (client) => client.query<{ result: T }>(sql, params), {
    commit: true,
  });

  return result.rows[0]!.result;
}

function postInvoice(options: {
  key: string;
  lines: unknown[];
  customerName?: string | null;
  customerId?: string | null;
  paidAmountMinor?: number;
  paymentMethod?: string;
  warehouse?: string;
  location?: string;
  organization?: string;
  fingerprint?: string;
  user?: string;
}): Promise<InvoiceResult> {
  return call(
    `select app.create_sales_invoice(
       $1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5, $6,
       $7::uuid, $8, null, null, $9::bigint, $10, null, null, null
     ) as result`,
    [
      options.organization ?? ORGS.a,
      options.warehouse ?? WAREHOUSES.a,
      options.location ?? LOCATIONS.a,
      JSON.stringify(options.lines),
      options.key,
      options.fingerprint ?? FINGERPRINT,
      options.customerId ?? null,
      // An explicit null means "no customer at all", which is different from omitting the field.
      options.customerName === undefined ? 'Walk-in buyer' : options.customerName,
      options.paidAmountMinor ?? 0,
      options.paymentMethod ?? 'cash',
    ],
    options.user,
  );
}

function receiveStock(
  productId: string,
  quantity: number,
  key: string,
  organization: string = ORGS.a,
): Promise<unknown> {
  return call(
    `select app.post_stock_movement(
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'receipt'::app.stock_movement_type,
       $5::numeric, $6, $7
     ) as result`,
    [
      organization,
      productId,
      organization === ORGS.a ? WAREHOUSES.a : WAREHOUSES.b,
      organization === ORGS.a ? LOCATIONS.a : LOCATIONS.b,
      quantity,
      key,
      FINGERPRINT,
    ],
    organization === ORGS.a ? USERS.alice : USERS.bob,
  );
}

function registerDevice(
  serial: string,
  key: string,
  options: {
    organization?: string;
    productId?: string;
    warehouse?: string;
    location?: string;
    user?: string;
  } = {},
): Promise<DeviceResult> {
  const organization = options.organization ?? ORGS.a;

  return call(
    `select app.register_device(
       $1::uuid, $2::uuid, $3, $4, $5, null, 'new'::app.device_condition, $6::uuid, $7::uuid
     ) as result`,
    [
      organization,
      options.productId ?? (organization === ORGS.a ? PRODUCTS.a1 : PRODUCTS.b1),
      serial,
      key,
      FINGERPRINT,
      options.warehouse ?? (organization === ORGS.a ? WAREHOUSES.a : WAREHOUSES.b),
      options.location ?? (organization === ORGS.a ? LOCATIONS.a : LOCATIONS.b),
    ],
    options.user ?? (organization === ORGS.a ? USERS.alice : USERS.bob),
  );
}

function saveCustomer(name: string, id?: string): Promise<CustomerResult> {
  return call(`select app.save_customer($1::uuid, $2::uuid, $3) as result`, [
    ORGS.a,
    id ?? null,
    name,
  ]);
}

function recordPayment(
  invoiceId: string,
  amountMinor: number,
  method: string,
  key: string,
): Promise<InvoiceResult> {
  return call(
    `select app.record_sales_invoice_payment($1::uuid, $2::uuid, $3::bigint, $4, $5, $6) as result`,
    [ORGS.a, invoiceId, amountMinor, method, key, FINGERPRINT],
  );
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

async function countIn(table: string, where = ''): Promise<number> {
  const result = await database.asPostgres((client) =>
    client.query<{ count: number }>(`select count(*)::int as count from public.${table} ${where}`),
  );

  return result.rows[0]!.count;
}

async function invoiceMovements(invoice: InvoiceResult) {
  const result = await database.asPostgres((client) =>
    client.query<{ movement_type: string; reference_type: string; quantity_delta: string }>(
      `select m.movement_type, m.reference_type, m.quantity_delta
       from public.stock_movements m
       where m.organization_id = $1 and m.reference_id = $2`,
      [ORGS.a, invoice.orderId],
    ),
  );

  return result.rows;
}

async function invoiceLines(invoiceId: string) {
  const result = await database.asPostgres((client) =>
    client.query<Record<string, string | null>>(
      `select l.kind, l.quantity::text, l.unit_price_minor::text, l.tax_rate_percent::text,
              l.net_amount_minor::text, l.tax_amount_minor::text,
              l.sales_order_line_id, l.device_id, l.product_id
       from public.sales_invoice_lines l
       where l.organization_id = $1 and l.sales_invoice_id = $2
       order by l.product_id, l.device_id nulls first`,
      [ORGS.a, invoiceId],
    ),
  );

  return result.rows;
}

async function deviceRow(deviceId: string) {
  const result = await database.asPostgres((client) =>
    client.query<{ status: string; serial_number: string }>(
      'select status, serial_number from public.devices where id = $1',
      [deviceId],
    ),
  );

  return result.rows[0]!;
}

async function invoiceRow(invoiceId: string) {
  const result = await database.asPostgres((client) =>
    client.query<Record<string, string | null>>(
      `select number, customer_name, sales_order_id,
              net_amount_minor::text, tax_amount_minor::text, total_amount_minor::text,
              paid_amount_minor::text, payment_status, payment_method
       from public.sales_invoices where id = $1`,
      [invoiceId],
    ),
  );

  return result.rows[0]!;
}

describe('counter sales and invoices', () => {
  it('issues a sale through the outgoing order with amounts computed in the database', async () => {
    await receiveStock(PRODUCTS.a2, 10, 'inv-basic-receive');

    const invoice = await postInvoice({
      key: 'inv-basic-post',
      lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 3, taxRatePercent: '19' }],
      paidAmountMinor: 31773,
    });

    // 3 × 8900 catalog millimes, 19% tax, paid in full.
    expect(invoice.netAmountMinor).toBe(26700);
    expect(invoice.taxAmountMinor).toBe(5073);
    expect(invoice.totalAmountMinor).toBe(31773);
    expect(invoice.paymentStatus).toBe('paid');
    expect(invoice.paymentMethod).toBe('cash');
    expect(invoice.orderId).not.toBeNull();
    expect(invoice.number).toBe(`FI-${YEAR}-0001`);

    expect(await onHand(PRODUCTS.a2)).toBe(7);

    const movements = await invoiceMovements(invoice);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      movement_type: 'issue',
      reference_type: 'outgoing_order',
    });
    expect(Number(movements[0]!.quantity_delta)).toBe(-3);

    expect(
      await database.asPostgres((client) =>
        client.query<{ status: string }>('select status from public.sales_orders where id = $1', [
          invoice.orderId,
        ]),
      ),
    ).toMatchObject({ rows: [{ status: 'fulfilled' }] });

    const lines = await invoiceLines(invoice.invoiceId);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: 'product',
      unit_price_minor: '8900',
      tax_rate_percent: '19.0000',
      net_amount_minor: '26700',
      tax_amount_minor: '5073',
    });
    expect(lines[0]!.sales_order_line_id).not.toBeNull();
    expect(lines[0]!.device_id).toBeNull();
  });

  it('ignores prices invented by the caller only when they are absent, never when they lie', async () => {
    await receiveStock(EXTRA.priced, 5, 'inv-round-receive');

    const invoice = await postInvoice({
      key: 'inv-round-post',
      lines: [
        {
          kind: 'product',
          productId: EXTRA.priced,
          quantity: 1,
          unitPriceMinor: 999,
          taxRatePercent: '19',
        },
      ],
    });

    // 999 × 19% = 189.81 → rounding happens per line, then the lines are summed.
    expect(invoice.netAmountMinor).toBe(999);
    expect(invoice.taxAmountMinor).toBe(190);
    expect(invoice.totalAmountMinor).toBe(1189);
    expect(invoice.paymentStatus).toBe('unpaid');
    expect(invoice.paymentMethod).toBeNull();
  });

  it('replays a repeated idempotency key and moves stock exactly once', async () => {
    await receiveStock(PRODUCTS.a2, 10, 'inv-replay-receive');

    const lines = [{ kind: 'product', productId: PRODUCTS.a2, quantity: 2 }];
    const first = await postInvoice({ key: 'inv-replay-post', lines });
    const second = await postInvoice({ key: 'inv-replay-post', lines });

    expect(second.duplicate).toBe(true);
    expect(second.invoiceId).toBe(first.invoiceId);
    expect(second.number).toBe(first.number);
    expect(await onHand(PRODUCTS.a2)).toBe(8);
    expect(await countIn('sales_invoices')).toBe(1);
    expect(await countIn('stock_movements', `where movement_type = 'issue'`)).toBe(1);
  });

  it('refuses a reused key carrying a different payload', async () => {
    await receiveStock(PRODUCTS.a2, 10, 'inv-conflict-receive');
    await postInvoice({
      key: 'inv-conflict-post',
      lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
    });

    await expect(
      postInvoice({
        key: 'inv-conflict-post',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 5 }],
        fingerprint: OTHER_FINGERPRINT,
      }),
    ).rejects.toThrow(/idempotency_key_conflict/);
  });

  it('rolls the whole sale back when a line cannot be covered, including the device claim', async () => {
    await receiveStock(PRODUCTS.a2, 1, 'inv-rollback-receive');
    const device = await registerDevice('SN-INV-ROLLBACK', 'inv-rollback-device');

    await expect(
      postInvoice({
        key: 'inv-rollback-post',
        lines: [
          { kind: 'device', deviceId: device.deviceId },
          { kind: 'product', productId: PRODUCTS.a2, quantity: 4 },
        ],
      }),
    ).rejects.toThrow(/insufficient_stock|stock_reserved/);

    expect(await onHand(PRODUCTS.a2)).toBe(1);
    expect(await countIn('sales_invoices')).toBe(0);
    expect(await countIn('sales_orders')).toBe(0);
    expect(await countIn('stock_movements', `where movement_type = 'issue'`)).toBe(0);
    expect(await countIn('document_sequences')).toBe(0);
    expect((await deviceRow(device.deviceId)).status).toBe('in_stock');
  });

  it('sells serialized units through the device lifecycle with no ledger movement', async () => {
    const first = await registerDevice('SN-INV-0001', 'inv-serial-one');
    const second = await registerDevice('SN-INV-0002', 'inv-serial-two');

    const invoice = await postInvoice({
      key: 'inv-serial-post',
      lines: [
        { kind: 'device', deviceId: first.deviceId, unitPriceMinor: 3690000 },
        { kind: 'device', deviceId: second.deviceId, unitPriceMinor: 3690000 },
      ],
    });

    expect(invoice.orderId).toBeNull();
    expect(invoice.netAmountMinor).toBe(7380000);
    expect(invoice.taxAmountMinor).toBe(0);
    expect(invoice.lineCount).toBe(2);

    // A serialized product never enters the ledger, so selling one posts nothing.
    expect(await countIn('stock_movements')).toBe(0);
    expect(await onHand(PRODUCTS.a1)).toBe(0);

    const rows = await database.asPostgres((client) =>
      client.query<{
        device_id: string;
        event_type: string;
        status_from: string;
        status_to: string;
        note: string;
      }>(
        `select e.device_id, e.event_type, e.status_from, e.status_to, e.note
         from public.device_events e
         where e.organization_id = $1 and e.event_type = 'issued'
         order by e.device_id`,
        [ORGS.a],
      ),
    );

    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]).toMatchObject({
      event_type: 'issued',
      status_from: 'in_stock',
      status_to: 'sold',
      note: `Sold on FI-${YEAR}-0001`,
    });

    const lines = await invoiceLines(invoice.invoiceId);
    expect(lines.map((line) => line.kind)).toEqual(['device', 'device']);
    expect(lines[0]!.sales_order_line_id).toBeNull();
    expect(lines[0]!.device_id).not.toBeNull();
  });

  it('refuses a serialized product sold as a quantity, and a mixed basket keeps its sources apart', async () => {
    await expect(
      postInvoice({
        key: 'inv-serialized-qty',
        lines: [{ kind: 'product', productId: PRODUCTS.a1, quantity: 1 }],
      }),
    ).rejects.toThrow(/serialized_line_requires_device/);

    await receiveStock(PRODUCTS.a2, 4, 'inv-mixed-receive');
    const device = await registerDevice('SN-INV-MIXED', 'inv-mixed-device');

    const invoice = await postInvoice({
      key: 'inv-mixed-post',
      lines: [
        { kind: 'device', deviceId: device.deviceId },
        { kind: 'product', productId: PRODUCTS.a2, quantity: 2 },
      ],
    });

    const lines = await invoiceLines(invoice.invoiceId);
    expect(lines).toHaveLength(2);
    expect(lines.filter((line) => line.kind === 'device')[0]).toMatchObject({
      unit_price_minor: '3690000',
      sales_order_line_id: null,
    });
    expect(lines.filter((line) => line.kind === 'product')[0]).toMatchObject({
      unit_price_minor: '8900',
      device_id: null,
    });

    // Only the bulk line moves stock; the device line is a lifecycle event.
    const movements = await invoiceMovements(invoice);
    expect(movements).toHaveLength(1);
    expect(Number(movements[0]!.quantity_delta)).toBe(-2);
  });

  it('keeps one physical unit in one sale', async () => {
    const device = await registerDevice('SN-INV-DOUBLE', 'inv-double-device');

    await expect(
      postInvoice({
        key: 'inv-double-same-line',
        lines: [
          { kind: 'device', deviceId: device.deviceId },
          { kind: 'device', deviceId: device.deviceId },
        ],
      }),
    ).rejects.toThrow(/duplicate_device/);

    await postInvoice({
      key: 'inv-double-first',
      lines: [{ kind: 'device', deviceId: device.deviceId }],
    });

    await expect(
      postInvoice({
        key: 'inv-double-second',
        lines: [{ kind: 'device', deviceId: device.deviceId }],
      }),
    ).rejects.toThrow(/device_not_in_stock/);
  });

  it('rejects a device that is not in the selling location', async () => {
    const device = await registerDevice('SN-INV-ELSEWHERE', 'inv-elsewhere-device');
    const backRoom = '60000000-0000-4000-8000-000000000099';

    await database.asPostgres((client) =>
      client.query(
        `insert into public.storage_locations (id, organization_id, warehouse_id, code, name)
         values ($1, $2, $3, 'A-99', 'Back room')`,
        [backRoom, ORGS.a, WAREHOUSES.a],
      ),
    );
    await database.asPostgres((client) =>
      client.query('update public.devices set location_id = $2 where id = $1', [
        device.deviceId,
        backRoom,
      ]),
    );

    await expect(
      postInvoice({
        key: 'inv-elsewhere-post',
        lines: [{ kind: 'device', deviceId: device.deviceId }],
      }),
    ).rejects.toThrow(/device_wrong_location/);
  });

  it('collects a credit sale in parts and refuses to over-collect', async () => {
    await receiveStock(PRODUCTS.a2, 10, 'inv-credit-receive');

    const invoice = await postInvoice({
      key: 'inv-credit-post',
      lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 4 }],
      paidAmountMinor: 1000,
      paymentMethod: 'credit',
    });

    expect(invoice.totalAmountMinor).toBe(35600);
    expect(invoice.paidAmountMinor).toBe(1000);
    expect(invoice.remainingAmountMinor).toBe(34600);
    expect(invoice.paymentStatus).toBe('partial');
    expect(invoice.paymentMethod).toBe('credit');

    const partial = await recordPayment(invoice.invoiceId, 500, 'cash', 'inv-credit-second');
    expect(partial.paymentStatus).toBe('partial');
    expect(partial.paidAmountMinor).toBe(1500);

    const replayed = await recordPayment(invoice.invoiceId, 500, 'cash', 'inv-credit-second');
    expect(replayed.duplicate).toBe(true);
    expect(replayed.paidAmountMinor).toBe(1500);

    const settled = await recordPayment(
      invoice.invoiceId,
      34100,
      'bank_transfer',
      'inv-credit-third',
    );
    expect(settled.paymentStatus).toBe('paid');
    expect(settled.remainingAmountMinor).toBe(0);

    await expect(recordPayment(invoice.invoiceId, 1, 'cash', 'inv-credit-over')).rejects.toThrow(
      /payment_exceeds_total/,
    );

    expect(
      await countIn('sales_invoice_payments', `where sales_invoice_id = '${invoice.invoiceId}'`),
    ).toBe(3);
  });

  it('snapshots the customer and stops issuing to a deactivated one', async () => {
    await receiveStock(PRODUCTS.a2, 10, 'inv-customer-receive');
    const customer = await saveCustomer('SBS Vision');

    const invoice = await postInvoice({
      key: 'inv-customer-post',
      lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
      customerId: customer.customerId,
      customerName: null,
    });

    expect((await invoiceRow(invoice.invoiceId)).customer_name).toBe('SBS Vision');

    await saveCustomer('SBS Vision SARL', customer.customerId);
    expect((await invoiceRow(invoice.invoiceId)).customer_name).toBe('SBS Vision');

    await call(`select app.set_customer_active($1::uuid, $2::uuid, false) as result`, [
      ORGS.a,
      customer.customerId,
    ]);

    await expect(
      postInvoice({
        key: 'inv-customer-inactive',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
        customerId: customer.customerId,
        customerName: null,
      }),
    ).rejects.toThrow(/customer_not_active/);

    await expect(
      postInvoice({
        key: 'inv-customer-missing',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
        customerId: '99999999-0000-4000-8000-000000000000',
        customerName: null,
      }),
    ).rejects.toThrow(/customer_not_found/);

    await expect(
      postInvoice({
        key: 'inv-customer-required',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
        customerName: null,
      }),
    ).rejects.toThrow(/customer_name_required/);
  });

  it('refuses to invent a price, a tax rate or a payment method', async () => {
    await expect(
      postInvoice({
        key: 'inv-unpriced',
        lines: [{ kind: 'product', productId: EXTRA.unpriced, quantity: 1 }],
      }),
    ).rejects.toThrow(/product_price_undefined/);

    await expect(
      postInvoice({
        key: 'inv-bad-tax',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1, taxRatePercent: '120' }],
      }),
    ).rejects.toThrow(/order_line_invalid/);

    await expect(
      postInvoice({
        key: 'inv-bad-method',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
        paymentMethod: 'crypto',
      }),
    ).rejects.toThrow(/invalid_payment_method/);
  });

  it('numbers invoices per organization and keeps tenants apart', async () => {
    await receiveStock(PRODUCTS.a2, 10, 'inv-number-receive');

    const first = await postInvoice({
      key: 'inv-number-one',
      lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
    });
    const second = await postInvoice({
      key: 'inv-number-two',
      lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
    });

    expect(first.number).toBe(`FI-${YEAR}-0001`);
    expect(second.number).toBe(`FI-${YEAR}-0002`);

    // Alice is not a member of Bob's tenant, so she cannot sell from it.
    await expect(
      postInvoice({
        key: 'inv-number-cross-tenant',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
        organization: ORGS.b,
      }),
    ).rejects.toThrow(/forbidden/);

    const bobDevice = await registerDevice('SN-B-0001', 'inv-number-bob-register', {
      organization: ORGS.b,
      user: USERS.bob,
    });
    const bobInvoice = await postInvoice({
      key: 'inv-number-bob',
      lines: [{ kind: 'device', deviceId: bobDevice.deviceId }],
      organization: ORGS.b,
      user: USERS.bob,
      warehouse: WAREHOUSES.b,
      location: LOCATIONS.b,
      customerName: 'Bob only',
    });

    expect(bobInvoice.number).toBe(`FI-${YEAR}-0001`);
    expect(await countIn('sales_invoices', `where organization_id = '${ORGS.b}'`)).toBe(1);
  });

  it('enforces roles in the database and keeps the new tables read-only to applications', async () => {
    await receiveStock(PRODUCTS.a2, 10, 'inv-role-receive');

    await expect(
      postInvoice({
        key: 'inv-role-viewer',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
        user: USERS.dave,
      }),
    ).rejects.toThrow(/forbidden/);

    await expect(
      postInvoice({
        key: 'inv-role-outsider',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
        user: USERS.carol,
      }),
    ).rejects.toThrow(/forbidden/);

    const writes = [
      `insert into public.sales_invoices (organization_id, number, warehouse_id, location_id,
         customer_name, net_amount_minor, tax_amount_minor, total_amount_minor)
       values ('${ORGS.a}', 'FI-X-0001', '${WAREHOUSES.a}', '${LOCATIONS.a}',
         'Ghost', 0, 0, 0)`,
      `insert into public.customers (organization_id, name) values ('${ORGS.a}', 'Ghost')`,
      `update public.sales_invoices set customer_name = 'Rewritten' where number = 'FI-X-0001'`,
      `delete from public.sales_invoice_lines`,
    ];

    for (const statement of writes) {
      await expect(
        database.asUser(USERS.alice, (client) => client.query(statement), { commit: true }),
      ).rejects.toThrow(/permission denied/);
    }

    // Every member reads invoices, including the viewer who cannot post one.
    const visible = await database.asUser(USERS.dave, (client) =>
      client.query('select id from public.sales_invoices'),
    );

    expect(visible.rows).toHaveLength(0);
  });
});
