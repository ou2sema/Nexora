import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const YEAR = new Date().getFullYear();
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

describe('returns API', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let daveToken: string;
  let bobToken: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    aliceToken = await ctx.tokenFor(USERS.alice);
    daveToken = await ctx.tokenFor(USERS.dave);
    bobToken = await ctx.tokenFor(USERS.bob);

    const seed = await request(ctx.app.getHttpServer())
      .post(`/api/v1/organizations/${ORGS.a}/stock-movements`)
      .set('authorization', `Bearer ${aliceToken}`)
      .set('idempotency-key', 'returns-seed-stock-0001')
      .send({
        productId: PRODUCTS.a2,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'receipt',
        quantity: 100,
        reason: 'Opening balance for returns tests',
      });

    expect(seed.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => `Bearer ${token}`;
  const suppliersUrl = `/api/v1/organizations/${ORGS.a}/suppliers`;
  const purchaseUrl = `/api/v1/organizations/${ORGS.a}/purchase-orders`;
  const salesUrl = `/api/v1/organizations/${ORGS.a}/sales-orders`;
  const reportsUrl = `/api/v1/organizations/${ORGS.a}/reports`;

  async function createSupplier(name: string) {
    const response = await request(ctx.app.getHttpServer())
      .post(suppliersUrl)
      .set('authorization', auth(aliceToken))
      .send({ name });

    expect(response.status).toBe(201);
    return response.body as { id: string; name: string };
  }

  async function createPurchaseOrder(
    supplierId: string,
    lines: { productId: string; quantity: number; unitCostMinor?: number }[],
    key: string,
    payload: Record<string, unknown> = {},
  ) {
    const response = await request(ctx.app.getHttpServer())
      .post(purchaseUrl)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', key)
      .send({
        supplierId,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        lines,
        ...payload,
      });

    expect(response.status).toBe(201);
    return response.body as { orderId: string; number: string; status: string };
  }

  async function purchaseOrderDetail(orderId: string) {
    const response = await request(ctx.app.getHttpServer())
      .get(`${purchaseUrl}/${orderId}`)
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);
    return response.body as {
      lines: {
        id: string;
        productId: string;
        quantityOrdered: number;
        quantityReceived: number;
        quantityReturned: number;
      }[];
    };
  }

  async function receivePurchaseOrder(
    orderId: string,
    lines: { lineId: string; quantity: number; serials?: { serialNumber: string }[] }[],
    key: string,
  ) {
    return request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${orderId}/receipts`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', key)
      .send({ lines });
  }

  async function createSalesOrder(lines: { productId: string; quantity: number }[], key: string) {
    const response = await request(ctx.app.getHttpServer())
      .post(salesUrl)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', key)
      .send({
        customerName: 'Northwind Traders',
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        lines,
      });

    expect(response.status).toBe(201);
    return response.body as { orderId: string; number: string };
  }

  async function salesOrderDetail(orderId: string) {
    const response = await request(ctx.app.getHttpServer())
      .get(`${salesUrl}/${orderId}`)
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);
    return response.body as {
      lines: { id: string; productId: string; quantity: number; quantityReturned: number }[];
    };
  }

  const transition = (url: string, key: string, token = aliceToken) =>
    request(ctx.app.getHttpServer())
      .post(url)
      .set('authorization', auth(token))
      .set('idempotency-key', key)
      .send({});

  async function stockLevel(productId: string) {
    const response = await request(ctx.app.getHttpServer())
      .get(`/api/v1/organizations/${ORGS.a}/stock-levels?productId=${productId}`)
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);
    return response.body.items[0] ?? { onHand: 0 };
  }

  it('creates, posts, and cancels purchase returns against received lines', async () => {
    const supplier = await createSupplier('Atlas Components');
    const order = await createPurchaseOrder(
      supplier.id,
      [{ productId: PRODUCTS.a2, quantity: 10, unitCostMinor: 1200 }],
      'returns-po-0001',
      { expectedOn: tomorrow },
    );
    expect(order.status).toBe('draft');

    await transition(`${purchaseUrl}/${order.orderId}/order`, 'returns-po-order-0001');
    const lineId = (await purchaseOrderDetail(order.orderId)).lines[0]!.id;
    const received = await receivePurchaseOrder(
      order.orderId,
      [{ lineId, quantity: 6 }],
      'returns-po-receive-0001',
    );
    expect(received.status).toBe(200);
    expect((await stockLevel(PRODUCTS.a2)).onHand).toBe(106);

    const created = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'returns-pr-create-0001')
      .send({
        reason: 'Damaged in transit',
        lines: [{ purchaseOrderLineId: lineId, quantity: 2 }],
      });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: 'draft',
      number: `PR-${YEAR}-0001`,
      quantity: 2,
      duplicate: false,
    });
    const returnId = created.body.returnId as string;

    const replay = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'returns-pr-create-0001')
      .send({
        reason: 'Damaged in transit',
        lines: [{ purchaseOrderLineId: lineId, quantity: 2 }],
      });

    expect(replay.status).toBe(201);
    expect(replay.body.duplicate).toBe(true);
    expect(replay.body.returnId).toBe(returnId);

    const list = await request(ctx.app.getHttpServer())
      .get(`${purchaseUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken));

    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].status).toBe('draft');

    const posted = await transition(
      `${purchaseUrl}/${order.orderId}/returns/${returnId}/post`,
      'returns-pr-post-0001',
    );
    expect(posted.status).toBe(200);
    expect(posted.body).toMatchObject({ status: 'posted', quantity: 2 });
    expect((await stockLevel(PRODUCTS.a2)).onHand).toBe(104);

    const detail = await request(ctx.app.getHttpServer())
      .get(`${purchaseUrl}/${order.orderId}/returns/${returnId}`)
      .set('authorization', auth(aliceToken));

    expect(detail.status).toBe(200);
    expect(detail.body.lines[0]).toMatchObject({
      quantity: 2,
      quantityReceived: 6,
      isSerialized: false,
    });

    const orderAfter = await purchaseOrderDetail(order.orderId);
    expect(orderAfter.lines[0]!.quantityReturned).toBe(2);

    const overReturn = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'returns-pr-over-0001')
      .send({ reason: 'Too many units', lines: [{ purchaseOrderLineId: lineId, quantity: 5 }] });

    expect(overReturn.status).toBe(400);
    expect(overReturn.body.error.message).toMatch(/exceeds the quantity received/);

    const draft = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'returns-pr-draft-0001')
      .send({ reason: 'Wrong reference', lines: [{ purchaseOrderLineId: lineId, quantity: 1 }] });

    expect(draft.status).toBe(201);

    const cancelled = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/returns/${draft.body.returnId}/cancel`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'returns-pr-cancel-0001')
      .send({ reason: 'Created by mistake' });

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect((await stockLevel(PRODUCTS.a2)).onHand).toBe(104);
  });

  it('disposes the devices selected by a serialized purchase return', async () => {
    const supplier = await createSupplier('Mobile Supply House');
    const order = await createPurchaseOrder(
      supplier.id,
      [{ productId: PRODUCTS.a1, quantity: 2, unitCostMinor: 3000000 }],
      'returns-serial-po-0001',
    );
    await transition(`${purchaseUrl}/${order.orderId}/order`, 'returns-serial-order-0001');

    const lineId = (await purchaseOrderDetail(order.orderId)).lines[0]!.id;
    const received = await receivePurchaseOrder(
      order.orderId,
      [
        {
          lineId,
          quantity: 2,
          serials: [{ serialNumber: 'SN-RET-API-001' }, { serialNumber: 'SN-RET-API-002' }],
        },
      ],
      'returns-serial-receive-0001',
    );
    expect(received.status).toBe(200);

    const devices = await request(ctx.app.getHttpServer())
      .get(`/api/v1/organizations/${ORGS.a}/devices?productId=${PRODUCTS.a1}`)
      .set('authorization', auth(aliceToken));

    expect(devices.status).toBe(200);
    const deviceIds = (devices.body.items as { id: string; serialNumber: string }[]).map(
      (device) => device.id,
    );
    expect(deviceIds).toHaveLength(2);

    const created = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'returns-serial-create-0001')
      .send({
        reason: 'Dead pixels on arrival',
        lines: [{ purchaseOrderLineId: lineId, quantity: 2, deviceIds }],
      });

    expect(created.status).toBe(201);

    const posted = await transition(
      `${purchaseUrl}/${order.orderId}/returns/${created.body.returnId}/post`,
      'returns-serial-post-0001',
    );
    expect(posted.status).toBe(200);

    for (const deviceId of deviceIds) {
      const device = await request(ctx.app.getHttpServer())
        .get(`/api/v1/organizations/${ORGS.a}/devices/${deviceId}`)
        .set('authorization', auth(aliceToken));

      expect(device.status).toBe(200);
      expect(device.body.status).toBe('disposed');
    }
  });

  it('restocks a fulfilled outgoing line through a sales return', async () => {
    const order = await createSalesOrder(
      [{ productId: PRODUCTS.a2, quantity: 4 }],
      'returns-sales-0001',
    );
    await transition(`${salesUrl}/${order.orderId}/confirm`, 'returns-sales-confirm-0001');
    await transition(`${salesUrl}/${order.orderId}/fulfil`, 'returns-sales-fulfil-0001');

    const onHandBefore = (await stockLevel(PRODUCTS.a2)).onHand;
    const lineId = (await salesOrderDetail(order.orderId)).lines[0]!.id;

    const created = await request(ctx.app.getHttpServer())
      .post(`${salesUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'returns-sr-create-0001')
      .send({
        reason: 'Customer changed mind',
        lines: [{ salesOrderLineId: lineId, quantity: 2 }],
      });

    expect(created.status).toBe(201);
    expect(created.body.number).toBe(`SR-${YEAR}-0001`);

    const posted = await transition(
      `${salesUrl}/${order.orderId}/returns/${created.body.returnId}/post`,
      'returns-sr-post-0001',
    );
    expect(posted.status).toBe(200);
    expect((await stockLevel(PRODUCTS.a2)).onHand).toBe(onHandBefore + 2);

    const salesDetail = await salesOrderDetail(order.orderId);
    expect(salesDetail.lines[0]!.quantityReturned).toBe(2);

    const list = await request(ctx.app.getHttpServer())
      .get(`${salesUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken));

    expect(list.status).toBe(200);
    expect(list.body.items[0]).toMatchObject({ status: 'posted', totalQuantity: 2 });

    const excess = await request(ctx.app.getHttpServer())
      .post(`${salesUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'returns-sr-excess-0001')
      .send({ reason: 'Too many units', lines: [{ salesOrderLineId: lineId, quantity: 3 }] });

    expect(excess.status).toBe(400);
    expect(excess.body.error.message).toMatch(/exceeds the quantity fulfilled/);
  });

  it('reports supplier on-time, lead time, and return rate', async () => {
    const supplier = await createSupplier('Semiconductor Partners');

    const first = await createPurchaseOrder(
      supplier.id,
      [{ productId: PRODUCTS.a2, quantity: 4, unitCostMinor: 1000 }],
      'returns-perf-po-1',
      { expectedOn: today },
    );
    await transition(`${purchaseUrl}/${first.orderId}/order`, 'returns-perf-order-1');
    const firstLineId = (await purchaseOrderDetail(first.orderId)).lines[0]!.id;
    let received = await receivePurchaseOrder(
      first.orderId,
      [{ lineId: firstLineId, quantity: 4 }],
      'returns-perf-receive-1',
    );
    expect(received.status).toBe(200);

    const second = await createPurchaseOrder(
      supplier.id,
      [{ productId: PRODUCTS.a2, quantity: 2, unitCostMinor: 500 }],
      'returns-perf-po-2',
      { expectedOn: yesterday },
    );
    await transition(`${purchaseUrl}/${second.orderId}/order`, 'returns-perf-order-2');
    const secondLineId = (await purchaseOrderDetail(second.orderId)).lines[0]!.id;
    received = await receivePurchaseOrder(
      second.orderId,
      [{ lineId: secondLineId, quantity: 2 }],
      'returns-perf-receive-2',
    );
    expect(received.status).toBe(200);

    const created = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${first.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'returns-perf-return-1')
      .send({ reason: 'Faulty batch', lines: [{ purchaseOrderLineId: firstLineId, quantity: 1 }] });

    expect(created.status).toBe(201);

    await transition(
      `${purchaseUrl}/${first.orderId}/returns/${created.body.returnId}/post`,
      'returns-perf-post-1',
    );

    const report = await request(ctx.app.getHttpServer())
      .get(`${reportsUrl}/supplier-performance?supplierId=${supplier.id}&from=${today}&to=${today}`)
      .set('authorization', auth(daveToken));

    expect(report.status).toBe(200);
    expect(report.body.window).toEqual({ from: today, to: today });
    expect(report.body.suppliers).toHaveLength(1);

    const row = report.body.suppliers[0];
    expect(row).toMatchObject({
      supplierId: supplier.id,
      supplierName: 'Semiconductor Partners',
      ordersCreated: 2,
      ordersReceived: 2,
      onTimeOrders: 1,
      lateOrders: 1,
      orderedValueMinor: 5000,
      receivedValueMinor: 5000,
      receivedQuantity: 6,
      returnedQuantity: 1,
    });
    expect(row.onTimeRate).toBeCloseTo(0.5, 5);
    expect(row.returnRate).toBeCloseTo(1 / 6, 5);
    expect(row.averageLeadTimeDays).toBeGreaterThanOrEqual(0);

    const outsider = await request(ctx.app.getHttpServer())
      .get(`${reportsUrl}/supplier-performance`)
      .set('authorization', auth(bobToken));

    expect(outsider.status).toBe(404);
  });
});
