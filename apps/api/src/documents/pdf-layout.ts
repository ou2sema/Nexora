import { type PDFDocument, type PDFFont, type PDFPage, StandardFonts, degrees, rgb } from 'pdf-lib';

import {
  type DocumentHeading,
  type DocumentMeta,
  type DocumentNote,
  type DocumentParty,
  type DocumentTotalRow,
  sanitizeText,
} from './document-format';

/**
 * Page geometry and drawing primitives shared by the purchase documents and the
 * sales documents. A4 portrait, one content column, and the small set of
 * operations every document needs: fitted and wrapped text, right-aligned money,
 * ruled tables, continuation headers, and the watermark plus footer.
 */

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 48;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
export const BOTTOM = 72;
export const ROW_HEIGHT = 20;
export const TABLE_HEADER_HEIGHT = 20;

export const INK = rgb(0.09, 0.12, 0.16);
export const MUTED = rgb(0.42, 0.46, 0.52);
export const RULE = rgb(0.84, 0.86, 0.89);
export const FILL = rgb(0.95, 0.96, 0.97);
export const WATERMARK = rgb(0.55, 0.58, 0.62);

export interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
}

export interface PdfColumn {
  label: string;
  width: number;
  align: 'left' | 'right';
}

export async function embedDocumentFonts(pdf: PDFDocument): Promise<PdfFonts> {
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };
}

export function fitText(font: PDFFont, size: number, value: string, maxWidth: number): string {
  const text = sanitizeText(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}

export function wrapText(font: PDFFont, size: number, value: string, maxWidth: number): string[] {
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

export function text(
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

export function rightText(
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

export function drawRule(
  page: PDFPage,
  y: number,
  color = RULE,
  fromX = MARGIN,
  toX = MARGIN + CONTENT_WIDTH,
): void {
  page.drawLine({
    start: { x: fromX, y },
    end: { x: toX, y },
    thickness: 0.7,
    color,
  });
}

export function drawColumnHeader(
  page: PDFPage,
  startY: number,
  columns: PdfColumn[],
  fonts: PdfFonts,
): number {
  page.drawRectangle({
    x: MARGIN,
    y: startY - TABLE_HEADER_HEIGHT,
    width: CONTENT_WIDTH,
    height: TABLE_HEADER_HEIGHT,
    color: FILL,
  });

  let x = MARGIN;
  for (const column of columns) {
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

export function drawColumnRow(
  page: PDFPage,
  startY: number,
  columns: PdfColumn[],
  values: string[],
  fonts: PdfFonts,
): void {
  let x = MARGIN;
  columns.forEach((column, columnIndex) => {
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

/**
 * The smaller of the two headers: the first page carries the document title, every
 * following page repeats the identification line so a split table stays traceable.
 */
export function drawContinuationHeader(
  page: PDFPage,
  heading: DocumentHeading,
  fonts: PdfFonts,
): number {
  const top = PAGE_HEIGHT - MARGIN;
  text(page, fonts.bold, 9.5, heading.organizationName, MARGIN, top - 10);
  rightText(
    page,
    fonts.regular,
    8.5,
    `${heading.title}  ${heading.number}`,
    MARGIN + CONTENT_WIDTH,
    top - 10,
    MUTED,
  );
  const y = top - 20;
  drawRule(page, y);
  return y - 12;
}

export function drawWatermarkAndFooter(
  pdf: PDFDocument,
  fonts: PdfFonts,
  watermark: string | null,
): void {
  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const pages = pdf.getPages();

  pages.forEach((page, index) => {
    if (watermark) {
      const size = 84;
      const width = fonts.bold.widthOfTextAtSize(watermark, size);
      page.drawText(watermark, {
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
    text(page, fonts.regular, 7.5, `Generated by Nexora on ${generated} UTC`, MARGIN, 38, MUTED);
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

/**
 * Everything below is a page block: it reads the cursor's current y, draws its
 * own content, breaks to a new page when the content reaches the bottom margin,
 * and leaves the cursor on the line after itself. A document family only has to
 * decide which blocks it draws and what text goes into them.
 */
export interface PageCursor {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  fonts: PdfFonts;
  heading: DocumentHeading;
}

export function addPage(cursor: PageCursor, columns: PdfColumn[] | null): void {
  cursor.page = cursor.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawContinuationHeader(cursor.page, cursor.heading, cursor.fonts);
  if (columns) {
    y = drawColumnHeader(cursor.page, y, columns, cursor.fonts);
  }
  cursor.y = y;
}

export function drawDocumentHeader(
  cursor: PageCursor,
  subtitle: string,
  statusLabel: string | null,
): void {
  const { page, fonts, heading } = cursor;
  const top = PAGE_HEIGHT - MARGIN;

  text(page, fonts.bold, 15, heading.organizationName, MARGIN, top - 10);
  text(page, fonts.regular, 8, subtitle, MARGIN, top - 24, MUTED);
  rightText(page, fonts.bold, 17, heading.title, MARGIN + CONTENT_WIDTH, top - 9);
  rightText(
    page,
    fonts.regular,
    10,
    statusLabel ? `${heading.number}  ${statusLabel}` : heading.number,
    MARGIN + CONTENT_WIDTH,
    top - 24,
    MUTED,
  );

  const y = top - 40;
  drawRule(page, y);
  cursor.y = y - 22;
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

export function drawParties(
  cursor: PageCursor,
  leftLabel: string,
  left: DocumentParty,
  rightLabel: string,
  right: DocumentParty,
): void {
  const { page, fonts } = cursor;
  const leftX = MARGIN;
  const rightX = MARGIN + CONTENT_WIDTH / 2 + 12;
  const columnWidth = CONTENT_WIDTH / 2 - 12;
  const bodyStart = cursor.y - 14;

  text(page, fonts.bold, 7.5, leftLabel, leftX, cursor.y, MUTED);
  text(page, fonts.bold, 7.5, rightLabel, rightX, cursor.y, MUTED);

  text(page, fonts.bold, 9.5, left.name, leftX, bodyStart);
  text(page, fonts.bold, 9.5, right.name, rightX, bodyStart);

  const leftY = drawPartyDetails(
    page,
    fonts.regular,
    left.details,
    leftX,
    bodyStart - 12,
    columnWidth,
  );
  const rightY = drawPartyDetails(
    page,
    fonts.regular,
    right.details,
    rightX,
    bodyStart - 12,
    columnWidth,
  );

  cursor.y = Math.min(leftY, rightY) - 10;
}

export function drawMeta(cursor: PageCursor, meta: DocumentMeta[]): void {
  const { page, fonts } = cursor;
  const startY = cursor.y;
  const columnWidth = CONTENT_WIDTH / meta.length;

  meta.forEach((entry, index) => {
    const x = MARGIN + index * columnWidth;
    text(page, fonts.bold, 7, entry.label.toUpperCase(), x, startY, MUTED);
    text(
      page,
      fonts.regular,
      9,
      fitText(fonts.regular, 9, entry.value, columnWidth - 10),
      x,
      startY - 13,
    );
  });

  cursor.y = startY - 30;
}

export function drawTable(
  cursor: PageCursor,
  columns: PdfColumn[],
  rows: string[][],
  emptyMessage: string,
): void {
  for (const row of rows) {
    if (cursor.y - ROW_HEIGHT < BOTTOM) {
      addPage(cursor, columns);
    }
    drawColumnRow(cursor.page, cursor.y, columns, row, cursor.fonts);
    cursor.y -= ROW_HEIGHT;
  }

  if (rows.length === 0) {
    text(cursor.page, cursor.fonts.regular, 8.5, emptyMessage, MARGIN + 6, cursor.y - 13, MUTED);
    cursor.y -= ROW_HEIGHT;
  }
}

/**
 * The totals block is a right-hand column, not a full-width band: the labels end
 * just left of the amount column and the rules stop at the block's own left edge,
 * so nothing in it hangs outside a line.
 */
const TOTALS_BOX_WIDTH = 220;
const TOTALS_VALUE_WIDTH = 96;

export function drawTotals(
  cursor: PageCursor,
  rows: DocumentTotalRow[],
  caption: string | null,
): void {
  const { page, fonts } = cursor;
  const leftX = MARGIN + CONTENT_WIDTH - TOTALS_BOX_WIDTH;
  const rightEdge = MARGIN + CONTENT_WIDTH;
  const labelRightEdge = rightEdge - TOTALS_VALUE_WIDTH;

  let y = cursor.y;
  drawRule(page, y, RULE, leftX, rightEdge);
  y -= 15;

  for (const row of rows) {
    if (row.strong) {
      drawRule(page, y + 5, RULE, leftX, rightEdge);
    }
    rightText(
      page,
      row.strong ? fonts.bold : fonts.regular,
      row.strong ? 9.5 : 8.5,
      row.label,
      labelRightEdge,
      y,
      row.strong ? INK : MUTED,
      labelRightEdge - leftX,
    );
    rightText(
      page,
      row.strong ? fonts.bold : fonts.regular,
      row.strong ? 10.5 : 9,
      row.value,
      rightEdge,
      y,
      INK,
      TOTALS_VALUE_WIDTH,
    );
    y -= row.strong ? 18 : 15;
  }

  if (caption) {
    text(
      page,
      fonts.regular,
      7.5,
      fitText(fonts.regular, 7.5, caption, TOTALS_BOX_WIDTH),
      leftX,
      y,
      MUTED,
    );
    y -= 10;
  }

  cursor.y = y - 8;
}

export function drawNote(cursor: PageCursor, note: DocumentNote | null): void {
  if (!note) return;

  let y = cursor.y;
  text(cursor.page, cursor.fonts.bold, 7.5, note.title.toUpperCase(), MARGIN, y, MUTED);
  y -= 13;

  for (const line of wrapText(cursor.fonts.regular, 8.5, note.body, CONTENT_WIDTH - 8)) {
    if (y < BOTTOM + 10) {
      addPage(cursor, null);
      y = cursor.y;
    }
    text(cursor.page, cursor.fonts.regular, 8.5, line, MARGIN, y, INK);
    y -= 11.5;
  }

  cursor.y = y - 6;
}

export function drawSerials(
  cursor: PageCursor,
  serials: { sku: string; serials: string[] }[],
): void {
  if (serials.length === 0) return;

  let y = cursor.y;
  text(cursor.page, cursor.fonts.bold, 7.5, 'SERIAL NUMBERS', MARGIN, y, MUTED);
  y -= 13;

  for (const group of serials) {
    const body = `${group.sku}: ${group.serials.join(', ')}`;
    for (const line of wrapText(cursor.fonts.mono, 8, body, CONTENT_WIDTH - 8)) {
      if (y < BOTTOM + 10) {
        addPage(cursor, null);
        y = cursor.y;
      }
      text(cursor.page, cursor.fonts.mono, 8, line, MARGIN, y, INK);
      y -= 10.5;
    }
    y -= 2;
  }

  cursor.y = y - 4;
}
