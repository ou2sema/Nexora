import { PDFDocument } from 'pdf-lib';

import { formatMillimesAscii, formatQuantityAscii, sanitizeText } from './document-format';
import {
  BOTTOM,
  CONTENT_WIDTH,
  INK,
  MARGIN,
  MUTED,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  type PageCursor,
  type PdfColumn,
  addPage,
  drawColumnHeader,
  drawDocumentHeader,
  drawMeta,
  drawNote,
  drawParties,
  drawSerials,
  drawTable,
  drawTotals,
  drawWatermarkAndFooter,
  embedDocumentFonts,
  fitText,
  rightText,
  text,
  wrapText,
} from './pdf-layout';
import { type SalesDocument, type SalesDocumentLine } from './sales-document-model';

const INVOICE_FIXED = 24 + 78 + 44 + 70 + 40 + 72;
const INVOICE_COLUMNS: PdfColumn[] = [
  { label: '#', width: 24, align: 'left' },
  { label: 'SKU', width: 78, align: 'left' },
  { label: 'Description', width: CONTENT_WIDTH - INVOICE_FIXED, align: 'left' },
  { label: 'Qty', width: 44, align: 'right' },
  { label: 'Unit price', width: 70, align: 'right' },
  { label: 'Tax', width: 40, align: 'right' },
  { label: 'Amount', width: 72, align: 'right' },
];

const ISSUE_FIXED = 24 + 78 + 44 + 150;
const ISSUE_COLUMNS: PdfColumn[] = [
  { label: '#', width: 24, align: 'left' },
  { label: 'SKU', width: 78, align: 'left' },
  { label: 'Description', width: CONTENT_WIDTH - ISSUE_FIXED, align: 'left' },
  { label: 'Qty', width: 44, align: 'right' },
  { label: 'Serial / IMEI', width: 150, align: 'left' },
];

const PAYMENT_AMOUNT_WIDTH = 120;

function lineValues(index: number, line: SalesDocumentLine, withAmounts: boolean): string[] {
  const identity = [
    String(index + 1),
    line.sku,
    line.description,
    formatQuantityAscii(line.quantity),
  ];

  if (!withAmounts) return [...identity, line.serial ?? '-'];

  return [
    ...identity,
    formatMillimesAscii(line.unitPriceMinor),
    `${Number(line.taxRatePercent.toFixed(4))}%`,
    formatMillimesAscii(line.netAmountMinor),
  ];
}

/**
 * Payments are the one block the invoice has and the issue note does not, so it
 * lives here instead of in the shared layout.
 */
function drawPayments(cursor: PageCursor, document: SalesDocument): void {
  if (document.payments.length === 0) return;

  const { page, fonts } = cursor;
  let y = cursor.y;
  text(page, fonts.bold, 7.5, 'PAYMENTS RECEIVED', MARGIN, y, MUTED);
  y -= 13;

  for (const payment of document.payments) {
    if (y < BOTTOM + 10) {
      addPage(cursor, null);
      y = cursor.y;
    }

    const amount = `${formatMillimesAscii(payment.amountMinor)} TND`;
    rightText(
      cursor.page,
      fonts.regular,
      8.5,
      amount,
      MARGIN + CONTENT_WIDTH,
      y,
      INK,
      PAYMENT_AMOUNT_WIDTH,
    );
    text(
      cursor.page,
      fonts.regular,
      8.5,
      fitText(fonts.regular, 8.5, payment.methodLabel, CONTENT_WIDTH - PAYMENT_AMOUNT_WIDTH - 8),
      MARGIN,
      y,
    );
    y -= 11;

    if (payment.detail) {
      for (const line of wrapText(fonts.regular, 7.5, payment.detail, CONTENT_WIDTH - 8)) {
        if (y < BOTTOM + 10) {
          addPage(cursor, null);
          y = cursor.y;
        }
        text(cursor.page, fonts.regular, 7.5, line, MARGIN, y, MUTED);
        y -= 9.5;
      }
    }

    y -= 2;
  }

  cursor.y = y - 6;
}

export async function renderSalesDocument(document: SalesDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(sanitizeText(`${document.title} ${document.number}`));
  pdf.setProducer('Nexora');
  pdf.setCreator('Nexora');

  const fonts = await embedDocumentFonts(pdf);
  const columns = document.columns === 'invoice' ? INVOICE_COLUMNS : ISSUE_COLUMNS;
  const cursor: PageCursor = {
    pdf,
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: 0,
    fonts,
    heading: document,
  };

  drawDocumentHeader(cursor, 'Nexora inventory platform', document.statusLabel);
  drawParties(cursor, 'BILL TO', document.customer, 'DEPOT', document.depot);
  drawMeta(cursor, document.meta);
  cursor.y = drawColumnHeader(cursor.page, cursor.y, columns, fonts);
  drawTable(
    cursor,
    columns,
    document.lines.map((line, index) => lineValues(index, line, document.columns === 'invoice')),
    'No lines on this document.',
  );

  if (cursor.y - 110 < BOTTOM) {
    addPage(cursor, null);
  }
  cursor.y -= 10;
  drawTotals(cursor, document.totals, null);

  drawPayments(cursor, document);
  if (document.payments.length > 0) cursor.y -= 6;

  cursor.y -= 4;
  drawNote(cursor, document.note);
  drawSerials(cursor, document.serials);

  drawWatermarkAndFooter(pdf, fonts, document.watermark);
  return pdf.save();
}
