import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isValidEan13 } from '@mystock/domain';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { LOGO_PNG } from './logo-image';
import { pdfContentStreams, pdfImages, pdfParser, pdfText } from './pdf';
import { createTestContext, type TestContext } from './test-app';

describe('scanning API', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let bobToken: string;
  let daveToken: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    aliceToken = await ctx.tokenFor(USERS.alice);
    bobToken = await ctx.tokenFor(USERS.bob);
    daveToken = await ctx.tokenFor(USERS.dave);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => `Bearer ${token}`;
  const base = `/api/v1/organizations/${ORGS.a}`;
  const server = () => ctx.app.getHttpServer();

  it('assigns an internal barcode and rejects viewers', async () => {
    const assigned = await request(server())
      .post(`${base}/products/${PRODUCTS.a2}/barcode`)
      .set('authorization', auth(aliceToken));

    expect(assigned.status).toBe(200);
    expect(assigned.body).toMatchObject({ productId: PRODUCTS.a2 });
    expect(assigned.body.barcode).toMatch(/^2[0-9]{12}$/);
    expect(isValidEan13(assigned.body.barcode)).toBe(true);

    const again = await request(server())
      .post(`${base}/products/${PRODUCTS.a2}/barcode`)
      .set('authorization', auth(aliceToken));
    expect(again.body.barcode).toBe(assigned.body.barcode);

    const forbidden = await request(server())
      .post(`${base}/products/${PRODUCTS.a2}/barcode`)
      .set('authorization', auth(daveToken));
    expect(forbidden.status).toBe(403);
  });

  it('scans by internal barcode, SKU, and internal code', async () => {
    const barcode = await request(server())
      .post(`${base}/products/${PRODUCTS.a2}/barcode`)
      .set('authorization', auth(aliceToken));
    const code = barcode.body.barcode as string;

    const receipt = await request(server())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'scan-receipt-0001')
      .send({
        productId: PRODUCTS.a2,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'receipt',
        quantity: 4,
      });
    expect(receipt.status).toBe(200);

    for (const scanned of [code, 'CABLE-USB-C', 'ms-a-0002']) {
      const response = await request(server())
        .get(`${base}/scan`)
        .query({ code: scanned })
        .set('authorization', auth(aliceToken));

      expect(response.status).toBe(200);
      expect(response.body.kind).toBe('product');
      expect(response.body.product).toMatchObject({
        id: PRODUCTS.a2,
        sku: 'CABLE-USB-C',
        barcode: code,
      });
      expect(response.body.totals).toMatchObject({ onHand: 4, reserved: 0, available: 4 });
      expect(response.body.stockLines).toHaveLength(1);
      expect(response.body.stockLines[0]).toMatchObject({
        warehouseCode: 'MAIN',
        locationCode: 'A-01',
        onHand: 4,
      });
    }

    const manufacturer = await request(server())
      .get(`${base}/scan`)
      .query({ code: '4006381333931' })
      .set('authorization', auth(aliceToken));
    expect(manufacturer.body.product).toMatchObject({ id: PRODUCTS.a1, sku: 'IPHONE-15' });

    const missing = await request(server())
      .get(`${base}/scan`)
      .query({ code: 'NO-SUCH-CODE' })
      .set('authorization', auth(aliceToken));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('scan_not_found');
  });

  it('resolves a registered device by serial and IMEI before product matches', async () => {
    const registration = await request(server())
      .post(`${base}/devices`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'scan-device-0001')
      .send({
        productId: PRODUCTS.a1,
        serialNumber: 'SN-SCAN-0001',
        imei: '356789012345678',
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
      });
    expect(registration.status).toBe(200);

    const bySerial = await request(server())
      .get(`${base}/scan`)
      .query({ code: 'sn-scan-0001' })
      .set('authorization', auth(aliceToken));
    expect(bySerial.status).toBe(200);
    expect(bySerial.body.kind).toBe('device');
    expect(bySerial.body.device).toMatchObject({
      id: registration.body.deviceId,
      serialNumber: 'SN-SCAN-0001',
    });

    const byImei = await request(server())
      .get(`${base}/scan`)
      .query({ code: '356789012345678' })
      .set('authorization', auth(aliceToken));
    expect(byImei.body).toMatchObject({
      kind: 'device',
      device: { id: registration.body.deviceId },
    });
  });

  it('renders a product and device label sheet as a PDF', async () => {
    const registration = await request(server())
      .post(`${base}/devices`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'label-device-0001')
      .send({
        productId: PRODUCTS.a1,
        serialNumber: 'SN-LABEL-0001',
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
      });
    expect(registration.status).toBe(200);

    const response = await request(server())
      .post(`${base}/labels`)
      .set('authorization', auth(aliceToken))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .send({
        items: [
          { kind: 'product', productId: PRODUCTS.a2, copies: 2 },
          { kind: 'device', deviceId: registration.body.deviceId },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    const pdf = response.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);

    const missing = await request(server())
      .post(`${base}/labels`)
      .set('authorization', auth(aliceToken))
      .send({ items: [{ kind: 'product', productId: '20000000-0000-4000-8000-0000000000ff' }] });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('product_not_found');
  });

  it('prints the tenant identity line in the free bottom margin of a label sheet', async () => {
    const logoUrl = `/api/v1/organizations/${ORGS.a}/logo`;
    const upload = await request(server())
      .put(logoUrl)
      .set('authorization', auth(aliceToken))
      .set('content-type', 'image/png')
      .send(LOGO_PNG);
    expect(upload.status).toBe(200);

    try {
      const response = await request(server())
        .post(`${base}/labels`)
        .set('authorization', auth(aliceToken))
        .buffer(true)
        .parse(pdfParser)
        .send({ items: [{ kind: 'product', productId: PRODUCTS.a2 }] });
      expect(response.status).toBe(200);

      const pdf = response.body as Buffer;
      const parsed = await PDFDocument.load(pdf);
      expect(parsed.getCreator()).toBe('Nexora');
      expect(parsed.getTitle()).toBe('Org A labels');

      // The grid keeps its pre-cut geometry, so the mark is the last draw on the sheet:
      // one barcode in a cell, then the identity line in the bottom margin.
      const images = pdfImages(pdf);
      expect(images).toHaveLength(2);
      const barcode = images[0]!;
      const mark = images[1]!;
      expect(barcode.y).toBeGreaterThan(30);
      expect(mark.x).toBe(28);
      expect(mark.y).toBeLessThan(30);
      expect(mark.height).toBeLessThanOrEqual(10);

      // Retail-label placement: the digits sit under the bars, centred within their width.
      const code = /2\d{12}/.exec(pdfText(pdf))?.[0];
      expect(code).toBeDefined();
      const hex = Buffer.from(code!, 'utf8').toString('hex');
      const draw = new RegExp(`1 0 0 1 ([\\d.]+) ([\\d.]+) Tm\\s*<${hex}> Tj`).exec(
        pdfContentStreams(pdf).join('\n'),
      );
      expect(draw, 'the barcode digits must be drawn on the sheet').not.toBeNull();
      const textX = Number(draw![1]);
      const textY = Number(draw![2]);
      expect(textY).toBeLessThan(barcode.y);
      expect(textX).toBeGreaterThanOrEqual(barcode.x);
      expect(textX).toBeLessThan(barcode.x + barcode.width);

      const text = pdfText(pdf).replace(/\s+/g, ' ');
      expect(text).toContain('Org A');
    } finally {
      await request(server()).delete(logoUrl).set('authorization', auth(aliceToken));
    }
  });

  it('records and posts a scan-assisted count with idempotent replay', async () => {
    await request(server())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'count-receipt-0001')
      .send({
        productId: PRODUCTS.a2,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'receipt',
        quantity: 10,
      });

    const before = await request(server())
      .get(`${base}/stock-levels`)
      .set('authorization', auth(aliceToken))
      .query({ productId: PRODUCTS.a2 });
    const previousOnHand = before.body.items[0].onHand as number;

    const started = await request(server())
      .post(`${base}/stock-counts`)
      .set('authorization', auth(aliceToken))
      .send({ warehouseId: WAREHOUSES.a, locationId: LOCATIONS.a, note: 'Aisle A cycle count' });

    expect(started.status).toBe(201);
    expect(started.body).toMatchObject({ status: 'open', locationId: LOCATIONS.a });
    const countId = started.body.countId as string;

    const duplicate = await request(server())
      .post(`${base}/stock-counts`)
      .set('authorization', auth(aliceToken))
      .send({ warehouseId: WAREHOUSES.a, locationId: LOCATIONS.a });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.message).toMatch(/open count already exists/i);

    const recorded = await request(server())
      .post(`${base}/stock-counts/${countId}/lines`)
      .set('authorization', auth(aliceToken))
      .send({ productId: PRODUCTS.a2, quantity: 8 });
    expect(recorded.status).toBe(200);
    expect(recorded.body).toMatchObject({ productId: PRODUCTS.a2, countedQuantity: 8 });

    const detail = await request(server())
      .get(`${base}/stock-counts/${countId}`)
      .set('authorization', auth(aliceToken));
    expect(detail.status).toBe(200);
    expect(detail.body.lines).toHaveLength(1);
    expect(detail.body.lines[0]).toMatchObject({
      productSku: 'CABLE-USB-C',
      countedQuantity: 8,
      onHand: previousOnHand,
      variance: 8 - previousOnHand,
    });

    const missingKey = await request(server())
      .post(`${base}/stock-counts/${countId}/post`)
      .set('authorization', auth(aliceToken));
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe('idempotency_key_required');

    const posted = await request(server())
      .post(`${base}/stock-counts/${countId}/post`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'count-post-0001');
    expect(posted.status).toBe(200);
    expect(posted.body).toMatchObject({
      countId,
      status: 'posted',
      lineCount: 1,
      adjustedLines: 1,
      duplicate: false,
    });
    expect(posted.body.adjustments[0]).toMatchObject({
      previousOnHand,
      countedQuantity: 8,
      delta: 8 - previousOnHand,
    });

    const replay = await request(server())
      .post(`${base}/stock-counts/${countId}/post`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'count-post-0001');
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ countId, duplicate: true, adjustedLines: 1 });

    const secondPost = await request(server())
      .post(`${base}/stock-counts/${countId}/post`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'count-post-0002');
    expect(secondPost.status).toBe(400);
    expect(secondPost.body.error.message).toMatch(/no longer open/i);

    const levels = await request(server())
      .get(`${base}/stock-levels`)
      .set('authorization', auth(aliceToken))
      .query({ productId: PRODUCTS.a2 });
    expect(levels.body.items[0]).toMatchObject({ onHand: 8, available: 8 });

    const afterPost = await request(server())
      .post(`${base}/stock-counts/${countId}/lines`)
      .set('authorization', auth(aliceToken))
      .send({ productId: PRODUCTS.a2, quantity: 9 });
    expect(afterPost.status).toBe(400);
    expect(afterPost.body.error.message).toMatch(/no longer open/i);
  });

  it('registers one unit per received tracked item and scans it before the shared code', async () => {
    const product = await request(server())
      .post(`${base}/products`)
      .set('authorization', auth(aliceToken))
      .send({
        sku: 'WIDGET-NX-API',
        name: 'Widget tracked unit',
        isIndividuallyTracked: true,
      });
    expect(product.status).toBe(201);
    expect(product.body).toMatchObject({ isIndividuallyTracked: true, isSerialized: false });
    const productId = product.body.id as string;

    const supplier = await request(server())
      .post(`${base}/suppliers`)
      .set('authorization', auth(aliceToken))
      .send({ name: 'Tracked Units Supply' });
    expect(supplier.status).toBe(201);

    const created = await request(server())
      .post(`${base}/purchase-orders`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'tracked-api-create')
      .send({
        supplierId: supplier.body.id,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        lines: [{ productId, quantity: 5 }],
      });
    expect(created.status).toBe(201);
    const orderId = created.body.orderId as string;

    const detail = await request(server())
      .get(`${base}/purchase-orders/${orderId}`)
      .set('authorization', auth(aliceToken));
    expect(detail.body.lines[0]).toMatchObject({ isIndividuallyTracked: true });
    const lineId = detail.body.lines[0].id as string;

    await request(server())
      .post(`${base}/purchase-orders/${orderId}/order`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'tracked-api-order');

    const receipt = await request(server())
      .post(`${base}/purchase-orders/${orderId}/receipts`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'tracked-api-receive')
      .send({ lines: [{ lineId, quantity: 5 }] });

    expect(receipt.status).toBe(200);
    expect(receipt.body).toMatchObject({
      status: 'received',
      receivedQuantity: 5,
      duplicate: false,
    });
    expect(receipt.body.trackedItems).toHaveLength(5);
    const codes = receipt.body.trackedItems.map((unit: { unitCode: string }) => unit.unitCode);
    expect(new Set(codes).size).toBe(5);
    for (const code of codes) expect(code).toMatch(/^NX[A-F0-9]{20}$/);

    const unit = receipt.body.trackedItems[0] as { id: string; unitCode: string };

    const byUnit = await request(server())
      .get(`${base}/scan`)
      .query({ code: unit.unitCode })
      .set('authorization', auth(aliceToken));
    expect(byUnit.status).toBe(200);
    expect(byUnit.body.kind).toBe('tracked_item');
    expect(byUnit.body.item).toMatchObject({
      id: unit.id,
      productId,
      unitCode: unit.unitCode,
      status: 'in_stock',
      warehouseCode: 'MAIN',
      locationCode: 'A-01',
    });
    expect(byUnit.body.product).toMatchObject({ id: productId, sku: 'WIDGET-NX-API' });
    expect(byUnit.body.events).toHaveLength(1);
    expect(byUnit.body.events[0]).toMatchObject({ eventType: 'received', statusTo: 'in_stock' });

    // The shared product barcode still resolves aggregate stock for the model.
    const shared = await request(server())
      .post(`${base}/products/${productId}/barcode`)
      .set('authorization', auth(aliceToken));
    const byProduct = await request(server())
      .get(`${base}/scan`)
      .query({ code: shared.body.barcode })
      .set('authorization', auth(aliceToken));
    expect(byProduct.body.kind).toBe('product');
    expect(byProduct.body.totals).toMatchObject({ onHand: 5, available: 5 });
    expect(byProduct.body.product.isIndividuallyTracked).toBe(true);

    const replay = await request(server())
      .post(`${base}/purchase-orders/${orderId}/receipts`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'tracked-api-receive')
      .send({ lines: [{ lineId, quantity: 5 }] });
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);
    expect(
      replay.body.trackedItems.map((item: { unitCode: string }) => item.unitCode).sort(),
    ).toEqual([...codes].sort());

    const after = await request(server())
      .get(`${base}/scan`)
      .query({ code: shared.body.barcode })
      .set('authorization', auth(aliceToken));
    expect(after.body.totals).toMatchObject({ onHand: 5 });

    const outsider = await request(server())
      .get(`${base}/scan`)
      .query({ code: unit.unitCode })
      .set('authorization', auth(bobToken));
    expect(outsider.status).toBe(404);

    const label = await request(server())
      .post(`${base}/labels`)
      .set('authorization', auth(aliceToken))
      .buffer(true)
      .parse(pdfParser)
      .send({ items: [{ kind: 'item', itemId: unit.id }] });
    expect(label.status).toBe(200);
    expect(label.headers['content-type']).toContain('application/pdf');
    const pdf = label.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
    const text = pdfText(pdf).replace(/\s+/g, ' ');
    expect(text).toContain('Widget tracked unit');
    expect(text).toContain('WIDGET-NX-API');

    const foreignLabel = await request(server())
      .post(`/api/v1/organizations/${ORGS.b}/labels`)
      .set('authorization', auth(bobToken))
      .send({ items: [{ kind: 'item', itemId: unit.id }] });
    expect(foreignLabel.status).toBe(404);
    expect(foreignLabel.body.error.code).toBe('tracked_item_not_found');
  });

  it('rejects a product that claims both tracking modes', async () => {
    const response = await request(server())
      .post(`${base}/products`)
      .set('authorization', auth(aliceToken))
      .send({
        sku: 'DUAL-TRACKING-1',
        name: 'Dual tracking product',
        isSerialized: true,
        isIndividuallyTracked: true,
      });

    expect(response.status).toBe(400);
  });

  it('discards an open count and blocks viewer writes', async () => {
    const started = await request(server())
      .post(`${base}/stock-counts`)
      .set('authorization', auth(aliceToken))
      .send({ warehouseId: WAREHOUSES.a, locationId: LOCATIONS.a });

    const forbidden = await request(server())
      .post(`${base}/stock-counts/${started.body.countId}/lines`)
      .set('authorization', auth(daveToken))
      .send({ productId: PRODUCTS.a2, quantity: 1 });
    expect(forbidden.status).toBe(403);

    const discarded = await request(server())
      .post(`${base}/stock-counts/${started.body.countId}/discard`)
      .set('authorization', auth(aliceToken));
    expect(discarded.status).toBe(200);
    expect(discarded.body).toEqual({ countId: started.body.countId, status: 'cancelled' });

    const list = await request(server())
      .get(`${base}/stock-counts`)
      .query({ status: 'cancelled' })
      .set('authorization', auth(aliceToken));
    expect(list.body.items.some((item: { id: string }) => item.id === started.body.countId)).toBe(
      true,
    );
  });
});
