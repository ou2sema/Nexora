import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { LOGO_PNG } from './logo-image';
import {
  expectArabicPhrase,
  pdfFontNames,
  pdfImageCount,
  pdfParser,
  pdfText,
  withoutSpaces,
} from './pdf';
import { createTestContext, type TestContext } from './test-app';

const YEAR = new Date().getFullYear();

/** Chromium names an embedded subset with a six-letter prefix in front of the family. */
const BUNDLED_FACE = /^[A-Z]{6}\+IBMPlexSansArabic-(Bold|Regular)$/;

describe('sales document PDFs', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let bobToken: string;
  let daveToken: string;
  const deviceIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestContext();
    aliceToken = await ctx.tokenFor(USERS.alice);
    bobToken = await ctx.tokenFor(USERS.bob);
    daveToken = await ctx.tokenFor(USERS.dave);

    const server = ctx.app.getHttpServer();

    const stock = await request(server)
      .post(`/api/v1/organizations/${ORGS.a}/stock-movements`)
      .set('authorization', `Bearer ${aliceToken}`)
      .set('idempotency-key', 'sales-documents-seed-stock-0001')
      .send({
        productId: PRODUCTS.a2,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'receipt',
        quantity: 50,
        reason: 'Opening balance for sales document tests',
      });
    expect(stock.status).toBe(200);

    for (const serial of ['SN-DOCPDF-0001', 'SN-DOCPDF-0002']) {
      const device = await request(server)
        .post(`/api/v1/organizations/${ORGS.a}/devices`)
        .set('authorization', `Bearer ${aliceToken}`)
        .set('idempotency-key', `sales-documents-seed-${serial}`)
        .send({
          productId: PRODUCTS.a1,
          serialNumber: serial,
          imei: null,
          condition: 'new',
          warehouseId: WAREHOUSES.a,
          locationId: LOCATIONS.a,
        });
      expect(device.status).toBe(200);
      deviceIds.push(device.body.deviceId as string);
    }
  });

  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => `Bearer ${token}`;
  const invoicesUrl = `/api/v1/organizations/${ORGS.a}/sales-invoices`;

  async function createCustomer(): Promise<string> {
    const response = await request(ctx.app.getHttpServer())
      .post(`/api/v1/organizations/${ORGS.a}/customers`)
      .set('authorization', auth(aliceToken))
      .send({
        name: 'Tunis Repairs SARL',
        email: 'buy@tunisrepairs.example',
        phone: '+216 71 222 333',
        addressLine: '18 Rue de Marseille',
        city: 'Tunis',
        countryCode: 'TN',
        taxId: '1180000/A/T/000',
      });

    expect(response.status).toBe(201);
    return response.body.id as string;
  }

  async function sell(payload: Record<string, unknown>): Promise<string> {
    const response = await request(ctx.app.getHttpServer())
      .post(invoicesUrl)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', crypto.randomUUID())
      .send({
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        ...payload,
      });

    expect(response.status).toBe(201);
    return response.body.invoiceId as string;
  }

  async function fetchPdf(path: string, token: string) {
    return request(ctx.app.getHttpServer())
      .get(path)
      .set('authorization', auth(token))
      .buffer(true)
      .parse(pdfParser);
  }

  function fetchedText(pdf: Buffer): string {
    return pdfText(pdf).replace(/\s+/g, ' ');
  }

  it('renders the invoice with the fiscal totals, payments, and serials', async () => {
    const customerId = await createCustomer();

    const invoiceId = await sell({
      customerId,
      reference: 'DEVIS-9',
      notes: 'Collect at the counter.',
      paidAmountMinor: 1_000_000,
      paymentMethod: 'bank_transfer',
      paymentNote: 'Transfer ref 55/2026',
      lines: [
        { kind: 'product', productId: PRODUCTS.a2, quantity: 2, taxRatePercent: 19 },
        { kind: 'device', deviceId: deviceIds[0] },
      ],
    });

    const response = await fetchPdf(`${invoicesUrl}/${invoiceId}/pdf`, aliceToken);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="nexora-FI-${YEAR}-0001.pdf"`,
    );

    const pdf = response.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(Number(response.headers['content-length'])).toBe(pdf.length);

    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBe(1);
    expect(parsed.getTitle()).toBe(`Invoice FI-${YEAR}-0001`);

    // Only the faces shipped with the API may reach the page: a host font would make the
    // same invoice look different on every machine that prints it.
    const fonts = pdfFontNames(pdf);
    expect(fonts).toHaveLength(2);
    for (const font of fonts) expect(font).toMatch(BUNDLED_FACE);

    const text = fetchedText(pdf);
    expect(text).toContain('Org A');
    expect(text).toContain(`FI-${YEAR}-0001`);
    expect(text).toContain('Partially paid');
    expect(text).toContain('BILL TO');
    expect(text).toContain('Tunis Repairs SARL');
    expect(text).toContain('18 Rue de Marseille');
    expect(text).toContain('Tunis, TN');
    expect(text).toContain('Tax ID: 1180000/A/T/000');
    expect(text).toContain('DEPOT');
    expect(text).toContain('MAIN / A-01');
    expect(text).toContain('Main warehouse');
    expect(text).toContain('ISSUE DATE');
    expect(text).toContain(`SO-${YEAR}-0001`);
    expect(text).toContain('DEVIS-9');
    expect(text).toContain('SOLD BY');
    expect(text).toContain('alice@example.com');

    expect(text).toContain('CABLE-USB-C');
    expect(text).toContain('USB-C cable 2m');
    expect(text).toContain('19%');
    expect(text).toContain('IPHONE-15');
    expect(text).toContain('SN-DOCPDF-0001');

    // 2 x 8.900 at 19% plus the device at 3 690.000 with no tax.
    expect(text).toContain('Total excl. tax');
    expect(text).toContain('3,707.800 TND');
    expect(text).toContain('Total incl. tax');
    expect(text).toContain('3,711.182 TND');
    expect(text).toContain('Paid');
    expect(text).toContain('1,000.000 TND');
    expect(text).toContain('Remaining');
    expect(text).toContain('2,711.182 TND');

    // The method belongs to the payment, so it is the payments list that names it - once.
    expect(text).not.toContain('Payment method');
    expect(text.match(/Bank transfer/g)).toHaveLength(1);
    expect(text).toContain('PAYMENTS RECEIVED');
    expect(text).toContain('Transfer ref 55/2026');
    expect(text).toContain('Collect at the counter.');
    expect(text).toContain('SERIAL NUMBERS');

    const lower = text.toLowerCase();
    for (const forbidden of ['receipt', 'ticket', 'cash register', 'caisse']) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('prints the same invoice in French and in Arabic', async () => {
    const list = await request(ctx.app.getHttpServer())
      .get(invoicesUrl)
      .set('authorization', auth(aliceToken));
    const invoiceId = (list.body.items as { id: string }[])[0]!.id;

    const french = await fetchPdf(`${invoicesUrl}/${invoiceId}/pdf?locale=fr`, aliceToken);
    expect(french.status).toBe(200);
    const frenchPdf = french.body as Buffer;
    expect((await PDFDocument.load(frenchPdf)).getTitle()).toBe(`Facture FI-${YEAR}-0001`);

    const frenchText = fetchedText(frenchPdf);
    for (const phrase of [
      'Facture',
      'Partiellement payée',
      "DATE D'ÉMISSION",
      'Total HT',
      'Virement bancaire',
    ]) {
      expect(frenchText).toContain(phrase);
    }
    expect(frenchText).not.toContain('Total excl. tax');
    expect(frenchText).not.toContain('Mode de paiement');

    const arabic = await fetchPdf(`${invoicesUrl}/${invoiceId}/pdf?locale=ar`, aliceToken);
    expect(arabic.status).toBe(200);
    const arabicPdf = arabic.body as Buffer;
    expect((await PDFDocument.load(arabicPdf)).getTitle()).toBe(`فاتورة FI-${YEAR}-0001`);

    const arabicText = fetchedText(arabicPdf);
    for (const phrase of [
      'فاتورة',
      'مدفوعة جزئيا',
      'المعرف الجبائي',
      'المجموع مع الضريبة',
      'تحويل بنكي',
    ]) {
      expectArabicPhrase(arabicText, phrase);
    }
    // A slash-separated tax number is reported in visual order, so only its digits are stable.
    expect(arabicText).toContain('1180000');
    expect(withoutSpaces(arabicText)).not.toContain(withoutSpaces('Total excl. tax'));

    const note = await fetchPdf(`${invoicesUrl}/${invoiceId}/issue-note/pdf?locale=ar`, aliceToken);
    expect(note.status).toBe(200);
    expectArabicPhrase(fetchedText(note.body as Buffer), 'سند خروج البضاعة');

    const rejected = await fetchPdf(`${invoicesUrl}/${invoiceId}/pdf?locale=de`, aliceToken);
    expect(rejected.status).toBe(400);
  });

  it('renders the issue note without any amount', async () => {
    const list = await request(ctx.app.getHttpServer())
      .get(invoicesUrl)
      .set('authorization', auth(aliceToken));
    expect(list.status).toBe(200);
    const invoiceId = (list.body.items as { id: string }[])[0]!.id;

    const response = await fetchPdf(`${invoicesUrl}/${invoiceId}/issue-note/pdf`, aliceToken);
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="nexora-SO-${YEAR}-0001-issue-note.pdf"`,
    );

    const pdf = response.body as Buffer;
    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getTitle()).toBe(`Goods issue note SO-${YEAR}-0001`);

    const text = fetchedText(pdf);
    expect(text).toContain('Goods issue note');
    expect(text).toContain('ISSUE DATE');
    expect(text).toContain('INVOICE');
    expect(text).toContain(`FI-${YEAR}-0001`);
    expect(text).toContain('RELEASED BY');
    expect(text).toContain('SERIAL / IMEI');
    expect(text).toContain('SN-DOCPDF-0001');
    expect(text).toContain('Total quantity');
    expect(text).toContain('Every quantity on this note has left the depot');
    expect(text).toContain('not a tax document');

    expect(text).not.toContain('Total incl. tax');
    expect(text).not.toContain('Total excl. tax');
    expect(text).not.toContain('3,711.182');
    expect(text).not.toContain('19%');
  });

  it('numbers the issue note after the invoice when the sale only issued devices', async () => {
    const invoiceId = await sell({
      customerName: 'Walk-in buyer',
      paidAmountMinor: 3_690_000,
      paymentMethod: 'cash',
      lines: [{ kind: 'device', deviceId: deviceIds[1] }],
    });

    const invoice = await request(ctx.app.getHttpServer())
      .get(`${invoicesUrl}/${invoiceId}`)
      .set('authorization', auth(aliceToken));
    expect(invoice.status).toBe(200);
    expect(invoice.body.salesOrderNumber).toBe(null);

    const note = await fetchPdf(`${invoicesUrl}/${invoiceId}/issue-note/pdf`, aliceToken);
    expect(note.status).toBe(200);
    expect(note.headers['content-disposition']).toBe(
      `attachment; filename="nexora-FI-${YEAR}-0002-issue-note.pdf"`,
    );

    const text = fetchedText(note.body as Buffer);
    expect(text).toContain('SN-DOCPDF-0002');
    expect(text).toContain('Walk-in buyer');

    const pdf = await fetchPdf(`${invoicesUrl}/${invoiceId}/pdf`, aliceToken);
    expect(fetchedText(pdf.body as Buffer)).toContain('SERIAL NUMBERS');
  });

  it('serves both documents to every member and to nobody outside the tenant', async () => {
    const list = await request(ctx.app.getHttpServer())
      .get(invoicesUrl)
      .set('authorization', auth(aliceToken));
    const invoiceId = (list.body.items as { id: string }[])[0]!.id;

    for (const path of [
      `${invoicesUrl}/${invoiceId}/pdf`,
      `${invoicesUrl}/${invoiceId}/issue-note/pdf`,
    ]) {
      const viewer = await fetchPdf(path, daveToken);
      expect(viewer.status).toBe(200);
      expect((viewer.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

      const otherTenant = await request(ctx.app.getHttpServer())
        .get(path)
        .set('authorization', auth(bobToken));
      expect(otherTenant.status).toBe(404);
      expect(otherTenant.body.error.code).toBe('organization_not_found');
    }

    const missing = await request(ctx.app.getHttpServer())
      .get(`${invoicesUrl}/30000000-0000-4000-8000-0000000000ff/pdf`)
      .set('authorization', auth(aliceToken));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('sales_invoice_not_found');
  });

  it('draws the tenant mark on the invoice and the issue note', async () => {
    const list = await request(ctx.app.getHttpServer())
      .get(invoicesUrl)
      .set('authorization', auth(aliceToken));
    const invoiceId = (list.body.items as { id: string }[])[0]!.id;

    const paths = [`${invoicesUrl}/${invoiceId}/pdf`, `${invoicesUrl}/${invoiceId}/issue-note/pdf`];

    // An unbranded tenant gets a wordmark and nothing but a wordmark.
    for (const path of paths) {
      const unbranded = await fetchPdf(path, aliceToken);
      expect(unbranded.status).toBe(200);
      expect(pdfImageCount(unbranded.body as Buffer)).toBe(0);
    }

    const logoUrl = `/api/v1/organizations/${ORGS.a}/logo`;
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
        expect(pdfImageCount(response.body as Buffer)).toBeGreaterThan(0);
        expect(fetchedText(response.body as Buffer)).toContain('Org A');
      }
    } finally {
      await request(ctx.app.getHttpServer()).delete(logoUrl).set('authorization', auth(aliceToken));
    }
  });
});
