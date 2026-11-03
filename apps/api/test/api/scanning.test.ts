import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isValidEan13 } from '@mystock/domain';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { LOGO_PNG } from './logo-image';
import { pdfImages, pdfParser, pdfText } from './pdf';
import { createTestContext, type TestContext } from './test-app';

describe('scanning API', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let daveToken: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    aliceToken = await ctx.tokenFor(USERS.alice);
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
