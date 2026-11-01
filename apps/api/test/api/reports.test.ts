import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CATEGORIES, LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const SECOND_WAREHOUSE = '50000000-0000-4000-8000-0000000000a2';
const SECOND_LOCATION = '60000000-0000-4000-8000-0000000000a2';
const DEVICE_ID = '70000000-0000-4000-8000-0000000000a1';

describe('reports API', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let daveToken: string;
  let bobToken: string;

  const auth = (token: string) => `Bearer ${token}`;
  const base = `/api/v1/organizations/${ORGS.a}`;
  const windowFrom = new Date(Date.now() - 86_400_000).toISOString();
  const windowTo = new Date(Date.now() + 86_400_000).toISOString();

  const fetchCsv = (path: string, query: Record<string, string> = {}) =>
    request(ctx.app.getHttpServer())
      .get(`${base}${path}`)
      .query(query)
      .set('authorization', auth(aliceToken))
      .buffer(true)
      .parse((res, callback) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString('utf8');
        });
        res.on('end', () => callback(null, data));
      });

  beforeAll(async () => {
    ctx = await createTestContext();
    aliceToken = await ctx.tokenFor(USERS.alice);
    daveToken = await ctx.tokenFor(USERS.dave);
    bobToken = await ctx.tokenFor(USERS.bob);

    await ctx.database.query(
      `insert into public.warehouses (id, organization_id, code, name)
       values ($1, $2, 'SECOND', 'Second warehouse')`,
      [SECOND_WAREHOUSE, ORGS.a],
    );
    await ctx.database.query(
      `insert into public.storage_locations (id, organization_id, warehouse_id, code, name)
       values ($1, $2, $3, 'B-01', 'Aisle B shelf 01')`,
      [SECOND_LOCATION, ORGS.a, SECOND_WAREHOUSE],
    );
    await ctx.database.query(`update public.products set name = $1 where id = $2`, [
      'USB-C cable, 2m',
      PRODUCTS.a2,
    ]);
    await ctx.database.query(`update public.products set reorder_threshold = 5 where id = $1`, [
      PRODUCTS.a2,
    ]);
    await ctx.database.query(`update public.products set reorder_threshold = 2 where id = $1`, [
      PRODUCTS.a1,
    ]);
    await ctx.database.query(
      `insert into public.devices (
         id, organization_id, product_id, serial_number, imei, status, warehouse_id, location_id
       )
       values ($1, $2, $3, 'SN-REPORT-0001', '356789104512399', 'in_stock', $4, $5)`,
      [DEVICE_ID, ORGS.a, PRODUCTS.a1, WAREHOUSES.a, LOCATIONS.a],
    );

    const post = (path: string, key: string, body: Record<string, unknown>) =>
      request(ctx.app.getHttpServer())
        .post(`${base}${path}`)
        .set('authorization', auth(aliceToken))
        .set('idempotency-key', key)
        .send(body);

    const receipt = await post('/stock-movements', 'report-receipt-1', {
      productId: PRODUCTS.a2,
      warehouseId: WAREHOUSES.a,
      locationId: LOCATIONS.a,
      type: 'receipt',
      quantity: 10,
      reason: 'Opening stock',
    });
    expect(receipt.status).toBe(200);

    const issue = await post('/stock-movements', 'report-issue-1', {
      productId: PRODUCTS.a2,
      warehouseId: WAREHOUSES.a,
      locationId: LOCATIONS.a,
      type: 'issue',
      quantity: 4,
      reason: 'Customer sale',
    });
    expect(issue.status).toBe(200);

    const transfer = await post('/stock-transfers', 'report-transfer-1', {
      productId: PRODUCTS.a2,
      sourceWarehouseId: WAREHOUSES.a,
      sourceLocationId: LOCATIONS.a,
      targetWarehouseId: SECOND_WAREHOUSE,
      targetLocationId: SECOND_LOCATION,
      quantity: 2,
    });
    expect(transfer.status).toBe(200);

    const reservation = await post('/stock-reservations', 'report-reserve-1', {
      productId: PRODUCTS.a2,
      warehouseId: WAREHOUSES.a,
      locationId: LOCATIONS.a,
      quantity: 2,
    });
    expect(reservation.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('matches totals computed independently from the ledger tables', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/overview`)
      .query({ from: windowFrom, to: windowTo })
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);

    const balances = await ctx.database.query<{
      on_hand: string;
      product_count: number;
      location_count: number;
      warehouse_count: number;
      purchase_value_minor: string;
      sale_value_minor: string;
    }>(
      `select coalesce(sum(b.on_hand), 0)::text as on_hand,
              count(distinct b.product_id)::int as product_count,
              count(*)::int as location_count,
              count(distinct b.warehouse_id)::int as warehouse_count,
              coalesce(sum(round(b.on_hand * p.purchase_price_minor)), 0)::text
                as purchase_value_minor,
              coalesce(sum(round(b.on_hand * p.sale_price_minor)), 0)::text as sale_value_minor
       from public.stock_balances b
       join public.products p
         on p.id = b.product_id and p.organization_id = b.organization_id
       where b.organization_id = $1`,
      [ORGS.a],
    );
    const reservations = await ctx.database.query<{ reserved: string }>(
      `select coalesce(sum(quantity), 0)::text as reserved
       from public.stock_reservations
       where organization_id = $1 and status = 'active'`,
      [ORGS.a],
    );
    const devices = await ctx.database.query<{
      serialized_in_stock: number;
      purchase_value_minor: string;
      sale_value_minor: string;
    }>(
      `select count(*)::int as serialized_in_stock,
              coalesce(sum(round(p.purchase_price_minor)), 0)::text as purchase_value_minor,
              coalesce(sum(round(p.sale_price_minor)), 0)::text as sale_value_minor
       from public.devices d
       join public.products p
         on p.id = d.product_id and p.organization_id = d.organization_id
       where d.organization_id = $1 and d.status = 'in_stock'`,
      [ORGS.a],
    );

    const balanceRow = balances.rows[0]!;
    const deviceRow = devices.rows[0]!;
    const onHand = Number(balanceRow.on_hand);
    const reserved = Number(reservations.rows[0]!.reserved);

    expect(response.body.totals).toEqual({
      onHand,
      reserved,
      available: onHand - reserved,
      productCount: balanceRow.product_count,
      locationCount: balanceRow.location_count,
      warehouseCount: balanceRow.warehouse_count,
      serializedInStock: deviceRow.serialized_in_stock,
    });
    expect(response.body.totals).toMatchObject({
      onHand: 6,
      reserved: 2,
      available: 4,
      productCount: 1,
      locationCount: 2,
      warehouseCount: 2,
      serializedInStock: 1,
    });
    expect(response.body.valuation).toEqual({
      purchaseValueMinor:
        Number(balanceRow.purchase_value_minor) + Number(deviceRow.purchase_value_minor),
      saleValueMinor: Number(balanceRow.sale_value_minor) + Number(deviceRow.sale_value_minor),
      unpricedProductCount: 0,
    });
    expect(response.body.valuation).toMatchObject({
      purchaseValueMinor: 6 * 4500 + 3_150_000,
      saleValueMinor: 6 * 8900 + 3_690_000,
    });
  });

  it('aggregates the movement window from the ledger', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/overview`)
      .query({ from: windowFrom, to: windowTo })
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);

    const ledger = await ctx.database.query<{
      count: number;
      received: string;
      issued: string;
      net: string;
    }>(
      `select count(*)::int as count,
              coalesce(sum(case when movement_type in ('receipt', 'transfer_in')
                then quantity_delta else 0 end), 0)::text as received,
              coalesce(sum(case when movement_type in ('issue', 'transfer_out')
                then -quantity_delta else 0 end), 0)::text as issued,
              coalesce(sum(quantity_delta), 0)::text as net
       from public.stock_movements
       where organization_id = $1 and created_at between $2 and $3`,
      [ORGS.a, windowFrom, windowTo],
    );

    const ledgerRow = ledger.rows[0]!;

    expect(response.body.movements).toEqual({
      count: ledgerRow.count,
      receivedQuantity: Number(ledgerRow.received),
      issuedQuantity: Number(ledgerRow.issued),
      adjustedQuantity: 0,
      netQuantity: Number(ledgerRow.net),
    });
    expect(response.body.movements).toMatchObject({
      count: 4,
      receivedQuantity: 12,
      issuedQuantity: 6,
      netQuantity: 6,
    });

    expect(response.body.series).toHaveLength(3);
    const seriesNet = response.body.series.reduce(
      (sum: number, point: { netQuantity: number }) => sum + point.netQuantity,
      0,
    );
    expect(seriesNet).toBe(response.body.movements.netQuantity);
    expect(
      response.body.series.reduce(
        (sum: number, point: { receivedQuantity: number }) => sum + point.receivedQuantity,
        0,
      ),
    ).toBe(12);
  });

  it('breaks totals down per warehouse', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/overview`)
      .query({ from: windowFrom, to: windowTo })
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);
    expect(response.body.warehouses).toEqual([
      {
        warehouseId: WAREHOUSES.a,
        code: 'MAIN',
        name: 'Main warehouse',
        onHand: 4,
        reserved: 2,
        available: 2,
        purchaseValueMinor: 4 * 4500 + 3_150_000,
        saleValueMinor: 4 * 8900 + 3_690_000,
        serializedInStock: 1,
      },
      {
        warehouseId: SECOND_WAREHOUSE,
        code: 'SECOND',
        name: 'Second warehouse',
        onHand: 2,
        reserved: 0,
        available: 2,
        purchaseValueMinor: 2 * 4500,
        saleValueMinor: 2 * 8900,
        serializedInStock: 0,
      },
    ]);
  });

  it('applies warehouse and category filters', async () => {
    const byWarehouse = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/overview`)
      .query({ from: windowFrom, to: windowTo, warehouseId: SECOND_WAREHOUSE })
      .set('authorization', auth(aliceToken));

    expect(byWarehouse.status).toBe(200);
    expect(byWarehouse.body.totals).toMatchObject({
      onHand: 2,
      reserved: 0,
      available: 2,
      warehouseCount: 1,
      serializedInStock: 0,
    });
    expect(byWarehouse.body.movements).toMatchObject({
      count: 1,
      receivedQuantity: 2,
      netQuantity: 2,
    });
    expect(byWarehouse.body.warehouses).toHaveLength(1);
    expect(byWarehouse.body.warehouses[0].code).toBe('SECOND');

    const byCategory = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/overview`)
      .query({ from: windowFrom, to: windowTo, categoryId: CATEGORIES.aChild })
      .set('authorization', auth(aliceToken));

    expect(byCategory.status).toBe(200);
    expect(byCategory.body.totals).toMatchObject({
      onHand: 0,
      reserved: 0,
      available: 0,
      productCount: 0,
      serializedInStock: 1,
    });
    expect(byCategory.body.valuation).toMatchObject({
      purchaseValueMinor: 3_150_000,
      saleValueMinor: 3_690_000,
    });
    expect(byCategory.body.movements.count).toBe(0);
  });

  it('rejects impossible or oversized windows', async () => {
    const reversed = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/overview`)
      .query({ from: windowTo, to: windowFrom })
      .set('authorization', auth(aliceToken));
    expect(reversed.status).toBe(400);
    expect(reversed.body.error.code).toBe('validation_error');

    const oversized = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/overview`)
      .query({ from: '2024-01-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' })
      .set('authorization', auth(aliceToken));
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.code).toBe('validation_error');
  });

  it('lists low-stock products by shortfall for ledger and serialized stock', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/low-stock`)
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.items).toEqual([
      {
        productId: PRODUCTS.a1,
        sku: 'IPHONE-15',
        productName: 'iPhone 15 128GB',
        categoryName: 'Smartphones',
        isSerialized: true,
        reorderThreshold: 2,
        onHand: 1,
        reserved: 0,
        available: 1,
        shortfall: 1,
      },
      {
        productId: PRODUCTS.a2,
        sku: 'CABLE-USB-C',
        productName: 'USB-C cable, 2m',
        categoryName: 'Phones',
        isSerialized: false,
        reorderThreshold: 5,
        onHand: 6,
        reserved: 2,
        available: 4,
        shortfall: 1,
      },
    ]);

    const filtered = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/low-stock`)
      .query({ warehouseId: SECOND_WAREHOUSE })
      .set('authorization', auth(aliceToken));

    expect(filtered.status).toBe(200);
    expect(filtered.body.total).toBe(2);
    expect(filtered.body.items[0]).toMatchObject({
      productId: PRODUCTS.a2,
      onHand: 2,
      available: 2,
      shortfall: 3,
    });
    expect(filtered.body.items[1]).toMatchObject({
      productId: PRODUCTS.a1,
      available: 0,
      shortfall: 2,
    });

    const byCategory = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/low-stock`)
      .query({ categoryId: CATEGORIES.aChild })
      .set('authorization', auth(aliceToken));

    expect(byCategory.status).toBe(200);
    expect(byCategory.body.total).toBe(1);
    expect(byCategory.body.items[0].productId).toBe(PRODUCTS.a1);

    const paged = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/low-stock`)
      .query({ page: 2, pageSize: 1 })
      .set('authorization', auth(aliceToken));

    expect(paged.status).toBe(200);
    expect(paged.body.total).toBe(2);
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.items[0].productId).toBe(PRODUCTS.a2);
  });

  it('allows viewers and hides other tenants', async () => {
    const viewerOverview = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/overview`)
      .set('authorization', auth(daveToken));
    expect(viewerOverview.status).toBe(200);

    const viewerLowStock = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/low-stock`)
      .set('authorization', auth(daveToken));
    expect(viewerLowStock.status).toBe(200);

    const foreign = await request(ctx.app.getHttpServer())
      .get(`${base}/reports/overview`)
      .set('authorization', auth(bobToken));
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('organization_not_found');

    const ownOrgB = await request(ctx.app.getHttpServer())
      .get(`/api/v1/organizations/${ORGS.b}/reports/overview`)
      .set('authorization', auth(aliceToken));
    expect(ownOrgB.status).toBe(404);
  });

  it('exports stock levels as CSV with filters and quoting', async () => {
    const response = await fetchCsv('/reports/exports/stock-levels.csv');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain(
      'attachment; filename="nexora-stock-levels-',
    );

    const lines = (response.body as string).trim().split('\r\n');
    expect(lines[0]).toBe(
      'sku,product,warehouse_code,location_code,on_hand,reserved,available,updated_at',
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"USB-C cable, 2m",MAIN,A-01,4.0000,2.0000,2.0000,');
    expect(lines[2]).toContain('"USB-C cable, 2m",SECOND,B-01,2.0000,0.0000,2.0000,');

    const filtered = await fetchCsv('/reports/exports/stock-levels.csv', {
      warehouseId: SECOND_WAREHOUSE,
    });

    const filteredLines = (filtered.body as string).trim().split('\r\n');
    expect(filteredLines).toHaveLength(2);
    expect(filteredLines[1]).toContain('SECOND,B-01');
  });

  it('exports movements as CSV and honours movement filters', async () => {
    const response = await fetchCsv('/reports/exports/movements.csv');

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain(
      'attachment; filename="nexora-stock-movements-',
    );

    const lines = (response.body as string).trim().split('\r\n');
    expect(lines[0]).toBe(
      'created_at,type,sku,product,warehouse_code,location_code,quantity_delta,on_hand_after,reference_type,reference_id,reason,actor_id',
    );
    expect(lines).toHaveLength(5);

    const receipts = await fetchCsv('/reports/exports/movements.csv', {
      movementType: 'receipt',
      from: windowFrom,
      to: windowTo,
    });

    const receiptLines = (receipts.body as string).trim().split('\r\n');
    expect(receiptLines).toHaveLength(2);
    expect(receiptLines[1]).toContain(',receipt,CABLE-USB-C,"USB-C cable, 2m",MAIN,A-01,');
  });
});
