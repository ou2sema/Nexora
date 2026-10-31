import { type PDFFont, type PDFPage, PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

import {
  type PurchaseDocument,
  type PurchaseDocumentLine,
  formatMillimesAscii,
  formatQuantityAscii,
  sanitizeText,
} from './purchase-document-model';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = 72;
const ROW_HEIGHT = 20;
const TABLE_HEADER_HEIGHT = 20;

const INK = rgb(0.09, 0.12, 0.16);
const MUTED = rgb(0.42, 0.46, 0.52);
const RULE = rgb(0.84, 0.86, 0.89);
const FILL = rgb(0.95, 0.96, 0.97);
const WATERMARK = rgb(0.55, 0.58, 0.62);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
}

interface RenderContext {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  fonts: Fonts;
  document: PurchaseDocument;
}

interface Column {
  label: string;
  width: number;
  align: 'left' | 'right';
}

const FIXED_COLUMNS = 24 + 78 + 54 + 74 + 79;
const COLUMNS: Column[] = [
  { label: '#', width: 24, align: 'left' },
  { label: 'SKU', width: 78, align: 'left' },
  { label: 'Description', width: CONTENT_WIDTH - FIXED_COLUMNS, align: 'left' },
  { label: 'Qty', width: 54, align: 'right' },
  { label: 'Unit cost', width: 74, align: 'right' },
  { label: 'Amount', width: 79, align: 'right' },
];

function fitText(font: PDFFont, size: number, value: string, maxWidth: number): string {
  const text = sanitizeText(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}

function wrapText(font: PDFFont, size: number, value: string, maxWidth: number): string[] {
  const words = sanitizeText(value)
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }

    let chunk = '';
    for (const character of word) {
      const next = chunk + character;
      if (chunk && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = next;
      }
    }
    current = chunk;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function text(
  page: PDFPage,
  font: PDFFont,
  size: number,
  value: string,
  x: number,
  y: number,
  color = INK,
): void {
  page.drawText(sanitizeText(value), { x, y, size, font, color });
}

function rightText(
  page: PDFPage,
  font: PDFFont,
  size: number,
  value: string,
  rightEdge: number,
  y: number,
  color = INK,
  maxWidth = CONTENT_WIDTH,
): void {
  const fitted = fitText(font, size, value, maxWidth);
  page.drawText(fitted, {
    x: rightEdge - font.widthOfTextAtSize(fitted, size),
    y,
    size,
    font,
    color,
  });
}

function drawRule(page: PDFPage, y: number, color = RULE): void {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 0.7,
    color,
  });
}

function drawFirstPageHeader(context: RenderContext): number {
  const { page, document, fonts } = context;
  const top = PAGE_HEIGHT - MARGIN;

  text(page, fonts.bold, 15, document.organizationName, MARGIN, top - 10);
  text(page, fonts.regular, 8, 'MyStock inventory platform', MARGIN, top - 24, MUTED);

  rightText(page, fonts.bold, 17, document.title, MARGIN + CONTENT_WIDTH, top - 9);
  rightText(
    page,
    fonts.regular,
    10,
    `${document.number}  ${document.statusLabel}`,
    MARGIN + CONTENT_WIDTH,
    top - 24,
    MUTED,
  );

  const y = top - 40;
  drawRule(page, y);
  return y - 22;
}

function drawContinuationHeader(page: PDFPage, document: PurchaseDocument, fonts: Fonts): number {
  const top = PAGE_HEIGHT - MARGIN;
  text(page, fonts.bold, 9.5, document.organizationName, MARGIN, top - 10);
  rightText(
    page,
    fonts.regular,
    8.5,
    `${document.title}  ${document.number}`,
    MARGIN + CONTENT_WIDTH,
    top - 10,
    MUTED,
  );
  const y = top - 20;
  drawRule(page, y);
  return y - 12;
}

function drawPartyDetails(
  page: PDFPage,
  font: PDFFont,
  details: string[],
  x: number,
  startY: number,
  maxWidth: number,
): number {
  let y = startY;
  for (const detail of details) {
    for (const line of wrapText(font, 8, detail, maxWidth)) {
      text(page, font, 8, line, x, y, MUTED);
      y -= 10.5;
    }
  }
  return y;
}

function drawParties(context: RenderContext, startY: number): number {
  const { page, document, fonts } = context;
  const labelY = startY;
  const leftX = MARGIN;
  const rightX = MARGIN + CONTENT_WIDTH / 2 + 12;
  const columnWidth = CONTENT_WIDTH / 2 - 12;

  text(page, fonts.bold, 7.5, 'SUPPLIER', leftX, labelY, MUTED);
  text(page, fonts.bold, 7.5, 'SHIP TO', rightX, labelY, MUTED);

  const bodyStart = labelY - 14;
  text(page, fonts.bold, 9.5, document.supplier.name, leftX, bodyStart);
  text(page, fonts.bold, 9.5, document.shipTo.name, rightX, bodyStart);

  const supplierY = drawPartyDetails(
    page,
    fonts.regular,
    document.supplier.details,
    leftX,
    bodyStart - 12,
    columnWidth,
  );
  const shipToY = drawPartyDetails(
    page,
    fonts.regular,
    document.shipTo.details,
    rightX,
    bodyStart - 12,
    columnWidth,
  );

  return Math.min(supplierY, shipToY) - 10;
}

function drawMeta(context: RenderContext, startY: number): number {
  const { page, document, fonts } = context;
  const columnWidth = CONTENT_WIDTH / document.meta.length;

  document.meta.forEach((meta, index) => {
    const x = MARGIN + index * columnWidth;
    text(page, fonts.bold, 7, meta.label.toUpperCase(), x, startY, MUTED);
    text(
      page,
      fonts.regular,
      9,
      fitText(fonts.regular, 9, meta.value, columnWidth - 10),
      x,
      startY - 13,
    );
  });

  return startY - 30;
}

function drawTableHeader(page: PDFPage, startY: number, fonts: Fonts): number {
  page.drawRectangle({
    x: MARGIN,
    y: startY - TABLE_HEADER_HEIGHT,
    width: CONTENT_WIDTH,
    height: TABLE_HEADER_HEIGHT,
    color: FILL,
  });

  let x = MARGIN;
  for (const column of COLUMNS) {
    const baseline = startY - 13;
    if (column.align === 'right') {
      rightText(
        page,
        fonts.bold,
        7.5,
        column.label,
        x + column.width - 6,
        baseline,
        MUTED,
        column.width - 6,
      );
    } else {
      text(page, fonts.bold, 7.5, column.label, x + 6, baseline, MUTED);
    }
    x += column.width;
  }

  return startY - TABLE_HEADER_HEIGHT;
}

function drawLineRow(
  page: PDFPage,
  startY: number,
  index: number,
  line: PurchaseDocumentLine,
  fonts: Fonts,
): void {
  const values = [
    String(index + 1),
    line.sku,
    line.description,
    formatQuantityAscii(line.quantity),
    line.unitCostMinor === null ? '-' : formatMillimesAscii(line.unitCostMinor),
    line.amountMinor === null ? '-' : formatMillimesAscii(line.amountMinor),
  ];

  let x = MARGIN;
  COLUMNS.forEach((column, columnIndex) => {
    const baseline = startY - 13;
    const value = values[columnIndex] ?? '';
    if (column.align === 'right') {
      rightText(
        page,
        fonts.regular,
        8.5,
        value,
        x + column.width - 6,
        baseline,
        INK,
        column.width - 6,
      );
    } else {
      text(
        page,
        fonts.regular,
        8.5,
        fitText(fonts.regular, 8.5, value, column.width - 12),
        x + 6,
        baseline,
      );
    }
    x += column.width;
  });

  page.drawLine({
    start: { x: MARGIN, y: startY - ROW_HEIGHT },
    end: { x: MARGIN + CONTENT_WIDTH, y: startY - ROW_HEIGHT },
    thickness: 0.4,
    color: RULE,
  });
}

function drawTotals(context: RenderContext, startY: number): number {
  const { page, document, fonts } = context;
  const boxWidth = 220;
  const leftX = MARGIN + CONTENT_WIDTH - boxWidth;
  const rightEdge = MARGIN + CONTENT_WIDTH;
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Lines', value: String(document.totals.lineCount) },
    { label: 'Total quantity', value: formatQuantityAscii(document.totals.quantity) },
    {
      label: 'Total value',
      value:
        document.totals.pricedLines > 0
          ? `${formatMillimesAscii(document.totals.knownValueMinor)} TND`
          : '-',
      strong: true,
    },
  ];

  let y = startY;
  drawRule(page, y);
  y -= 15;

  for (const row of rows) {
    if (row.strong) {
      drawRule(page, y + 5, RULE);
    }
    text(
      page,
      row.strong ? fonts.bold : fonts.regular,
      row.strong ? 9.5 : 8.5,
      row.label,
      leftX,
      y,
      row.strong ? INK : MUTED,
    );
    rightText(
      page,
      row.strong ? fonts.bold : fonts.regular,
      row.strong ? 10.5 : 9,
      row.value,
      rightEdge,
      y,
      INK,
      boxWidth,
    );
    y -= row.strong ? 18 : 15;
  }

  if (document.totals.missingCostLines > 0) {
    const note =
      document.totals.missingCostLines === 1
        ? '1 line has no unit cost and is excluded from the total.'
        : `${document.totals.missingCostLines} lines have no unit cost and are excluded from the total.`;
    text(page, fonts.regular, 7.5, note, leftX, y, MUTED);
    y -= 10;
  }

  return y - 8;
}

function drawNote(context: RenderContext, startY: number): number {
  const { page, document, fonts } = context;
  if (!document.note) return startY;

  let y = startY;
  text(page, fonts.bold, 7.5, document.note.title.toUpperCase(), MARGIN, y, MUTED);
  y -= 13;

  for (const line of wrapText(fonts.regular, 8.5, document.note.body, CONTENT_WIDTH - 8)) {
    if (y < BOTTOM + 10) {
      addPage(context, false);
      y = context.y;
    }
    text(context.page, fonts.regular, 8.5, line, MARGIN, y, INK);
    y -= 11.5;
  }

  return y - 6;
}

function drawSerials(context: RenderContext, startY: number): number {
  const { page, document, fonts } = context;
  if (document.serials.length === 0) return startY;

  let y = startY;
  text(page, fonts.bold, 7.5, 'SERIAL NUMBERS', MARGIN, y, MUTED);
  y -= 13;

  for (const group of document.serials) {
    const body = `${group.sku}: ${group.serials.join(', ')}`;
    for (const line of wrapText(fonts.mono, 8, body, CONTENT_WIDTH - 8)) {
      if (y < BOTTOM + 10) {
        addPage(context, false);
        y = context.y;
      }
      text(context.page, fonts.mono, 8, line, MARGIN, y, INK);
      y -= 10.5;
    }
    y -= 2;
  }

  return y - 4;
}

function addPage(context: RenderContext, withTableHeader: boolean): void {
  context.page = context.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawContinuationHeader(context.page, context.document, context.fonts);
  if (withTableHeader) {
    y = drawTableHeader(context.page, y, context.fonts);
  }
  context.y = y;
}

function drawWatermarkAndFooter(context: RenderContext): void {
  const { pdf, document, fonts } = context;
  const pages = pdf.getPages();
  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ');

  pages.forEach((page, index) => {
    if (document.watermark) {
      const size = 84;
      const label = document.watermark;
      const width = fonts.bold.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: (PAGE_WIDTH - width) / 2,
        y: PAGE_HEIGHT / 2 - 80,
        size,
        font: fonts.bold,
        color: WATERMARK,
        opacity: 0.22,
        rotate: degrees(35),
      });
    }

    drawRule(page, 52);
    text(page, fonts.regular, 7.5, `Generated by MyStock on ${generated} UTC`, MARGIN, 38, MUTED);
    rightText(
      page,
      fonts.regular,
      7.5,
      `Page ${index + 1} of ${pages.length}`,
      MARGIN + CONTENT_WIDTH,
      38,
      MUTED,
    );
  });
}

export async function renderPurchaseDocument(document: PurchaseDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(sanitizeText(`${document.title} ${document.number}`));
  pdf.setProducer('MyStock');
  pdf.setCreator('MyStock');

  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };

  const context: RenderContext = {
    pdf,
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: 0,
    fonts,
    document,
  };

  context.y = drawFirstPageHeader(context);
  context.y = drawParties(context, context.y);
  context.y = drawMeta(context, context.y);
  context.y = drawTableHeader(context.page, context.y, fonts);

  document.lines.forEach((line, index) => {
    if (context.y - ROW_HEIGHT < BOTTOM) {
      addPage(context, true);
    }
    drawLineRow(context.page, context.y, index, line, fonts);
    context.y -= ROW_HEIGHT;
  });

  if (document.lines.length === 0) {
    text(
      context.page,
      fonts.regular,
      8.5,
      'No lines on this document.',
      MARGIN + 6,
      context.y - 13,
      MUTED,
    );
    context.y -= ROW_HEIGHT;
  }

  if (context.y - 100 < BOTTOM) {
    addPage(context, false);
  }
  context.y -= 10;
  context.y = drawTotals(context, context.y);
  context.y = drawNote(context, context.y - 6);
  context.y = drawSerials(context, context.y - 4);

  drawWatermarkAndFooter(context);
  return pdf.save();
}
