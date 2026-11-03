import { PDFDocument } from 'pdf-lib';

import { formatMillimesAscii, formatQuantityAscii, sanitizeText } from './document-format';
import {
  BOTTOM,
  CONTENT_WIDTH,
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
} from './pdf-layout';
import { type PurchaseDocument, type PurchaseDocumentLine } from './purchase-document-model';

const FIXED_COLUMNS = 24 + 78 + 54 + 74 + 79;
const COLUMNS: PdfColumn[] = [
  { label: '#', width: 24, align: 'left' },
  { label: 'SKU', width: 78, align: 'left' },
  { label: 'Description', width: CONTENT_WIDTH - FIXED_COLUMNS, align: 'left' },
  { label: 'Qty', width: 54, align: 'right' },
  { label: 'Unit cost', width: 74, align: 'right' },
  { label: 'Amount', width: 79, align: 'right' },
];

function lineValues(index: number, line: PurchaseDocumentLine): string[] {
  return [
    String(index + 1),
    line.sku,
    line.description,
    formatQuantityAscii(line.quantity),
    line.unitCostMinor === null ? '-' : formatMillimesAscii(line.unitCostMinor),
    line.amountMinor === null ? '-' : formatMillimesAscii(line.amountMinor),
  ];
}

export async function renderPurchaseDocument(document: PurchaseDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(sanitizeText(`${document.title} ${document.number}`));
  pdf.setProducer('Nexora');
  pdf.setCreator('Nexora');

  const fonts = await embedDocumentFonts(pdf);
  const cursor: PageCursor = {
    pdf,
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: 0,
    fonts,
    heading: document,
  };

  drawDocumentHeader(cursor, 'Nexora inventory platform', document.statusLabel);
  drawParties(cursor, 'SUPPLIER', document.supplier, 'SHIP TO', document.shipTo);
  drawMeta(cursor, document.meta);
  cursor.y = drawColumnHeader(cursor.page, cursor.y, COLUMNS, fonts);
  drawTable(
    cursor,
    COLUMNS,
    document.lines.map((line, index) => lineValues(index, line)),
    'No lines on this document.',
  );

  if (cursor.y - 100 < BOTTOM) {
    addPage(cursor, null);
  }
  cursor.y -= 10;

  const totals = document.totals;
  const caption =
    totals.missingCostLines === 0
      ? null
      : totals.missingCostLines === 1
        ? '1 line has no unit cost and is excluded from the total.'
        : `${totals.missingCostLines} lines have no unit cost and are excluded from the total.`;

  drawTotals(
    cursor,
    [
      { label: 'Lines', value: String(totals.lineCount) },
      { label: 'Total quantity', value: formatQuantityAscii(totals.quantity) },
      {
        label: 'Total value',
        value: totals.pricedLines > 0 ? `${formatMillimesAscii(totals.knownValueMinor)} TND` : '-',
        strong: true,
      },
    ],
    caption,
  );

  cursor.y -= 6;
  drawNote(cursor, document.note);
  cursor.y -= 4;
  drawSerials(cursor, document.serials);

  drawWatermarkAndFooter(pdf, fonts, document.watermark);
  return pdf.save();
}
