/**
 * The document template ADR-0019 decision 1 calls for. One template
 * serves all four A4 families: a family builds a `DocumentTemplate` — the same blocks,
 * the same point sizes, the same rules — and only the column set, the totals rows and
 * the trailing blocks differ.
 *
 * The page box is 595.28 × 841.89 pt with 48 pt side margins, a 48 pt head and a 72 pt
 * foot, so the content column is the 499.28 pt the hand-drawn renderer used. The
 * continuation header and the footer live in `@page` margin boxes because flow content
 * cannot be injected at the top of an auto-generated page; the footer rule and the
 * watermark are `position: fixed`, which Chromium repeats on every page.
 *
 * Direction is the document's, but every ASCII run — identifiers, SKUs, serials, dates,
 * emails and amounts — is wrapped in a bidi isolate so it keeps its own left-to-right
 * order inside an Arabic sentence. That is the only typographic decision the template
 * makes that the model did not already make.
 */

import { FONT_FAMILY, documentFontCss, logoDataUri } from './document-assets';
import type { DocumentLocale, DocumentStrings } from '../document-catalog';
import type {
  DocumentHeading,
  DocumentMeta,
  DocumentNote,
  DocumentParty,
  DocumentTotalRow,
} from '../document-format';
import { formatMillimesAscii, formatQuantityAscii } from '../document-format';
import type { PurchaseDocument, PurchaseDocumentLine } from '../purchase-document-model';
import type { SalesDocument, SalesDocumentLine } from '../sales-document-model';
import type { StoredLogo } from '../../logos/logo.reader';

const PAGE_WIDTH_PT = 595.28;
const PAGE_HEIGHT_PT = 841.89;
const SIDE_MARGIN_PT = 48;
const HEAD_MARGIN_PT = 48;
const FOOT_MARGIN_PT = 72;
const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - SIDE_MARGIN_PT * 2;

const INK = '#171f29';
const MUTED = '#6b7585';
const RULE = '#d6dbe3';
const FILL = '#f2f5f7';
const WATERMARK = '#8c949e';

export interface TemplateColumn {
  label: string;
  widthPt: number;
  align: 'start' | 'end';
  /** Free text gets to wrap instead of ending in an ellipsis. */
  wrap?: boolean;
}

export interface TemplatePartyBlock {
  label: string;
  party: DocumentParty;
}

export interface DocumentTemplate {
  locale: DocumentLocale;
  direction: 'ltr' | 'rtl';
  /** What `/Title` and the continuation header carry: `<title> <number>`. */
  identity: string;
  /** The instant printed in the footer and pinned into the PDF metadata. */
  createdAt: Date;
  heading: DocumentHeading;
  subtitle: string;
  statusLabel: string;
  watermark: string | null;
  parties: { left: TemplatePartyBlock; right: TemplatePartyBlock };
  meta: DocumentMeta[];
  columns: TemplateColumn[];
  rows: string[][];
  emptyMessage: string;
  totals: DocumentTotalRow[];
  totalsCaption: string | null;
  payments: { label: string; rows: { method: string; amount: string; detail: string | null }[] };
  note: DocumentNote | null;
  serials: { label: string; groups: { sku: string; serials: string[] }[] };
  generatedOn: string;
  pageLabel: { before: string; between: string };
}

/** The instant a document was rendered, truncated the way the footer prints it. */
export function documentTimestamp(at: Date): string {
  return at.toISOString().slice(0, 16).replace('T', ' ');
}

function purchaseLineValues(index: number, line: PurchaseDocumentLine): string[] {
  return [
    String(index + 1),
    line.sku,
    line.description,
    formatQuantityAscii(line.quantity),
    line.unitCostMinor === null ? '-' : formatMillimesAscii(line.unitCostMinor),
    line.amountMinor === null ? '-' : formatMillimesAscii(line.amountMinor),
  ];
}

function salesLineValues(index: number, line: SalesDocumentLine, withAmounts: boolean): string[] {
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
 * Purchase documents share one column set: the order and the return note differ only in
 * which rows they carry and which caption sits under the totals.
 *
 * The quantity and index widths are measured, not guessed: 58pt is what the longest
 * single-word header, French «QUANTITÉ», needs and 28pt is what a two-digit line number
 * needs after the cell padding. The identifiers — SKU and serial — and the description
 * wrap onto a second line rather than ending in an ellipsis, because a truncated part
 * number is a document the reader cannot act on.
 */
function purchaseColumns(strings: DocumentStrings): TemplateColumn[] {
  const fixed = 28 + 96 + 58 + 78 + 80;

  return [
    { label: strings.columns.index, widthPt: 28, align: 'start' },
    { label: strings.columns.sku, widthPt: 96, align: 'start', wrap: true },
    {
      label: strings.columns.description,
      widthPt: CONTENT_WIDTH_PT - fixed,
      align: 'start',
      wrap: true,
    },
    { label: strings.columns.quantity, widthPt: 58, align: 'end' },
    { label: strings.columns.unitCost, widthPt: 78, align: 'end' },
    { label: strings.columns.amount, widthPt: 80, align: 'end' },
  ];
}

function salesColumns(strings: DocumentStrings, withAmounts: boolean): TemplateColumn[] {
  if (withAmounts) {
    const fixed = 28 + 96 + 58 + 78 + 46 + 80;

    return [
      { label: strings.columns.index, widthPt: 28, align: 'start' },
      { label: strings.columns.sku, widthPt: 96, align: 'start', wrap: true },
      {
        label: strings.columns.description,
        widthPt: CONTENT_WIDTH_PT - fixed,
        align: 'start',
        wrap: true,
      },
      { label: strings.columns.quantity, widthPt: 58, align: 'end' },
      { label: strings.columns.unitPrice, widthPt: 78, align: 'end' },
      { label: strings.columns.tax, widthPt: 46, align: 'end' },
      { label: strings.columns.amount, widthPt: 80, align: 'end' },
    ];
  }

  const fixed = 28 + 96 + 58 + 150;

  return [
    { label: strings.columns.index, widthPt: 28, align: 'start' },
    { label: strings.columns.sku, widthPt: 96, align: 'start', wrap: true },
    {
      label: strings.columns.description,
      widthPt: CONTENT_WIDTH_PT - fixed,
      align: 'start',
      wrap: true,
    },
    { label: strings.columns.quantity, widthPt: 58, align: 'end' },
    { label: strings.columns.serial, widthPt: 150, align: 'start', wrap: true },
  ];
}

function sharedFields(
  document: DocumentHeading,
  strings: DocumentStrings,
  at: Date,
): Pick<
  DocumentTemplate,
  | 'locale'
  | 'direction'
  | 'identity'
  | 'createdAt'
  | 'heading'
  | 'subtitle'
  | 'generatedOn'
  | 'pageLabel'
> {
  return {
    locale: strings.locale,
    direction: strings.direction,
    identity: `${document.title} ${document.number}`,
    createdAt: at,
    heading: {
      organizationName: document.organizationName,
      title: document.title,
      number: document.number,
    },
    subtitle: strings.platformSubtitle,
    generatedOn: strings.generatedOn(documentTimestamp(at)),
    pageLabel: strings.pageLabel,
  };
}

export function purchaseTemplate(document: PurchaseDocument, at: Date): DocumentTemplate {
  const totals = document.totals;
  const strings = document.strings;

  return {
    ...sharedFields(document, strings, at),
    statusLabel: document.statusLabel,
    watermark: document.watermark,
    parties: {
      left: { label: strings.parties.supplier, party: document.supplier },
      right: { label: strings.parties.shipTo, party: document.shipTo },
    },
    meta: document.meta,
    columns: purchaseColumns(strings),
    rows: document.lines.map((line, index) => purchaseLineValues(index, line)),
    emptyMessage: strings.emptyTable,
    totals: [
      { label: strings.totals.lines, value: String(totals.lineCount) },
      { label: strings.totals.totalQuantity, value: formatQuantityAscii(totals.quantity) },
      {
        label: strings.totals.totalValue,
        value: totals.pricedLines > 0 ? `${formatMillimesAscii(totals.knownValueMinor)} TND` : '-',
        strong: true,
      },
    ],
    totalsCaption:
      totals.missingCostLines === 0 ? null : strings.missingCostCaption(totals.missingCostLines),
    payments: { label: strings.blocks.paymentsReceived, rows: [] },
    note: document.note,
    serials: { label: strings.blocks.serialNumbers, groups: document.serials },
  };
}

export function salesTemplate(document: SalesDocument, at: Date): DocumentTemplate {
  const strings = document.strings;
  const withAmounts = document.columns === 'invoice';

  return {
    ...sharedFields(document, strings, at),
    statusLabel: document.statusLabel,
    watermark: document.watermark,
    parties: {
      left: { label: strings.parties.billTo, party: document.customer },
      right: { label: strings.parties.depot, party: document.depot },
    },
    meta: document.meta,
    columns: salesColumns(strings, withAmounts),
    rows: document.lines.map((line, index) => salesLineValues(index, line, withAmounts)),
    emptyMessage: strings.emptyTable,
    totals: document.totals,
    totalsCaption: null,
    payments: {
      label: strings.blocks.paymentsReceived,
      rows: document.payments.map((payment) => ({
        method: payment.methodLabel,
        amount: `${formatMillimesAscii(payment.amountMinor)} TND`,
        detail: payment.detail,
      })),
    },
    note: document.note,
    serials: { label: strings.blocks.serialNumbers, groups: document.serials },
  };
}

const ASCII_RUN = /^[\x20-\x7e]*$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A quoted CSS string: only `\` and `"` need escaping, and no value may contain a newline. */
function cssText(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * An ASCII run inside a right-to-left document gets its own left-to-right bidi context,
 * which is what keeps `+216 22 111 222`, `INV-2026-0007` and `1,250.000 TND` in the order
 * they were written: `isolate` alone still inherits the RTL paragraph direction, so the
 * `direction: ltr` on `.iso` is what actually holds the run. Left-to-right documents need
 * nothing, so their markup is the same text the pdf-lib renderer drew.
 */
function printed(template: DocumentTemplate, text: string): string {
  const escaped = escapeHtml(text);
  if (template.direction === 'ltr' || !ASCII_RUN.test(text)) return escaped;
  return `<span class="iso">${escaped}</span>`;
}

function tableBlock(template: DocumentTemplate): string {
  const colgroup = template.columns
    .map((column) => `<col style="width:${column.widthPt}pt">`)
    .join('');
  const head = template.columns
    .map((column) => `<th class="${column.align}">${escapeHtml(column.label)}</th>`)
    .join('');

  const body =
    template.rows.length === 0
      ? `<tr><td class="start empty" colspan="${template.columns.length}">${escapeHtml(
          template.emptyMessage,
        )}</td></tr>`
      : template.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell, index) => {
                  const column = template.columns[index];
                  const classes = [column?.align ?? 'start', column?.wrap ? 'wrap' : '']
                    .filter(Boolean)
                    .join(' ');

                  return `<td class="${classes}">${printed(template, cell)}</td>`;
                })
                .join('')}</tr>`,
          )
          .join('');

  return `<table class="lines"><colgroup>${colgroup}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function partyBlock(template: DocumentTemplate, block: TemplatePartyBlock): string {
  return (
    `<section class="party"><h3>${escapeHtml(block.label)}</h3>` +
    `<p class="party-name">${escapeHtml(block.party.name)}</p>` +
    block.party.details
      .map((detail) => `<p class="party-line">${printed(template, detail)}</p>`)
      .join('') +
    '</section>'
  );
}

function metaBlock(template: DocumentTemplate): string {
  return `<section class="meta">${template.meta
    .map(
      (entry) =>
        `<div><h3>${escapeHtml(entry.label)}</h3><p>${printed(template, entry.value)}</p></div>`,
    )
    .join('')}</section>`;
}

function totalsBlock(template: DocumentTemplate): string {
  const rows = template.totals
    .map(
      (row) =>
        `<tr class="${row.strong ? 'strong' : ''}"><td class="label">${escapeHtml(
          row.label,
        )}</td><td class="value">${printed(template, row.value)}</td></tr>`,
    )
    .join('');

  return (
    '<section class="totals"><table><colgroup><col><col style="width:96pt"></colgroup>' +
    `<tbody>${rows}</tbody></table>` +
    (template.totalsCaption
      ? `<p class="totals-caption">${escapeHtml(template.totalsCaption)}</p>`
      : '') +
    '</section>'
  );
}

/**
 * One row per payment across the full content column, like the line table above it: the
 * amount sits in a 96pt column on the reader's end edge, which is the same edge the totals
 * and the line amounts finish at, so every figure on the page reads in one vertical line.
 * The detail — the transfer reference, the note, whoever recorded it — belongs to the method,
 * so it follows it on the same line; the full width is what keeps a long reference on one line.
 */
function paymentsBlock(template: DocumentTemplate): string {
  if (template.payments.rows.length === 0) return '';

  const rows = template.payments.rows
    .map(
      (payment) =>
        '<tr><td><span class="method">' +
        escapeHtml(payment.method) +
        '</span>' +
        (payment.detail ? `<span class="detail">${printed(template, payment.detail)}</span>` : '') +
        `</td><td class="amount">${printed(template, payment.amount)}</td></tr>`,
    )
    .join('');

  return (
    `<section class="payments"><h3>${escapeHtml(template.payments.label)}</h3>` +
    '<table><colgroup><col><col style="width:96pt"></colgroup>' +
    `<tbody>${rows}</tbody></table></section>`
  );
}

function noteBlock(template: DocumentTemplate): string {
  if (!template.note) return '';

  return `<section class="note"><h3>${escapeHtml(template.note.title)}</h3><p>${escapeHtml(
    template.note.body,
  )}</p></section>`;
}

function serialsBlock(template: DocumentTemplate): string {
  if (template.serials.groups.length === 0) return '';

  return (
    `<section class="serials"><h3>${escapeHtml(template.serials.label)}</h3>` +
    template.serials.groups
      .map((group) => `<p>${printed(template, `${group.sku}: ${group.serials.join(', ')}`)}</p>`)
      .join('') +
    '</section>'
  );
}

function marginBoxes(template: DocumentTemplate): string {
  const pageLabel = `${cssText(template.pageLabel.before)} counter(page)${cssText(
    template.pageLabel.between,
  )} counter(pages)`;
  const documentLabel = cssText(template.generatedOn);
  // The mirrored page keeps the instruction nearest the reader's start edge.
  const startBox = template.direction === 'rtl' ? '@bottom-right' : '@bottom-left';
  const endBox = template.direction === 'rtl' ? '@bottom-left' : '@bottom-right';

  return `
@page {
  size: ${PAGE_WIDTH_PT}pt ${PAGE_HEIGHT_PT}pt;
  margin: ${HEAD_MARGIN_PT}pt ${SIDE_MARGIN_PT}pt ${FOOT_MARGIN_PT}pt ${SIDE_MARGIN_PT}pt;
  @top-left { content: ${cssText(template.heading.organizationName)}; direction: ${template.direction}; vertical-align: bottom; padding-bottom: 9pt; font: 700 9.5pt '${FONT_FAMILY}'; color: ${INK}; }
  @top-right { content: ${cssText(template.identity)}; direction: ${template.direction}; vertical-align: bottom; padding-bottom: 9pt; font: 400 8.5pt '${FONT_FAMILY}'; color: ${MUTED}; }
  ${startBox} { content: ${documentLabel}; direction: ${template.direction}; vertical-align: top; padding-top: 9pt; font: 400 7.5pt '${FONT_FAMILY}'; color: ${MUTED}; }
  ${endBox} { content: ${pageLabel}; direction: ${template.direction}; vertical-align: top; padding-top: 9pt; font: 400 7.5pt '${FONT_FAMILY}'; color: ${MUTED}; }
}
@page :first {
  @top-left { content: none; }
  @top-right { content: none; }
}`;
}

function styleSheet(template: DocumentTemplate): string {
  return `${marginBoxes(template)}

* { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
html, body { margin: 0; padding: 0; }
body {
  font-family: '${FONT_FAMILY}';
  font-size: 8.5pt;
  line-height: 11.5pt;
  color: ${INK};
  font-variant-numeric: tabular-nums;
}
h3 { margin: 0; font-size: 7.5pt; line-height: 10pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: ${MUTED}; }
p { margin: 0; }
.iso { unicode-bidi: isolate; direction: ltr; }
.start { text-align: start; }
.end { text-align: end; }

.doc { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 18pt; border-bottom: .7pt solid ${RULE}; margin-bottom: 22pt; }
.doc-side { display: flex; align-items: flex-start; }
.doc-logo { width: 44pt; height: 30pt; object-fit: contain; margin-inline-end: 12pt; flex: none; }
.org { font-size: 15pt; line-height: 19pt; font-weight: 700; }
.sub { font-size: 8pt; line-height: 11pt; color: ${MUTED}; }
.doc-id { text-align: end; }
.doc-id .title { font-size: 17pt; line-height: 21pt; font-weight: 700; }
.doc-id .number { font-size: 10pt; line-height: 13pt; color: ${MUTED}; }

.parties { display: flex; gap: 24pt; margin-bottom: 18pt; }
.party { flex: 1 1 0; min-width: 0; }
.party-name { margin-top: 4pt; font-size: 9.5pt; line-height: 13pt; font-weight: 700; }
.party-line { font-size: 8pt; line-height: 10.5pt; color: ${MUTED}; overflow-wrap: anywhere; }

.meta { display: flex; margin-bottom: 18pt; }
.meta > div { flex: 1 1 0; min-width: 0; padding-inline-end: 10pt; }
.meta h3 { font-size: 7pt; }
.meta p { font-size: 9pt; line-height: 13pt; overflow-wrap: anywhere; }

table.lines { width: 100%; table-layout: fixed; border-collapse: collapse; }
table.lines tr { break-inside: avoid; }
table.lines th, table.lines td { padding: 0 6pt; height: 20pt; font-size: 8.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
table.lines td.wrap { white-space: normal; overflow-wrap: anywhere; line-height: 10.5pt; }
table.lines th { background: ${FILL}; font-weight: 700; color: ${MUTED}; text-transform: uppercase; letter-spacing: .03em; padding: 5pt 6pt; height: auto; white-space: normal; line-height: 9pt; }
table.lines td { border-bottom: .4pt solid ${RULE}; }
table.lines tbody tr:last-child td { border-bottom: 0; }
table.lines td.empty { color: ${MUTED}; }

.totals { width: 248pt; margin-inline-start: auto; margin-top: 6pt; padding-top: 8pt; border-top: .7pt solid ${RULE}; break-inside: avoid; }
.totals table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.totals td { padding: 0; height: 15pt; font-size: 8.5pt; color: ${MUTED}; white-space: nowrap; }
.totals td.label { text-align: end; padding-inline-end: 8pt; overflow: hidden; text-overflow: ellipsis; }
.totals td.value { width: 96pt; text-align: end; color: ${INK}; font-size: 9pt; }
.totals tr.strong td { height: 18pt; border-top: .7pt solid ${RULE}; font-weight: 700; color: ${INK}; }
.totals tr.strong td.value { font-size: 10.5pt; }
.totals-caption { margin-top: 4pt; font-size: 7.5pt; line-height: 10pt; color: ${MUTED}; }

.payments, .note, .serials { margin-top: 14pt; break-inside: avoid; }
.payments table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.payments td { padding: 0; height: 15pt; vertical-align: baseline; }
.payments .amount { width: 96pt; text-align: end; font-size: 9pt; color: ${INK}; }
.payments .detail { margin-inline-start: 8pt; font-size: 7.5pt; color: ${MUTED}; overflow-wrap: anywhere; }
.note p { margin-top: 3pt; }
.serials p { font-size: 8pt; line-height: 10.5pt; }

.footer-rule { position: fixed; left: 0; right: 0; bottom: 0; border-top: .7pt solid ${RULE}; }
.watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 84pt; line-height: 84pt; font-weight: 700; color: ${WATERMARK}; opacity: .22; transform: rotate(-35deg); white-space: nowrap; pointer-events: none; }
`;
}

/** The full HTML document a browser prints, with the bundled faces inlined. */
export async function renderDocumentHtml(
  template: DocumentTemplate,
  logo: StoredLogo | null,
): Promise<string> {
  const fontCss = await documentFontCss();
  const mark = logoDataUri(logo);

  return `<!doctype html>
<html lang="${template.locale}" dir="${template.direction}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(template.identity)}</title>
<style>
${fontCss}
${styleSheet(template)}
</style>
</head>
<body>
${template.watermark ? `<div class="watermark">${escapeHtml(template.watermark)}</div>` : ''}
<div class="footer-rule"></div>
<header class="doc">
<div class="doc-side">${mark ? `<img class="doc-logo" src="${mark}" alt="">` : ''}
<div><p class="org">${escapeHtml(template.heading.organizationName)}</p><p class="sub">${escapeHtml(
    template.subtitle,
  )}</p></div>
</div>
<div class="doc-id"><p class="title">${escapeHtml(template.heading.title)}</p><p class="number">${escapeHtml(
    template.heading.number,
  )}${template.statusLabel ? `&nbsp;&nbsp;${escapeHtml(template.statusLabel)}` : ''}</p></div>
</header>
<section class="parties">${partyBlock(template, template.parties.left)}${partyBlock(
    template,
    template.parties.right,
  )}</section>
${metaBlock(template)}
${tableBlock(template)}
${totalsBlock(template)}
${paymentsBlock(template)}
${noteBlock(template)}
${serialsBlock(template)}
</body>
</html>`;
}
