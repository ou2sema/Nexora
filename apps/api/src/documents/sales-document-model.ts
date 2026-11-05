/**
 * Presentational model for the two documents a counter sale produces: the
 * invoice the customer is billed with, and the goods issue note the depot gates
 * on. Both are the same table document with a different column set and a
 * different totals block, so the renderer only has to choose between them.
 * Amounts are integer millimes and every number here is read back from the
 * database, never from the browser.
 *
 * The words belong to the caller: `strings` (ADR-0019 decision 3) decides whether this model
 * describes an English, French or Arabic document, while the numbers stay in the ASCII
 * form the ledger holds and the template keeps them left-to-right.
 */

import {
  type DocumentHeading,
  type DocumentMeta,
  type DocumentNote,
  type DocumentParty,
  type DocumentTotalRow,
  dateOnly,
  formatMillimesAscii,
  formatQuantityAscii,
  roundQuantity,
  sanitizeFileName,
} from './document-format';
import {
  type DocumentStrings,
  type PaymentMethod,
  type PaymentStatus,
  type SalesOrderStatus,
  pickLabel,
} from './document-catalog';

export interface SalesDocumentLine {
  sku: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxRatePercent: number;
  netAmountMinor: number;
  taxAmountMinor: number;
  serial: string | null;
}

export interface SalesDocumentPayment {
  methodLabel: string;
  amountMinor: number;
  detail: string | null;
}

export interface SalesDocument extends DocumentHeading {
  /** The catalog the document was built from; the template reads its labels from here. */
  strings: DocumentStrings;
  statusLabel: string;
  watermark: string | null;
  customer: DocumentParty;
  depot: DocumentParty;
  meta: DocumentMeta[];
  columns: 'invoice' | 'issue';
  lines: SalesDocumentLine[];
  totals: DocumentTotalRow[];
  payments: SalesDocumentPayment[];
  note: DocumentNote | null;
  serials: { sku: string; serials: string[] }[];
  fileName: string;
}

export interface CustomerDocumentInfo {
  name: string;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  countryCode: string | null;
  taxId: string | null;
}

function moneyMinor(minor: number): string {
  return `${formatMillimesAscii(minor)} TND`;
}

function partyForCustomer(customer: CustomerDocumentInfo, strings: DocumentStrings): DocumentParty {
  const cityLine = [customer.city, customer.countryCode].filter(Boolean).join(', ');
  return {
    name: customer.name,
    details: [
      customer.addressLine,
      cityLine || null,
      customer.email,
      customer.phone,
      customer.taxId ? `${strings.partyFields.taxId}: ${customer.taxId}` : null,
    ].filter((detail): detail is string => Boolean(detail)),
  };
}

function buildSerials(lines: SalesDocumentLine[]): { sku: string; serials: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const line of lines) {
    if (!line.serial) continue;
    const existing = groups.get(line.sku);
    if (existing) existing.push(line.serial);
    else groups.set(line.sku, [line.serial]);
  }

  return [...groups].map(([sku, serials]) => ({ sku, serials: serials.sort() }));
}

function totalQuantity(lines: SalesDocumentLine[]): number {
  return roundQuantity(lines.reduce((sum, line) => sum + line.quantity, 0));
}

export interface SalesInvoiceDocumentInput {
  organizationName: string;
  strings: DocumentStrings;
  invoice: {
    number: string;
    paymentStatus: string;
    paymentMethod: string | null;
    issuedAt: string;
    salesOrderNumber: string | null;
    reference: string | null;
    notes: string | null;
    netAmountMinor: number;
    taxAmountMinor: number;
    totalAmountMinor: number;
    paidAmountMinor: number;
    remainingAmountMinor: number;
    createdByEmail: string | null;
    warehouseCode: string;
    warehouseName: string;
    locationCode: string;
    locationName: string;
    customer: CustomerDocumentInfo;
  };
  lines: {
    productSku: string;
    productName: string;
    quantity: number;
    unitPriceMinor: number;
    taxRatePercent: number;
    netAmountMinor: number;
    taxAmountMinor: number;
    serialNumber: string | null;
  }[];
  payments: {
    amountMinor: number;
    method: string;
    note: string | null;
    recordedByEmail: string | null;
    recordedAt: string;
  }[];
}

export function buildSalesInvoiceDocument(input: SalesInvoiceDocumentInput): SalesDocument {
  const { invoice, strings } = input;
  const lines: SalesDocumentLine[] = input.lines.map((line) => ({
    sku: line.productSku,
    description: line.productName,
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor,
    taxRatePercent: line.taxRatePercent,
    netAmountMinor: line.netAmountMinor,
    taxAmountMinor: line.taxAmountMinor,
    serial: line.serialNumber,
  }));

  const totals: DocumentTotalRow[] = [
    { label: strings.totals.totalExclTax, value: moneyMinor(invoice.netAmountMinor) },
    { label: strings.totals.tax, value: moneyMinor(invoice.taxAmountMinor) },
    {
      label: strings.totals.totalInclTax,
      value: moneyMinor(invoice.totalAmountMinor),
      strong: true,
    },
    { label: strings.totals.paid, value: moneyMinor(invoice.paidAmountMinor) },
    {
      label: strings.totals.remaining,
      value: moneyMinor(invoice.remainingAmountMinor),
      strong: invoice.remainingAmountMinor > 0,
    },
    {
      label: strings.totals.paymentMethod,
      value: invoice.paymentMethod
        ? pickLabel(strings.statuses.paymentMethod, invoice.paymentMethod as PaymentMethod)
        : '-',
    },
  ];

  return {
    strings,
    title: strings.titles.invoice,
    number: invoice.number,
    statusLabel: pickLabel(strings.statuses.payment, invoice.paymentStatus as PaymentStatus),
    watermark: null,
    organizationName: input.organizationName,
    customer: partyForCustomer(invoice.customer, strings),
    depot: {
      name: `${invoice.warehouseCode} / ${invoice.locationCode}`,
      details: [invoice.warehouseName, invoice.locationName, strings.instructions.goodsLeaveFrom],
    },
    meta: [
      { label: strings.meta.issueDate, value: dateOnly(invoice.issuedAt) },
      { label: strings.meta.exitDocument, value: invoice.salesOrderNumber ?? '-' },
      { label: strings.meta.reference, value: invoice.reference ?? '-' },
      { label: strings.meta.soldBy, value: invoice.createdByEmail ?? '-' },
    ],
    columns: 'invoice',
    lines,
    totals,
    payments: input.payments.map((payment) => ({
      methodLabel: pickLabel(strings.statuses.paymentMethod, payment.method as PaymentMethod),
      amountMinor: payment.amountMinor,
      detail: payment.note ?? payment.recordedByEmail ?? dateOnly(payment.recordedAt),
    })),
    note: invoice.notes ? { title: strings.notes.title, body: invoice.notes } : null,
    serials: buildSerials(lines),
    fileName: `nexora-${sanitizeFileName(invoice.number)}.pdf`,
  };
}

export interface IssueNoteDocumentInput {
  organizationName: string;
  strings: DocumentStrings;
  invoice: {
    number: string;
    orderStatus: string | null;
    issuedAt: string;
    salesOrderNumber: string | null;
    reference: string | null;
    notes: string | null;
    createdByEmail: string | null;
    warehouseCode: string;
    warehouseName: string;
    locationCode: string;
    locationName: string;
    customer: CustomerDocumentInfo;
  };
  lines: SalesInvoiceDocumentInput['lines'];
}

export function buildIssueNoteDocument(input: IssueNoteDocumentInput): SalesDocument {
  const { invoice, strings } = input;
  const lines: SalesDocumentLine[] = input.lines.map((line) => ({
    sku: line.productSku,
    description: line.productName,
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor,
    taxRatePercent: line.taxRatePercent,
    netAmountMinor: line.netAmountMinor,
    taxAmountMinor: line.taxAmountMinor,
    serial: line.serialNumber,
  }));

  const totals: DocumentTotalRow[] = [
    { label: strings.totals.lines, value: String(lines.length) },
    {
      label: strings.totals.totalQuantity,
      value: formatQuantityAscii(totalQuantity(lines)),
      strong: true,
    },
  ];

  const standardNote = strings.instructions.issueNoteStandard(invoice.number);
  const body = invoice.notes?.trim() ? `${invoice.notes.trim()} ${standardNote}` : standardNote;

  return {
    strings,
    title: strings.titles.goodsIssueNote,
    number: invoice.salesOrderNumber ?? invoice.number,
    statusLabel: pickLabel(
      strings.statuses.salesOrder,
      (invoice.orderStatus ?? 'fulfilled') as SalesOrderStatus,
    ),
    watermark: invoice.orderStatus === 'cancelled' ? strings.watermarks.cancelled : null,
    organizationName: input.organizationName,
    customer: partyForCustomer(invoice.customer, strings),
    depot: {
      name: `${invoice.warehouseCode} / ${invoice.locationCode}`,
      details: [invoice.warehouseName, invoice.locationName],
    },
    meta: [
      { label: strings.meta.issueDate, value: dateOnly(invoice.issuedAt) },
      { label: strings.meta.invoice, value: invoice.number },
      { label: strings.meta.reference, value: invoice.reference ?? '-' },
      { label: strings.meta.releasedBy, value: invoice.createdByEmail ?? '-' },
    ],
    columns: 'issue',
    lines,
    totals,
    payments: [],
    note: { title: strings.notes.title, body },
    serials: buildSerials(lines),
    fileName: `nexora-${sanitizeFileName(invoice.salesOrderNumber ?? invoice.number)}-issue-note.pdf`,
  };
}
