import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const YEAR = new Date().getFullYear();

describe('operations API', () => {
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
      .set('idempotency-key', 'operations-seed-stock-0001')
      .send({
        productId: PRODUCTS.a2,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'receipt',
        quantity: 100,
        reason: 'Opening balance for operations tests',
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

  async function stockLevel(productId: string) {
    const response = await request(ctx.app.getHttpServer())
      .get(`/api/v1/organizations/${ORGS.a}/stock-levels?productId=${productId}`)
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);
    return response.body.items[0] ?? { onHand: 0, reserved: 0, available: 0 };
  }

  async function createSupplier(name: string, extra: Record<string, unknown> = {}) {
    const response = await request(ctx.app.getHttpServer())
      .post(suppliersUrl)
      .set('authorization', auth(aliceToken))
      .send({ name, ...extra });

    expect(response.status).toBe(201);
    return response.body as { id: string; name: string; isActive: boolean };
  }

  async function createPurchaseOrder(
    supplierId: string,
    lines: { productId: string; quantity: number; unitCostMinor?: number }[],
    key: string,
    payload: Record<string, unknown> = {},
  ) {
    return request(ctx.app.getHttpServer())
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
  }

  async function purchaseLineId(orderId: string, productId: string): Promise<string> {
    const detail = await request(ctx.app.getHttpServer())
      .get(`${purchaseUrl}/${orderId}`)
      .set('authorization', auth(aliceToken));

    expect(detail.status).toBe(200);
    const line = detail.body.lines.find(
      (candidate: { productId: string }) => candidate.productId === productId,
    );
    expect(line).toBeDefined();
    return line.id as string;
  }

  async function createSalesOrder(
    lines: { productId: string; quantity: number; unitPriceMinor?: number }[],
    key: string,
    payload: Record<string, unknown> = {},
  ) {
    return request(ctx.app.getHttpServer())
      .post(salesUrl)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', key)
      .send({
        customerName: 'Northwind Traders',
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        lines,
        ...payload,
      });
  }

  const transition = (url: string, key: string, body: Record<string, unknown> = {}) =>
    request(ctx.app.getHttpServer())
      .post(url)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', key)
      .send(body);

  describe('suppliers', () => {
    it('creates, lists, updates, and deactivates a supplier', async () => {
      const created = await request(ctx.app.getHttpServer())
        .post(suppliersUrl)
        .set('authorization', auth(aliceToken))
        .send({
          name: 'Acme Electronics',
          contactName: 'Sami Ben Ali',
          email: 'orders@acme.example',
          countryCode: 'tn',
          city: 'Tunis',
          notes: 'Preferred distributor',
        });

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        name: 'Acme Electronics',
        countryCode: 'TN',
        isActive: true,
      });

      const duplicate = await request(ctx.app.getHttpServer())
        .post(suppliersUrl)
        .set('authorization', auth(aliceToken))
        .send({ name: 'acme electronics' });

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('conflict');

      const list = await request(ctx.app.getHttpServer())
        .get(`${suppliersUrl}?search=Acme`)
        .set('authorization', auth(aliceToken));

      expect(list.status).toBe(200);
      expect(list.body.total).toBe(1);
      expect(list.body.items[0].id).toBe(created.body.id);

      const updated = await request(ctx.app.getHttpServer())
        .patch(`${suppliersUrl}/${created.body.id}`)
        .set('authorization', auth(aliceToken))
        .send({ city: 'Sousse' });

      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({ city: 'Sousse', name: 'Acme Electronics' });

      const emptyUpdate = await request(ctx.app.getHttpServer())
        .patch(`${suppliersUrl}/${created.body.id}`)
        .set('authorization', auth(aliceToken))
        .send({});

      expect(emptyUpdate.status).toBe(400);
      expect(emptyUpdate.body.error.code).toBe('validation_error');

      const deactivated = await request(ctx.app.getHttpServer())
        .post(`${suppliersUrl}/${created.body.id}/activation`)
        .set('authorization', auth(aliceToken))
        .send({ isActive: false });

      expect(deactivated.status).toBe(200);
      expect(deactivated.body.isActive).toBe(false);

      const inactive = await request(ctx.app.getHttpServer())
        .get(`${suppliersUrl}?isActive=false`)
        .set('authorization', auth(aliceToken));

      expect(inactive.status).toBe(200);
      expect(inactive.body.items.map((item: { name: string }) => item.name)).toContain(
        'Acme Electronics',
      );
    });

    it('rejects supplier writes from viewers and hides the tenant from outsiders', async () => {
      const viewer = await request(ctx.app.getHttpServer())
        .post(suppliersUrl)
        .set('authorization', auth(daveToken))
        .send({ name: 'Viewer Supply' });

      expect(viewer.status).toBe(403);

      const outsider = await request(ctx.app.getHttpServer())
        .get(suppliersUrl)
        .set('authorization', auth(bobToken));

      expect(outsider.status).toBe(404);

      const ownTenant = await request(ctx.app.getHttpServer())
        .get(`/api/v1/organizations/${ORGS.b}/suppliers`)
        .set('authorization', auth(bobToken));

      expect(ownTenant.status).toBe(200);
      expect(ownTenant.body.total).toBe(0);
    });
  });

  describe('purchase orders', () => {
    it('creates, replays idempotently, and rejects conflicting payloads', async () => {
      const supplier = await createSupplier('Idempotent Imports');
      const lines = [{ productId: PRODUCTS.a2, quantity: 4, unitCostMinor: 4200 }];

      const missingKey = await request(ctx.app.getHttpServer())
        .post(purchaseUrl)
        .set('authorization', auth(aliceToken))
        .send({
          supplierId: supplier.id,
          warehouseId: WAREHOUSES.a,
          locationId: LOCATIONS.a,
          lines,
        });

      expect(missingKey.status).toBe(400);
      expect(missingKey.body.error.code).toBe('idempotency_key_required');

      const first = await createPurchaseOrder(supplier.id, lines, 'po-api-idem-0001');

      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        status: 'draft',
        lineCount: 1,
        totalQuantity: 4,
        duplicate: false,
      });
      expect(first.body.number).toMatch(new RegExp(`^PO-${YEAR}-\\d{4}$`));

      const replay = await createPurchaseOrder(supplier.id, lines, 'po-api-idem-0001');

      expect(replay.status).toBe(201);
      expect(replay.body).toMatchObject({ orderId: first.body.orderId, duplicate: true });

      const conflicting = await createPurchaseOrder(
        supplier.id,
        [{ productId: PRODUCTS.a2, quantity: 9, unitCostMinor: 4200 }],
        'po-api-idem-0001',
      );

      expect(conflicting.status).toBe(409);
      expect(conflicting.body.error.code).toBe('idempotency_conflict');

      const list = await request(ctx.app.getHttpServer())
        .get(`${purchaseUrl}?status=draft`)
        .set('authorization', auth(aliceToken));

      expect(list.status).toBe(200);
      expect(list.body.items.map((item: { id: string }) => item.id)).toContain(first.body.orderId);

      const detail = await request(ctx.app.getHttpServer())
        .get(`${purchaseUrl}/${first.body.orderId}`)
        .set('authorization', auth(aliceToken));

      expect(detail.status).toBe(200);
      expect(detail.body.lines[0]).toMatchObject({
        productSku: 'CABLE-USB-C',
        quantityOrdered: 4,
        quantityReceived: 0,
        unitCostMinor: 4200,
      });
    });

    it('orders and receives stock with over-receipt protection', async () => {
      const supplier = await createSupplier('Receipt Materials');
      const order = await createPurchaseOrder(
        supplier.id,
        [{ productId: PRODUCTS.a2, quantity: 5 }],
        'po-api-receive-create',
      );
      expect(order.status).toBe(201);
      const orderId = order.body.orderId as string;
      const lineId = await purchaseLineId(orderId, PRODUCTS.a2);

      const notOrdered = await transition(
        `${purchaseUrl}/${orderId}/receipts`,
        'po-api-receive-early',
        {
          lines: [{ lineId, quantity: 1 }],
        },
      );
      expect(notOrdered.status).toBe(400);
      expect(notOrdered.body.error.code).toBe('constraint_violation');

      const ordered = await transition(`${purchaseUrl}/${orderId}/order`, 'po-api-order-0001');
      expect(ordered.status).toBe(200);
      expect(ordered.body).toMatchObject({ status: 'ordered', duplicate: false });

      const partial = await transition(
        `${purchaseUrl}/${orderId}/receipts`,
        'po-api-receive-0001',
        {
          lines: [{ lineId, quantity: 3 }],
          note: 'First delivery',
        },
      );

      expect(partial.status).toBe(200);
      expect(partial.body).toMatchObject({
        status: 'partially_received',
        receivedLines: 1,
        receivedQuantity: 3,
      });

      const over = await transition(`${purchaseUrl}/${orderId}/receipts`, 'po-api-receive-0002', {
        lines: [{ lineId, quantity: 3 }],
      });

      expect(over.status).toBe(400);
      expect(over.body.error.code).toBe('constraint_violation');
      expect(over.body.error.message).toMatch(/exceeds the ordered quantity/i);

      const complete = await transition(
        `${purchaseUrl}/${orderId}/receipts`,
        'po-api-receive-0003',
        {
          lines: [{ lineId, quantity: 2 }],
        },
      );

      expect(complete.status).toBe(200);
      expect(complete.body.status).toBe('received');

      const detail = await request(ctx.app.getHttpServer())
        .get(`${purchaseUrl}/${orderId}`)
        .set('authorization', auth(aliceToken));

      expect(detail.body).toMatchObject({ status: 'received', receivedAt: expect.any(String) });
      expect(detail.body.lines[0].quantityReceived).toBe(5);

      const cancelled = await transition(
        `${purchaseUrl}/${orderId}/cancel`,
        'po-api-cancel-after',
        {
          reason: 'Too late',
        },
      );

      expect(cancelled.status).toBe(400);
      expect(cancelled.body.error.code).toBe('constraint_violation');
    });

    it('registers serialized devices inline and rejects mismatched serial counts', async () => {
      const supplier = await createSupplier('Serialized Devices Ltd');
      const order = await createPurchaseOrder(
        supplier.id,
        [{ productId: PRODUCTS.a1, quantity: 2, unitCostMinor: 3000000 }],
        'po-api-serial-create',
      );
      const orderId = order.body.orderId as string;
      const lineId = await purchaseLineId(orderId, PRODUCTS.a1);

      await transition(`${purchaseUrl}/${orderId}/order`, 'po-api-serial-order');

      const mismatch = await transition(`${purchaseUrl}/${orderId}/receipts`, 'po-api-serial-bad', {
        lines: [{ lineId, quantity: 2, serials: [{ serialNumber: 'SN-PO-ONLY-ONE' }] }],
      });

      expect(mismatch.status).toBe(400);
      expect(mismatch.body.error.code).toBe('constraint_violation');

      const received = await transition(
        `${purchaseUrl}/${orderId}/receipts`,
        'po-api-serial-good',
        {
          lines: [
            {
              lineId,
              quantity: 2,
              serials: [
                { serialNumber: 'SN-PO-0001', imei: '356789012345671' },
                { serialNumber: 'SN-PO-0002' },
              ],
            },
          ],
        },
      );

      expect(received.status).toBe(200);
      expect(received.body.status).toBe('received');

      const devices = await request(ctx.app.getHttpServer())
        .get(`/api/v1/organizations/${ORGS.a}/devices?search=SN-PO-`)
        .set('authorization', auth(aliceToken));

      expect(devices.status).toBe(200);
      expect(devices.body.total).toBe(2);
      expect(
        devices.body.items.map((device: { serialNumber: string }) => device.serialNumber).sort(),
      ).toEqual(['SN-PO-0001', 'SN-PO-0002']);
      expect(
        devices.body.items.every(
          (device: { status: string; supplierReference: string }) =>
            device.status === 'in_stock' && device.supplierReference === order.body.number,
        ),
      ).toBe(true);
    });

    it('cancels drafts and rejects foreign or duplicate lines', async () => {
      const supplier = await createSupplier('Cancellation Partners');
      const draft = await createPurchaseOrder(
        supplier.id,
        [{ productId: PRODUCTS.a2, quantity: 2 }],
        'po-api-cancel-create',
      );
      const orderId = draft.body.orderId as string;

      const cancelled = await transition(`${purchaseUrl}/${orderId}/cancel`, 'po-api-cancel-0001', {
        reason: 'Supplier out of stock',
      });

      expect(cancelled.status).toBe(200);
      expect(cancelled.body).toMatchObject({ status: 'cancelled', duplicate: false });

      const orderCancelled = await transition(
        `${purchaseUrl}/${orderId}/order`,
        'po-api-order-cancelled',
      );

      expect(orderCancelled.status).toBe(400);
      expect(orderCancelled.body.error.code).toBe('constraint_violation');

      const foreign = await createPurchaseOrder(
        supplier.id,
        [{ productId: PRODUCTS.b1, quantity: 1 }],
        'po-api-foreign-0001',
      );

      expect(foreign.status).toBe(404);
      expect(foreign.body.error.code).toBe('not_found');

      const duplicate = await createPurchaseOrder(
        supplier.id,
        [
          { productId: PRODUCTS.a2, quantity: 1 },
          { productId: PRODUCTS.a2, quantity: 2 },
        ],
        'po-api-duplicate-0001',
      );

      expect(duplicate.status).toBe(400);
      expect(duplicate.body.error.code).toBe('validation_error');
    });

    it('enforces writer roles and tenant isolation', async () => {
      const supplier = await createSupplier('Tenant Supplies');
      const order = await createPurchaseOrder(
        supplier.id,
        [{ productId: PRODUCTS.a2, quantity: 1 }],
        'po-api-tenant-create',
      );

      const viewer = await request(ctx.app.getHttpServer())
        .post(purchaseUrl)
        .set('authorization', auth(daveToken))
        .set('idempotency-key', 'po-api-tenant-viewer')
        .send({
          supplierId: supplier.id,
          warehouseId: WAREHOUSES.a,
          locationId: LOCATIONS.a,
          lines: [{ productId: PRODUCTS.a2, quantity: 1 }],
        });

      expect(viewer.status).toBe(403);

      const outsider = await request(ctx.app.getHttpServer())
        .get(purchaseUrl)
        .set('authorization', auth(bobToken));

      expect(outsider.status).toBe(404);

      const outsiderOrder = await request(ctx.app.getHttpServer())
        .post(`${purchaseUrl}/${order.body.orderId}/order`)
        .set('authorization', auth(bobToken))
        .set('idempotency-key', 'po-api-tenant-outsider');

      expect(outsiderOrder.status).toBe(404);

      const crossTenantSupplier = await request(ctx.app.getHttpServer())
        .post(purchaseUrl)
        .set('authorization', auth(aliceToken))
        .set('idempotency-key', 'po-api-tenant-cross')
        .send({
          supplierId: '90000000-0000-4000-8000-0000000000ff',
          warehouseId: WAREHOUSES.a,
          locationId: LOCATIONS.a,
          lines: [{ productId: PRODUCTS.a2, quantity: 1 }],
        });

      expect(crossTenantSupplier.status).toBe(404);
      expect(crossTenantSupplier.body.error.code).toBe('not_found');
    });
  });

  describe('outgoing orders', () => {
    it('reserves on confirm, issues on fulfil, and refuses to oversell', async () => {
      const before = await stockLevel(PRODUCTS.a2);
      const created = await createSalesOrder(
        [{ productId: PRODUCTS.a2, quantity: 5, unitPriceMinor: 8900 }],
        'so-api-create-0001',
      );

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        status: 'draft',
        lineCount: 1,
        totalQuantity: 5,
        duplicate: false,
      });
      expect(created.body.number).toMatch(new RegExp(`^SO-${YEAR}-\\d{4}$`));

      const orderId = created.body.orderId as string;

      const confirmed = await transition(`${salesUrl}/${orderId}/confirm`, 'so-api-confirm-0001');

      expect(confirmed.status).toBe(200);
      expect(confirmed.body).toMatchObject({
        status: 'confirmed',
        reservedQuantity: 5,
        duplicate: false,
      });

      const reserved = await stockLevel(PRODUCTS.a2);
      expect(reserved.reserved).toBe(before.reserved + 5);
      expect(reserved.available).toBe(before.available - 5);

      const oversell = await createSalesOrder(
        [{ productId: PRODUCTS.a2, quantity: reserved.available + 1 }],
        'so-api-create-oversell',
        { customerName: 'Contoso' },
      );
      expect(oversell.status).toBe(201);

      const oversellConfirm = await transition(
        `${salesUrl}/${oversell.body.orderId}/confirm`,
        'so-api-confirm-oversell',
      );

      expect(oversellConfirm.status).toBe(400);
      expect(oversellConfirm.body.error.code).toBe('constraint_violation');

      const oversellDetail = await request(ctx.app.getHttpServer())
        .get(`${salesUrl}/${oversell.body.orderId}`)
        .set('authorization', auth(aliceToken));

      expect(oversellDetail.body.status).toBe('draft');

      const fulfilled = await transition(`${salesUrl}/${orderId}/fulfil`, 'so-api-fulfil-0001');

      expect(fulfilled.status).toBe(200);
      expect(fulfilled.body).toMatchObject({
        status: 'fulfilled',
        issuedQuantity: 5,
      });

      const after = await stockLevel(PRODUCTS.a2);
      expect(after.onHand).toBe(before.onHand - 5);
      expect(after.reserved).toBe(before.reserved);

      const detail = await request(ctx.app.getHttpServer())
        .get(`${salesUrl}/${orderId}`)
        .set('authorization', auth(aliceToken));

      expect(detail.status).toBe(200);
      expect(detail.body).toMatchObject({ status: 'fulfilled' });
      expect(detail.body.lines[0]).toMatchObject({
        productSku: 'CABLE-USB-C',
        quantity: 5,
        unitPriceMinor: 8900,
      });
      expect(detail.body.lines[0].reservationId).toEqual(expect.any(String));

      const doubleFulfil = await transition(`${salesUrl}/${orderId}/fulfil`, 'so-api-fulfil-0002');

      expect(doubleFulfil.status).toBe(400);
      expect(doubleFulfil.body.error.code).toBe('constraint_violation');
    });

    it('cancels a confirmed order and releases its reservations', async () => {
      const before = await stockLevel(PRODUCTS.a2);
      const created = await createSalesOrder(
        [{ productId: PRODUCTS.a2, quantity: 4 }],
        'so-api-cancel-create',
      );
      const orderId = created.body.orderId as string;

      await transition(`${salesUrl}/${orderId}/confirm`, 'so-api-cancel-confirm');

      const reserved = await stockLevel(PRODUCTS.a2);
      expect(reserved.available).toBe(before.available - 4);

      const cancelled = await transition(`${salesUrl}/${orderId}/cancel`, 'so-api-cancel-0001', {
        reason: 'Customer changed their mind',
      });

      expect(cancelled.status).toBe(200);
      expect(cancelled.body).toMatchObject({ status: 'cancelled', releasedReservations: 1 });

      const released = await stockLevel(PRODUCTS.a2);
      expect(released.available).toBe(before.available);

      const fulfilAfterCancel = await transition(
        `${salesUrl}/${orderId}/fulfil`,
        'so-api-cancel-fulfil',
      );

      expect(fulfilAfterCancel.status).toBe(400);
      expect(fulfilAfterCancel.body.error.code).toBe('constraint_violation');
    });

    it('rejects serialized products and invalid lines at creation', async () => {
      const serialized = await createSalesOrder(
        [{ productId: PRODUCTS.a1, quantity: 1 }],
        'so-api-serial-0001',
      );

      expect(serialized.status).toBe(400);
      expect(serialized.body.error.code).toBe('constraint_violation');
      expect(serialized.body.error.message).toMatch(/serialized/i);

      const duplicate = await createSalesOrder(
        [
          { productId: PRODUCTS.a2, quantity: 1 },
          { productId: PRODUCTS.a2, quantity: 1 },
        ],
        'so-api-duplicate-0001',
      );

      expect(duplicate.status).toBe(400);
      expect(duplicate.body.error.code).toBe('validation_error');

      const zero = await createSalesOrder(
        [{ productId: PRODUCTS.a2, quantity: 0 }],
        'so-api-zero-0001',
      );

      expect(zero.status).toBe(400);
      expect(zero.body.error.code).toBe('validation_error');

      const blankCustomer = await createSalesOrder(
        [{ productId: PRODUCTS.a2, quantity: 1 }],
        'so-api-name-0001',
        { customerName: '   ' },
      );

      expect(blankCustomer.status).toBe(400);
      expect(blankCustomer.body.error.code).toBe('validation_error');
    });

    it('enforces writer roles and tenant isolation', async () => {
      const created = await createSalesOrder(
        [{ productId: PRODUCTS.a2, quantity: 1 }],
        'so-api-tenant-create',
      );
      const orderId = created.body.orderId as string;

      const viewer = await request(ctx.app.getHttpServer())
        .post(salesUrl)
        .set('authorization', auth(daveToken))
        .set('idempotency-key', 'so-api-tenant-viewer')
        .send({
          customerName: 'Viewer Customer',
          warehouseId: WAREHOUSES.a,
          locationId: LOCATIONS.a,
          lines: [{ productId: PRODUCTS.a2, quantity: 1 }],
        });

      expect(viewer.status).toBe(403);

      const outsider = await request(ctx.app.getHttpServer())
        .get(salesUrl)
        .set('authorization', auth(bobToken));

      expect(outsider.status).toBe(404);

      const outsiderConfirm = await request(ctx.app.getHttpServer())
        .post(`${salesUrl}/${orderId}/confirm`)
        .set('authorization', auth(bobToken))
        .set('idempotency-key', 'so-api-tenant-outsider');

      expect(outsiderConfirm.status).toBe(404);
    });
  });
});
