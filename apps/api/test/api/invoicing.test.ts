import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const YEAR = new Date().getFullYear();

describe('invoicing API', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let bobToken: string;
  let daveToken: string;
  let deviceId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    aliceToken = await ctx.tokenFor(USERS.alice);
    bobToken = await ctx.tokenFor(USERS.bob);
    daveToken = await ctx.tokenFor(USERS.dave);

    const server = ctx.app.getHttpServer();

    const stock = await request(server)
      .post(`/api/v1/organizations/${ORGS.a}/stock-movements`)
      .set('authorization', `Bearer ${aliceToken}`)
      .set('idempotency-key', 'invoicing-seed-stock-0001')
      .send({
        productId: PRODUCTS.a2,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'receipt',
        quantity: 50,
        reason: 'Opening balance for invoicing tests',
      });
    expect(stock.status).toBe(200);

    const device = await request(server)
      .post(`/api/v1/organizations/${ORGS.a}/devices`)
      .set('authorization', `Bearer ${aliceToken}`)
      .set('idempotency-key', 'invoicing-seed-device-0001')
      .send({
        productId: PRODUCTS.a1,
        serialNumber: 'SN-INVOICE-0001',
        imei: null,
        condition: 'new',
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
      });
    expect(device.status).toBe(200);
    deviceId = device.body.deviceId;
  });

  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => `Bearer ${token}`;
  const customersUrl = `/api/v1/organizations/${ORGS.a}/customers`;
  const invoicesUrl = `/api/v1/organizations/${ORGS.a}/sales-invoices`;

  async function createCustomer(name: string, extra: Record<string, unknown> = {}) {
    const response = await request(ctx.app.getHttpServer())
      .post(customersUrl)
      .set('authorization', auth(aliceToken))
      .send({ name, ...extra });

    expect(response.status).toBe(201);
    return response.body as { id: string; name: string; isActive: boolean };
  }

  async function stockLevel(productId: string) {
    const response = await request(ctx.app.getHttpServer())
      .get(`/api/v1/organizations/${ORGS.a}/stock-levels?productId=${productId}`)
      .set('authorization', auth(aliceToken));

    expect(response.status).toBe(200);
    return response.body.items[0] ?? { onHand: 0, reserved: 0, available: 0 };
  }

  function sale(
    key: string,
    payload: Record<string, unknown> = {},
    token = auth(aliceToken),
    url = invoicesUrl,
  ) {
    return request(ctx.app.getHttpServer())
      .post(url)
      .set('authorization', token)
      .set('idempotency-key', key)
      .send({
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        customerName: 'Walk-in buyer',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 3 }],
        ...payload,
      });
  }

  describe('customers', () => {
    it('creates, searches, updates, and reactivates a customer', async () => {
      const created = await createCustomer('Tunis Cables SARL', {
        email: 'sales@tumiss.example',
        phone: '+216 71 000 000',
        city: 'Tunis',
        countryCode: 'tn',
        taxId: '1180000/A/T/000',
      });

      expect(created).toMatchObject({
        name: 'Tunis Cables SARL',
        countryCode: 'TN',
        isActive: true,
      });

      const second = await createCustomer('Tunis Cables SARL');
      expect(second.id).not.toBe(created.id);

      const list = await request(ctx.app.getHttpServer())
        .get(`${customersUrl}?search=Tunis%20Cables`)
        .set('authorization', auth(aliceToken));

      expect(list.status).toBe(200);
      expect(list.body.total).toBe(2);

      const updated = await request(ctx.app.getHttpServer())
        .patch(`${customersUrl}/${created.id}`)
        .set('authorization', auth(aliceToken))
        .send({ city: 'Sousse' });

      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({ city: 'Sousse', name: 'Tunis Cables SARL' });

      const deactivated = await request(ctx.app.getHttpServer())
        .post(`${customersUrl}/${created.id}/activation`)
        .set('authorization', auth(aliceToken))
        .send({ isActive: false });

      expect(deactivated.status).toBe(200);
      expect(deactivated.body.isActive).toBe(false);

      const inactiveOnly = await request(ctx.app.getHttpServer())
        .get(`${customersUrl}?isActive=false`)
        .set('authorization', auth(aliceToken));

      expect(inactiveOnly.body.items.map((item: { id: string }) => item.id)).toEqual([created.id]);
    });

    it('validates the payload and the caller role', async () => {
      const blank = await request(ctx.app.getHttpServer())
        .post(customersUrl)
        .set('authorization', auth(aliceToken))
        .send({ name: '   ' });

      expect(blank.status).toBe(400);
      expect(blank.body.error.code).toBe('validation_error');

      const emptyPatch = await request(ctx.app.getHttpServer())
        .patch(`${customersUrl}/00000000-0000-4000-8000-000000000001`)
        .set('authorization', auth(aliceToken))
        .send({});

      expect(emptyPatch.status).toBe(400);
      expect(emptyPatch.body.error.code).toBe('validation_error');

      const viewer = await request(ctx.app.getHttpServer())
        .post(customersUrl)
        .set('authorization', auth(daveToken))
        .send({ name: 'Viewer Attempt' });

      expect(viewer.status).toBe(403);
      expect(viewer.body.error.code).toBe('forbidden');
    });

    it('refuses a sale to a deactivated customer', async () => {
      const archived = await createCustomer('Closed Account Ltd');

      await request(ctx.app.getHttpServer())
        .post(`${customersUrl}/${archived.id}/activation`)
        .set('authorization', auth(aliceToken))
        .send({ isActive: false });

      const response = await sale('invoice-api-inactive-customer', {
        customerId: archived.id,
        customerName: undefined,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('constraint_violation');
      expect(response.body.error.message).toBe('This customer is inactive.');
    });
  });

  describe('sales invoices', () => {
    it('posts a counter sale that issues stock and numbers the invoice', async () => {
      const before = await stockLevel(PRODUCTS.a2);
      const customer = await createCustomer('Nordic Devices AB');

      const created = await sale('invoice-api-sale-0001', {
        customerId: customer.id,
        customerName: undefined,
        paidAmountMinor: 10000,
        paymentMethod: 'card_manual',
        reference: 'Counter 14/03',
      });

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        number: `FI-${YEAR}-0001`,
        lineCount: 1,
        totalQuantity: 3,
        netAmountMinor: 26700,
        taxAmountMinor: 0,
        totalAmountMinor: 26700,
        paidAmountMinor: 10000,
        remainingAmountMinor: 16700,
        paymentStatus: 'partial',
        paymentMethod: 'card_manual',
        duplicate: false,
      });
      expect(created.body.orderId).toBeTypeOf('string');

      const after = await stockLevel(PRODUCTS.a2);
      expect(after.onHand).toBe(before.onHand - 3);
      expect(after.reserved).toBe(0);

      const detail = await request(ctx.app.getHttpServer())
        .get(`${invoicesUrl}/${created.body.invoiceId}`)
        .set('authorization', auth(aliceToken));

      expect(detail.status).toBe(200);
      expect(detail.body).toMatchObject({
        id: created.body.invoiceId,
        number: `FI-${YEAR}-0001`,
        salesOrderNumber: expect.stringMatching(/^SO-\d{4}-\d{4}$/),
        customerName: 'Nordic Devices AB',
        warehouseCode: 'MAIN',
        locationCode: 'A-01',
        createdByEmail: 'alice@example.com',
      });
      expect(detail.body.lines).toEqual([
        expect.objectContaining({
          kind: 'product',
          productSku: 'CABLE-USB-C',
          quantity: 3,
          unitPriceMinor: 8900,
          netAmountMinor: 26700,
        }),
      ]);
      expect(detail.body.payments).toEqual([
        expect.objectContaining({ amountMinor: 10000, method: 'card_manual' }),
      ]);

      const movements = await request(ctx.app.getHttpServer())
        .get(
          `/api/v1/organizations/${ORGS.a}/stock-movements?productId=${PRODUCTS.a2}&movementType=issue`,
        )
        .set('authorization', auth(aliceToken));

      expect(movements.status).toBe(200);
      expect(movements.body.items).toHaveLength(1);
      expect(movements.body.items[0]).toMatchObject({
        movementType: 'issue',
        quantityDelta: -3,
        referenceType: 'outgoing_order',
      });
    });

    it('requires an idempotency key and replays the same sale once', async () => {
      const withoutKey = await request(ctx.app.getHttpServer())
        .post(invoicesUrl)
        .set('authorization', auth(aliceToken))
        .send({
          warehouseId: WAREHOUSES.a,
          locationId: LOCATIONS.a,
          customerName: 'No Key Buyer',
          lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 1 }],
        });

      expect(withoutKey.status).toBe(400);
      expect(withoutKey.body.error.code).toBe('idempotency_key_required');

      const before = await stockLevel(PRODUCTS.a2);
      const first = await sale('invoice-api-replay-0001');
      const retry = await sale('invoice-api-replay-0001');

      expect(first.status).toBe(201);
      expect(retry.status).toBe(201);
      expect(retry.body).toMatchObject({ invoiceId: first.body.invoiceId, duplicate: true });

      const after = await stockLevel(PRODUCTS.a2);
      expect(after.onHand).toBe(before.onHand - 3);

      const list = await request(ctx.app.getHttpServer())
        .get(`${invoicesUrl}?search=${encodeURIComponent('Walk-in buyer')}`)
        .set('authorization', auth(aliceToken));

      const replayed = list.body.items.filter(
        (item: { number: string }) => item.number === first.body.number,
      );
      expect(replayed).toHaveLength(1);
    });

    it('recomputes the money from the catalog and ignores client totals', async () => {
      const created = await sale('invoice-api-priced-0001', {
        customerName: 'Price Checker',
        netAmountMinor: 1,
        totalAmountMinor: 1,
        lines: [
          {
            kind: 'product',
            productId: PRODUCTS.a2,
            quantity: 2,
            taxRatePercent: 19,
          },
        ],
      });

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        netAmountMinor: 17800,
        taxAmountMinor: 3382,
        totalAmountMinor: 21182,
        paymentStatus: 'unpaid',
      });

      const negotiated = await sale('invoice-api-negotiated-0001', {
        customerName: 'Negotiated Buyer',
        lines: [
          {
            kind: 'product',
            productId: PRODUCTS.a2,
            quantity: 1,
            unitPriceMinor: 7500,
          },
        ],
      });

      expect(negotiated.body).toMatchObject({ netAmountMinor: 7500, totalAmountMinor: 7500 });
    });

    it('sells a serialized device beside the bulk stock', async () => {
      const before = await stockLevel(PRODUCTS.a2);

      const created = await sale('invoice-api-device-0001', {
        customerName: 'Device Buyer',
        lines: [
          { kind: 'device', deviceId },
          { kind: 'product', productId: PRODUCTS.a2, quantity: 1 },
        ],
      });

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        lineCount: 2,
        totalQuantity: 2,
        netAmountMinor: 3698900,
      });

      const device = await request(ctx.app.getHttpServer())
        .get(`/api/v1/organizations/${ORGS.a}/devices/${deviceId}`)
        .set('authorization', auth(aliceToken));

      expect(device.body.status).toBe('sold');

      const events = await request(ctx.app.getHttpServer())
        .get(`/api/v1/organizations/${ORGS.a}/devices/${deviceId}/events`)
        .set('authorization', auth(aliceToken));

      expect(events.body).toHaveLength(2);
      expect(
        events.body.find((event: { eventType: string }) => event.eventType === 'issued'),
      ).toMatchObject({
        statusFrom: 'in_stock',
        statusTo: 'sold',
        note: expect.stringMatching(new RegExp(`^Sold on FI-${YEAR}-\\d{4}$`)),
      });

      const after = await stockLevel(PRODUCTS.a2);
      expect(after.onHand).toBe(before.onHand - 1);

      const detail = await request(ctx.app.getHttpServer())
        .get(`${invoicesUrl}/${created.body.invoiceId}`)
        .set('authorization', auth(aliceToken));

      const deviceLine = detail.body.lines.find((line: { kind: string }) => line.kind === 'device');
      expect(deviceLine).toMatchObject({ deviceId, serialNumber: 'SN-INVOICE-0001' });
    });

    it('rejects a sale the stock cannot cover and a basket without lines', async () => {
      const oversell = await sale('invoice-api-oversell-0001', {
        customerName: 'Greedy Buyer',
        lines: [{ kind: 'product', productId: PRODUCTS.a2, quantity: 10_000 }],
      });

      expect(oversell.status).toBe(400);
      expect(oversell.body.error.code).toBe('constraint_violation');
      expect(oversell.body.error.message).toBe('Not enough stock available for this movement.');

      const empty = await sale('invoice-api-empty-0001', { lines: [] });
      expect(empty.status).toBe(400);
      expect(empty.body.error.code).toBe('validation_error');

      const duplicated = await sale('invoice-api-duplicate-line-0001', {
        lines: [
          { kind: 'product', productId: PRODUCTS.a2, quantity: 1 },
          { kind: 'product', productId: PRODUCTS.a2, quantity: 2 },
        ],
      });

      expect(duplicated.status).toBe(400);
      expect(duplicated.body.error.code).toBe('validation_error');
    });

    it('records payments and refuses to over-collect', async () => {
      const created = await sale('invoice-api-credit-0001', {
        customerName: 'On Account Ltd',
        paidAmountMinor: 0,
      });

      expect(created.body).toMatchObject({ paymentStatus: 'unpaid', remainingAmountMinor: 26700 });

      const partial = await request(ctx.app.getHttpServer())
        .post(`${invoicesUrl}/${created.body.invoiceId}/payments`)
        .set('authorization', auth(aliceToken))
        .set('idempotency-key', 'invoice-api-payment-0001')
        .send({ amountMinor: 6700, method: 'bank_transfer', note: 'Wire 88/2026' });

      expect(partial.status).toBe(200);
      expect(partial.body).toMatchObject({
        paidAmountMinor: 6700,
        remainingAmountMinor: 20000,
        paymentStatus: 'partial',
        paymentMethod: 'bank_transfer',
      });

      const replay = await request(ctx.app.getHttpServer())
        .post(`${invoicesUrl}/${created.body.invoiceId}/payments`)
        .set('authorization', auth(aliceToken))
        .set('idempotency-key', 'invoice-api-payment-0001')
        .send({ amountMinor: 6700, method: 'bank_transfer', note: 'Wire 88/2026' });

      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ paidAmountMinor: 6700, duplicate: true });

      const overPayment = await request(ctx.app.getHttpServer())
        .post(`${invoicesUrl}/${created.body.invoiceId}/payments`)
        .set('authorization', auth(aliceToken))
        .set('idempotency-key', 'invoice-api-payment-0002')
        .send({ amountMinor: 30000, method: 'cash' });

      expect(overPayment.status).toBe(400);
      expect(overPayment.body.error.code).toBe('constraint_violation');
      expect(overPayment.body.error.message).toBe(
        'The payment is larger than the amount still due.',
      );

      const closing = await request(ctx.app.getHttpServer())
        .post(`${invoicesUrl}/${created.body.invoiceId}/payments`)
        .set('authorization', auth(aliceToken))
        .set('idempotency-key', 'invoice-api-payment-0003')
        .send({ amountMinor: 20000, method: 'cash' });

      expect(closing.body).toMatchObject({ paymentStatus: 'paid', remainingAmountMinor: 0 });

      const unpaid = await request(ctx.app.getHttpServer())
        .get(`${invoicesUrl}?paymentStatus=unpaid`)
        .set('authorization', auth(aliceToken));

      expect(unpaid.status).toBe(200);
      expect(unpaid.body.items.map((item: { id: string }) => item.id)).not.toContain(
        created.body.invoiceId,
      );

      const viewerPayment = await request(ctx.app.getHttpServer())
        .post(`${invoicesUrl}/${created.body.invoiceId}/payments`)
        .set('authorization', auth(daveToken))
        .set('idempotency-key', 'invoice-api-payment-viewer')
        .send({ amountMinor: 1000, method: 'cash' });

      expect(viewerPayment.status).toBe(403);
    });

    it('keeps customers and invoices inside their organization', async () => {
      const listed = await request(ctx.app.getHttpServer())
        .get(`/api/v1/organizations/${ORGS.b}/customers`)
        .set('authorization', auth(bobToken));

      expect(listed.status).toBe(200);
      expect(listed.body.total).toBe(0);

      const foreignSale = await sale(
        'invoice-api-foreign-sale-0001',
        { customerName: 'Org B Buyer' },
        auth(bobToken),
        `/api/v1/organizations/${ORGS.b}/sales-invoices`,
      );

      expect(foreignSale.status).toBe(404);
      expect(foreignSale.body.error.code).toBe('not_found');
      expect(foreignSale.body.error.message).toBe('Warehouse not found.');

      const invoicesOfA = await request(ctx.app.getHttpServer())
        .get(invoicesUrl)
        .set('authorization', auth(aliceToken));

      expect(invoicesOfA.body.items.length).toBeGreaterThan(0);
      const firstInvoiceId = invoicesOfA.body.items[0].id as string;

      const crossRead = await request(ctx.app.getHttpServer())
        .get(`/api/v1/organizations/${ORGS.b}/sales-invoices/${firstInvoiceId}`)
        .set('authorization', auth(bobToken));

      expect(crossRead.status).toBe(404);
      expect(crossRead.body.error.message).toBe('Sales invoice not found.');

      const outsider = await request(ctx.app.getHttpServer())
        .get(`${invoicesUrl}/${firstInvoiceId}`)
        .set('authorization', auth(await ctx.tokenFor(USERS.carol)));

      expect(outsider.status).toBe(404);
      expect(outsider.body.error.code).toBe('organization_not_found');
    });
  });
});
