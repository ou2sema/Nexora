/**
 * Structure tests for the HTML the Chromium printer turns into an A4 document.
 *
 * Extracted text proves what reached the paper but not how it was paired: an amount sitting
 * outside the line it belongs to extracts just as cleanly. These tests read the markup, so
 * the layout decisions that carry the money are pinned where the renderer makes them.
 */

import { describe, expect, it } from 'vitest';

import type { DocumentLocale } from '@mystock/contracts';

import { documentStrings } from '../../src/documents/document-catalog';
import {
  type PurchaseDocument,
  buildPurchaseOrderDocument,
} from '../../src/documents/purchase-document-model';
import {
  type SalesDocument,
  buildIssueNoteDocument,
  buildSalesInvoiceDocument,
} from '../../src/documents/sales-document-model';
import {
  purchaseTemplate,
  renderDocumentHtml,
  salesTemplate,
} from '../../src/documents/print/document-template';

const AT = new Date('2026-11-05T10:00:00.000Z');

/** The printable column, exactly as the template's own `@page` box defines it. */
const CONTENT_WIDTH_PT = 595.28 - 48 * 2;

const CUSTOMER = {
  name: 'Amel Ben Salem',
  email: 'amel@example.tn',
  phone: '+216 22 111 222',
  addressLine: '5 Avenue Habib Bourguiba',
  city: 'Sfax',
  countryCode: 'TN',
  taxId: 'TN9876543',
};

const SUPPLIER = {
  name: 'Atlas Components',
  contactName: 'Samir Trabelsi',
  email: 'orders@atlas.example',
  phone: '+216 71 000 000',
  addressLine: '12 Rue du Lac',
  city: 'Tunis',
  countryCode: 'TN',
  taxId: 'TN1234567',
};

function purchaseOrder(locale: DocumentLocale, status = 'draft'): PurchaseDocument {
  return buildPurchaseOrderDocument({
    organizationName: 'Org A',
    strings: documentStrings(locale),
    order: {
      number: 'PO-2026-0001',
      status,
      reference: 'SUP-77',
      notes: 'Deliver before noon.',
      expectedOn: '2026-11-15',
      orderedAt: '2026-11-01T08:00:00.000Z',
      createdAt: '2026-10-31T09:30:00.000Z',
      warehouseCode: 'MAIN',
      warehouseName: 'Main warehouse',
      locationCode: 'A-01',
      locationName: 'Aisle A shelf 01',
      supplier: SUPPLIER,
    },
    lines: [
      {
        productSku: 'CABLE-USB-C',
        productName: 'USB-C cable 2m',
        quantityOrdered: 2,
        unitCostMinor: 4500,
      },
    ],
  });
}

function invoiceInput(locale: DocumentLocale) {
  return {
    organizationName: 'Org A',
    strings: documentStrings(locale),
    invoice: {
      number: 'FI-2026-0007',
      paymentStatus: 'partial',
      paymentMethod: 'bank_transfer',
      issuedAt: '2026-11-02T09:15:00.000Z',
      salesOrderNumber: 'SO-2026-0004',
      reference: 'DEVIS-11',
      notes: 'Hand over at the counter.',
      netAmountMinor: 26_700,
      taxAmountMinor: 3382,
      totalAmountMinor: 30_082,
      paidAmountMinor: 10_000,
      remainingAmountMinor: 20_082,
      createdByEmail: 'alice@example.com',
      warehouseCode: 'MAIN',
      warehouseName: 'Main depot',
      locationCode: 'A1',
      locationName: 'Shelf A1',
      customer: CUSTOMER,
    },
    lines: [
      {
        productSku: 'CABLE-USB-C',
        productName: 'USB-C cable',
        quantity: 3,
        unitPriceMinor: 8900,
        taxRatePercent: 19,
        netAmountMinor: 26_700,
        taxAmountMinor: 5073,
        serialNumber: null,
      },
      {
        productSku: 'IPHONE-15',
        productName: 'iPhone 15',
        quantity: 1,
        unitPriceMinor: 3_690_000,
        taxRatePercent: 0,
        netAmountMinor: 3_690_000,
        taxAmountMinor: 0,
        serialNumber: 'SN-INVOICE-0001',
      },
    ],
    payments: [
      {
        amountMinor: 10_000,
        method: 'bank_transfer',
        note: 'Terminal slip 4411',
        recordedByEmail: 'alice@example.com',
        recordedAt: '2026-11-02T09:16:00.000Z',
      },
    ],
  };
}

function invoice(locale: DocumentLocale): SalesDocument {
  return buildSalesInvoiceDocument(invoiceInput(locale));
}

function issueNote(locale: DocumentLocale): SalesDocument {
  const { invoice: header, ...rest } = invoiceInput(locale);
  return buildIssueNoteDocument({
    ...rest,
    invoice: {
      number: header.number,
      orderStatus: 'fulfilled',
      issuedAt: header.issuedAt,
      salesOrderNumber: header.salesOrderNumber,
      reference: header.reference,
      notes: header.notes,
      createdByEmail: header.createdByEmail,
      warehouseCode: header.warehouseCode,
      warehouseName: header.warehouseName,
      locationCode: header.locationCode,
      locationName: header.locationName,
      customer: header.customer,
    },
  });
}

async function htmlOf(document: PurchaseDocument | SalesDocument): Promise<string> {
  const template =
    'kind' in document ? purchaseTemplate(document, AT) : salesTemplate(document, AT);

  // The renderer's own whitespace is irrelevant here; only the structure is under test.
  return (await renderDocumentHtml(template, null)).replace(/\s+/g, ' ');
}

/** The totals rows in the order the model produced them, label and value read from one `tr`. */
function totalsRows(html: string): { label: string; value: string; strong: boolean }[] {
  const section = /<section class="totals">([\s\S]*?)<\/section>/.exec(html);
  expect(section, 'every document prints a totals block').not.toBeNull();

  const rows =
    /<tr class="([^"]*)"><td class="label">([\s\S]*?)<\/td><td class="value">([\s\S]*?)<\/td><\/tr>/g;

  return [...(section?.[1] ?? '').matchAll(rows)].map((row) => ({
    label: (row[2] ?? '').replace(/<[^>]+>/g, ''),
    value: (row[3] ?? '').replace(/<[^>]+>/g, ''),
    strong: (row[1] ?? '').includes('strong'),
  }));
}

describe('document template', () => {
  it('keeps each totals label on the same row as the amount it names', async () => {
    for (const locale of ['en', 'fr', 'ar'] as DocumentLocale[]) {
      const document = invoice(locale);
      const html = await htmlOf(document);

      expect(totalsRows(html)).toEqual(
        document.totals.map((row) => ({
          label: row.label,
          value: row.value,
          strong: row.strong === true,
        })),
      );

      // The block is its own ruled box, so no total can reach outside the page.
      expect(html).toMatch(
        /\.totals \{ width: 248pt; margin-inline-start: auto;[^}]*break-inside: avoid/,
      );
      expect(html).toMatch(/\.totals td\.value \{ width: 96pt; text-align: end/);
    }
  });

  /** Each payment as the template emits it: the method, its detail and the amount in one row. */
  function paymentRows(html: string): { method: string; detail: string; amount: string }[] {
    const section = /<section class="payments">([\s\S]*?)<\/section>/.exec(html);
    expect(section, 'an invoice with payments prints them').not.toBeNull();

    const rows =
      /<tr><td><span class="method">([\s\S]*?)<\/span>(?:<span class="detail">([\s\S]*?)<\/span>)?<\/td><td class="amount">([\s\S]*?)<\/td><\/tr>/g;

    return [...(section?.[1] ?? '').matchAll(rows)].map((row) => ({
      method: (row[1] ?? '').replace(/<[^>]+>/g, ''),
      detail: (row[2] ?? '').replace(/<[^>]+>/g, ''),
      amount: (row[3] ?? '').replace(/<[^>]+>/g, ''),
    }));
  }

  it('keeps each payment amount beside the method it was paid with', async () => {
    for (const locale of ['en', 'fr', 'ar'] as DocumentLocale[]) {
      const document = invoice(locale);
      const html = await htmlOf(document);

      expect(paymentRows(html)).toEqual(
        document.payments.map((payment) => ({
          method: payment.methodLabel,
          detail: payment.detail ?? '',
          amount: '10.000 TND',
        })),
      );

      // The list is a table of its own, and its money column is the one the totals use.
      expect(html).toMatch(/\.payments table \{ width: 100%; table-layout: fixed/);
      expect(html).toMatch(/\.payments \.amount \{ width: 96pt; text-align: end/);

      // Only the last row of the table is unruled: the totals box draws the rule under it.
      expect(html).toMatch(/table\.lines tbody tr:last-child td \{ border-bottom: 0/);
    }
  });

  it('wraps a description too long for its column instead of truncating it', async () => {
    const html = await htmlOf(invoice('ar'));

    expect(html).toMatch(/table\.lines td\.wrap \{[^}]*white-space: normal/);
    expect(html).toContain('<td class="start wrap"><span class="iso">USB-C cable</span></td>');

    // A wrapped row keeps its own height: the cell padding cannot push the rule onto the text.
    expect(html).toMatch(/table\.lines tr \{ break-inside: avoid/);
  });

  it('pairs each meta label with its value and gives a long one a second line', async () => {
    for (const locale of ['en', 'fr', 'ar'] as DocumentLocale[]) {
      const document = invoice(locale);
      const html = await htmlOf(document);
      const section = /<section class="meta">([\s\S]*?)<\/section>/.exec(html);
      expect(section, 'the meta row prints the dates and the reference').not.toBeNull();

      const entries = [
        ...(section?.[1] ?? '').matchAll(/<div><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/div>/g),
      ].map((entry) => ({ label: entry[1], value: entry[2].replace(/<[^>]+>/g, '') }));

      expect(entries).toEqual(document.meta);

      // Nothing in the row is cut with an ellipsis: a reference the counter cannot read in full
      // is the same defect as a truncated SKU, and the row has the room to break onto a second line.
      expect(html).toMatch(/\.meta p \{[^}]*overflow-wrap: anywhere/);
      expect(html).not.toMatch(/\.meta p \{[^}]*text-overflow/);
    }
  });

  it('lays every column set out inside the printable width', async () => {
    for (const locale of ['fr', 'ar'] as DocumentLocale[]) {
      for (const document of [purchaseOrder(locale), invoice(locale), issueNote(locale)]) {
        const html = await htmlOf(document);
        const colgroup = /<table class="lines"><colgroup>([\s\S]*?)<\/colgroup>/.exec(html);
        expect(colgroup, 'the line table needs an explicit column box').not.toBeNull();

        const widths = [...(colgroup?.[1] ?? '').matchAll(/<col style="width:([\d.]+)pt">/g)].map(
          (match) => Number(match[1]),
        );
        expect(widths.length).toBeGreaterThan(4);
        expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(CONTENT_WIDTH_PT, 6);

        // Each locale prints its own header inside its own column, so a header must wrap
        // rather than truncate: 58pt is what French «QUANTITÉ» was measured to need.
        expect(html).toMatch(/table\.lines th \{[^}]*white-space: normal/);
        expect(html).toMatch(/table\.lines th \{[^}]*height: auto/);
      }
    }
  });

  it('prints the continuation header only after the first page', async () => {
    const html = await htmlOf(purchaseOrder('en'));

    expect(html).toMatch(/@top-left \{ content: "Org A"/);
    expect(html).toMatch(/@top-right \{ content: "Purchase order PO-2026-0001"/);
    expect(html).toMatch(
      /@page :first \{ @top-left \{ content: none; \} @top-right \{ content: none; \} \}/,
    );

    // The footer counts the pages itself, so it stays right however the flow breaks.
    expect(html).toMatch(/content: "Page " counter\(page\)" of " counter\(pages\)/);
    expect(html).toContain('Generated by Nexora on 2026-11-05 10:00 UTC');

    // A fixed element repeats on every page, which is how the rule and the watermark survive.
    expect(html).toMatch(/\.footer-rule \{ position: fixed;[^}]*bottom: 0/);
    expect(html).toMatch(/\.watermark \{ position: fixed;[^}]*opacity: \.22/);
  });

  it('mirrors the footer boxes and holds ASCII runs left-to-right in Arabic', async () => {
    const html = await htmlOf(invoice('ar'));

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toMatch(/\.iso \{ unicode-bidi: isolate; direction: ltr; \}/);

    // The generated line keeps the reader's start edge, so the boxes swap sides.
    expect(html).toMatch(/@bottom-right \{ content: "أُنشئ بواسطة نكسورا في/);
    expect(html).toMatch(/@bottom-left \{ content: "صفحة " counter\(page\)/);

    for (const run of [
      '+216 22 111 222',
      'amel@example.tn',
      'DEVIS-11',
      'IPHONE-15: SN-INVOICE-0001',
    ]) {
      expect(html).toContain(`<span class="iso">${run}</span>`);
    }

    // The party name and the catalog labels are the document's own direction: no isolate.
    expect(html).toContain('<p class="party-name">Amel Ben Salem</p>');
    expect(html).toContain('<h3>الفاتورة باسم</h3>');

    const latin = await htmlOf(invoice('en'));
    expect(latin).toContain('<html lang="en" dir="ltr">');
    expect(latin).not.toContain('class="iso"');
    expect(latin).toMatch(/@bottom-left \{ content: "Generated by Nexora on/);
  });

  it('watermarks a draft on every page and a live document on none', async () => {
    const draft = await htmlOf(purchaseOrder('ar'));
    expect([...draft.matchAll(/<div class="watermark">/g)]).toHaveLength(1);
    expect(draft).toContain('<div class="watermark">مسودة</div>');
    expect(draft).toContain('<p class="number">PO-2026-0001&nbsp;&nbsp;مسودة</p>');

    const ordered = await htmlOf(purchaseOrder('en', 'ordered'));
    expect(ordered).not.toContain('class="watermark"');
    expect(ordered).toContain('<p class="number">PO-2026-0001&nbsp;&nbsp;Ordered</p>');

    const settled = await htmlOf(invoice('en'));
    expect(settled).not.toContain('class="watermark"');
    expect(settled).toContain('Partially paid');
  });
});
