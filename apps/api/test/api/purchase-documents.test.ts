import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { pdfParser, pdfText } from './pdf';
import { createTestContext, type TestContext } from './test-app';

const YEAR = new Date().getFullYear();

describe('purchase document PDFs', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let daveToken: string;
  let bobToken: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    aliceToken = await ctx.tokenFor(USERS.alice);
    daveToken = await ctx.tokenFor(USERS.dave);
    bobToken = await ctx.tokenFor(USERS.bob);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => `Bearer ${token}`;
  const purchaseUrl = `/api/v1/organizations/${ORGS.a}/purchase-orders`;

  let supplierSequence = 0;

  async function createSupplier() {
    supplierSequence += 1;
    const response = await request(ctx.app.getHttpServer())
      .post(`/api/v1/organizations/${ORGS.a}/suppliers`)
      .set('authorization', auth(aliceToken))
      .send({
        name: `Atlas Components ${supplierSequence}`,
        contactName: 'Samir Trabelsi',
        email: 'orders@atlas.example',
        phone: '+216 71 000 000',
        addressLine: '12 Rue du Lac',
        city: 'Tunis',
        countryCode: 'TN',
        taxId: 'TN1234567',
      });

    expect(response.status).toBe(201);
    return response.body as { id: string };
  }

  async function createOrder(supplierId: string) {
    const response = await request(ctx.app.getHttpServer())
      .post(purchaseUrl)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID())
      .send({
        supplierId,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        expectedOn: '2026-11-15',
        reference: 'SUP-77',
        notes: 'Deliver before noon.',
        lines: [
          { productId: PRODUCTS.a2, quantity: 2, unitCostMinor: 4500 },
          { productId: PRODUCTS.a1, quantity: 1, unitCostMinor: 3_150_000 },
        ],
      });

    expect(response.status).toBe(201);
    return response.body as { orderId: string; number: string };
  }

  async function fetchPdf(path: string, token: string) {
    return request(ctx.app.getHttpServer())
      .get(path)
      .set('authorization', auth(token))
      .buffer(true)
      .parse(pdfParser);
  }

  async function fetchJson(path: string, token: string) {
    return request(ctx.app.getHttpServer()).get(path).set('authorization', auth(token));
  }

  it('renders a purchase order PDF for every member of the tenant', async () => {
    const supplier = await createSupplier();
    const order = await createOrder(supplier.id);

    const response = await fetchPdf(`${purchaseUrl}/${order.orderId}/pdf`, aliceToken);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="nexora-${order.number}.pdf"`,
    );

    const pdf = response.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(Number(response.headers['content-length'])).toBe(pdf.length);
    expect(pdf.length).toBeGreaterThan(1500);

    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(1);
    expect(parsed.getTitle()).toBe(`Purchase order ${order.number}`);

    const shipToInstruction = pdfText(pdf).replace(/\s+/g, ' ');
    expect(shipToInstruction).toContain(
      'Deliver to this location. Quote the purchase order number on all documents.',
    );
    expect(shipToInstruction).not.toContain('on all d...');

    const viewer = await fetchPdf(`${purchaseUrl}/${order.orderId}/pdf`, daveToken);
    expect(viewer.status).toBe(200);
    expect((viewer.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const otherTenant = await fetchJson(`${purchaseUrl}/${order.orderId}/pdf`, bobToken);
    expect(otherTenant.status).toBe(404);
    expect(otherTenant.body.error.code).toBe('organization_not_found');

    const missing = await fetchJson(
      `${purchaseUrl}/30000000-0000-4000-8000-0000000000ff/pdf`,
      aliceToken,
    );
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('purchase_order_not_found');
  });

  it('renders the posted return note with the source order and ledger quantity', async () => {
    const supplier = await createSupplier();
    const order = await createOrder(supplier.id);

    const ordered = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/order`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID());
    expect(ordered.status).toBe(200);

    const detail = await request(ctx.app.getHttpServer())
      .get(`${purchaseUrl}/${order.orderId}`)
      .set('authorization', auth(aliceToken));
    expect(detail.status).toBe(200);
    const cableLine = (detail.body.lines as { id: string; productSku: string }[]).find(
      (line) => line.productSku === 'CABLE-USB-C',
    );
    expect(cableLine).toBeDefined();

    const received = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/receipts`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID())
      .send({ lines: [{ lineId: cableLine!.id, quantity: 2 }] });
    expect(received.status).toBe(200);

    const created = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID())
      .send({
        reason: 'Damaged in transit',
        reference: 'DOC-RET',
        lines: [{ purchaseOrderLineId: cableLine!.id, quantity: 1 }],
      });
    expect(created.status).toBe(201);

    const draftPdf = await fetchPdf(
      `${purchaseUrl}/${order.orderId}/returns/${created.body.returnId}/pdf`,
      aliceToken,
    );
    expect(draftPdf.status).toBe(200);
    expect(draftPdf.headers['content-disposition']).toBe(
      `attachment; filename="nexora-PR-${YEAR}-0001.pdf"`,
    );

    const posted = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/returns/${created.body.returnId}/post`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID());
    expect(posted.status).toBe(200);

    const response = await fetchPdf(
      `${purchaseUrl}/${order.orderId}/returns/${created.body.returnId}/pdf`,
      daveToken,
    );
    expect(response.status).toBe(200);
    const pdf = response.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1500);

    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(1);

    const otherTenant = await fetchJson(
      `${purchaseUrl}/${order.orderId}/returns/${created.body.returnId}/pdf`,
      bobToken,
    );
    expect(otherTenant.status).toBe(404);
    expect(otherTenant.body.error.code).toBe('organization_not_found');

    const missing = await fetchJson(
      `${purchaseUrl}/${order.orderId}/returns/30000000-0000-4000-8000-0000000000ff/pdf`,
      aliceToken,
    );
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('purchase_return_not_found');
  });
});
