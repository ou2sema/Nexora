import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CATEGORIES, LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { LOGO_PNG } from './logo-image';
import {
  expectArabicPhrase,
  pdfFontNames,
  pdfImageCount,
  pdfPages,
  pdfParser,
  pdfText,
  withoutSpaces,
} from './pdf';
import { createTestContext, type TestContext } from './test-app';

const YEAR = new Date().getFullYear();

/** Chromium names an embedded subset with a six-letter prefix in front of the family. */
const BUNDLED_FACE = /^[A-Z]{6}\+IBMPlexSansArabic-(Bold|Regular)$/;

/** Twenty-four distinct products: enough lines to push the order onto a second page. */
const BULK_PRODUCTS = '70000000-0000-4000-8000-0000000000';

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

  function fetchedText(pdf: Buffer): string {
    return pdfText(pdf).replace(/\s+/g, ' ');
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

    // Only the faces shipped with the API may reach the page: a host font would make the
    // same order look different on every machine that prints it.
    const fonts = pdfFontNames(pdf);
    expect(fonts).toHaveLength(2);
    for (const font of fonts) expect(font).toMatch(BUNDLED_FACE);

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

  it('prints the same order in French and in Arabic', async () => {
    const supplier = await createSupplier();
    const order = await createOrder(supplier.id);

    const french = await fetchPdf(`${purchaseUrl}/${order.orderId}/pdf?locale=fr`, aliceToken);
    expect(french.status).toBe(200);
    const frenchPdf = french.body as Buffer;
    expect((await PDFDocument.load(frenchPdf)).getTitle()).toBe(`Bon de commande ${order.number}`);

    const frenchText = fetchedText(frenchPdf);
    for (const phrase of [
      'Bon de commande',
      'Brouillon',
      'FOURNISSEUR',
      'DATE DE COMMANDE',
      'QUANTITÉ',
      'Identifiant fiscal: TN1234567',
      'Deliver before noon.',
    ]) {
      expect(frenchText).toContain(phrase);
    }
    expect(frenchText).not.toContain('Purchase order');

    const arabic = await fetchPdf(`${purchaseUrl}/${order.orderId}/pdf?locale=ar`, aliceToken);
    expect(arabic.status).toBe(200);
    const arabicPdf = arabic.body as Buffer;
    expect((await PDFDocument.load(arabicPdf)).getTitle()).toBe(`أمر شراء ${order.number}`);

    const arabicText = fetchedText(arabicPdf);
    for (const phrase of ['أمر شراء', 'مسودة', 'المورد', 'المعرف الجبائي']) {
      expectArabicPhrase(arabicText, phrase);
    }
    expect(arabicText).toContain('TN1234567');
    expect(withoutSpaces(arabicText)).not.toContain(withoutSpaces('Purchase order'));

    const rejected = await fetchJson(`${purchaseUrl}/${order.orderId}/pdf?locale=de`, aliceToken);
    expect(rejected.status).toBe(400);
  });

  it('breaks a long order onto a second page with the continuation header', async () => {
    await ctx.database.query(
      `insert into public.products (
         id, organization_id, sku, name, category_id, purchase_price_minor, sale_price_minor, is_serialized
       )
       select ($1 || lpad(i::text, 2, '0'))::uuid, $2, 'REEL-' || lpad(i::text, 2, '0'),
              'Cable reel ' || i, $3, 1000, 2000, false
       from generate_series(1, 24) as i`,
      [BULK_PRODUCTS, ORGS.a, CATEGORIES.aRoot],
    );
    const bulk = await ctx.database.query<{ id: string }>(
      `select id from public.products where id::text like $1 order by id`,
      [`${BULK_PRODUCTS}%`],
    );
    expect(bulk.rows).toHaveLength(24);

    const supplier = await createSupplier();
    const response = await request(ctx.app.getHttpServer())
      .post(purchaseUrl)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID())
      .send({
        supplierId: supplier.id,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        lines: bulk.rows.map((row) => ({ productId: row.id, quantity: 1, unitCostMinor: 1000 })),
      });
    expect(response.status).toBe(201);
    const order = response.body as { orderId: string; number: string };

    const pdf = await fetchPdf(`${purchaseUrl}/${order.orderId}/pdf`, aliceToken);
    expect(pdf.status).toBe(200);
    const pages = pdfPages(pdf.body as Buffer);
    expect(pages).toHaveLength(2);

    // The printed line order is the stored one, not the SKU order, so which reel lands on
    // which page is not fixed. What is fixed is that both pages carry lines, all 24 of them
    // reach the paper, and only the last page carries the totals.
    const reelsOnPage = pages.map((page) => (page.match(/REEL-\d\d/g) ?? []).length);
    expect(reelsOnPage[0]).toBeGreaterThan(0);
    expect(reelsOnPage[1]).toBeGreaterThan(0);
    expect(reelsOnPage[0]! + reelsOnPage[1]!).toBe(24);

    expect(pages[0]).toContain('Page 1 of 2');
    expect(pages[1]).toContain('Page 2 of 2');
    // Only the letterhead carries the status, so the same identity line on page two is the
    // continuation header the margin box draws.
    expect(pages[1]).toContain(`Purchase order ${order.number}`);
    expect(pages[0]).not.toContain('Total value');
    expect(pages[1]).toContain('Total value');
    expect(pages[1]).toContain('24.000 TND');
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

  it('carries the tenant mark on the order and the return note', async () => {
    const logoUrl = `/api/v1/organizations/${ORGS.a}/logo`;

    const supplier = await createSupplier();
    const order = await createOrder(supplier.id);

    const placed = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/order`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID());
    expect(placed.status).toBe(200);

    const detail = await fetchJson(`${purchaseUrl}/${order.orderId}`, aliceToken);
    const cableLine = (detail.body.lines as { id: string; productSku: string }[]).find(
      (line) => line.productSku === 'CABLE-USB-C',
    );
    expect(cableLine).toBeDefined();

    const receipt = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/receipts`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID())
      .send({ lines: [{ lineId: cableLine!.id, quantity: 2 }] });
    expect(receipt.status).toBe(200);

    const returned = await request(ctx.app.getHttpServer())
      .post(`${purchaseUrl}/${order.orderId}/returns`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID())
      .send({
        reason: 'Wrong gauge',
        lines: [{ purchaseOrderLineId: cableLine!.id, quantity: 1 }],
      });
    expect(returned.status).toBe(201);

    const paths = [
      `${purchaseUrl}/${order.orderId}/pdf`,
      `${purchaseUrl}/${order.orderId}/returns/${returned.body.returnId}/pdf`,
    ];

    // A tenant without a mark prints no image at all, so the count below can only be the upload.
    for (const path of paths) {
      const plain = await fetchPdf(path, aliceToken);
      expect(plain.status).toBe(200);
      expect(pdfImageCount(plain.body as Buffer)).toBe(0);
    }

    const upload = await request(ctx.app.getHttpServer())
      .put(logoUrl)
      .set('authorization', auth(aliceToken))
      .set('content-type', 'image/png')
      .send(LOGO_PNG);
    expect(upload.status).toBe(200);

    try {
      for (const path of paths) {
        const response = await fetchPdf(path, aliceToken);
        expect(response.status).toBe(200);
        const pdf = response.body as Buffer;

        expect(pdfImageCount(pdf)).toBeGreaterThan(0);
        expect(fetchedText(pdf)).toContain('Org A');
      }
    } finally {
      await request(ctx.app.getHttpServer()).delete(logoUrl).set('authorization', auth(aliceToken));
    }
  });
});
