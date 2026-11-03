/**
 * Presentational model for the two documents a counter sale produces: the
 * invoice the customer is billed with, and the goods issue note the depot gates
 * on. Both are the same table document with a different column set and a
 * different totals block, so the renderer only has to choose between them.
 * Amounts are integer millimes and every number here is read back from the
 * database, never from the browser.
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
  statusLabel: string;
  watermark: 'DRAFT' | 'CANCELLED' | null;
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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card_manual: 'Card (manual entry)',
  credit: 'On account',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Reserved',
  fulfilled: 'Issued',
  cancelled: 'Cancelled',
};

function moneyMinor(minor: number): string {
  return `${formatMillimesAscii(minor)} TND`;
}

function partyForCustomer(customer: CustomerDocumentInfo): DocumentParty {
  const cityLine = [customer.city, customer.countryCode].filter(Boolean).join(', ');
  return {
    name: customer.name,
    details: [
      customer.addressLine,
      cityLine || null,
      customer.email,
      customer.phone,
      customer.taxId ? `Tax ID: ${customer.taxId}` : null,
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
  const { invoice } = input;
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
    { label: 'Total excl. tax', value: moneyMinor(invoice.netAmountMinor) },
    { label: 'Tax', value: moneyMinor(invoice.taxAmountMinor) },
    { label: 'Total incl. tax', value: moneyMinor(invoice.totalAmountMinor), strong: true },
    { label: 'Paid', value: moneyMinor(invoice.paidAmountMinor) },
    {
      label: 'Remaining',
      value: moneyMinor(invoice.remainingAmountMinor),
      strong: invoice.remainingAmountMinor > 0,
    },
    {
      label: 'Payment method',
      value: invoice.paymentMethod
        ? (PAYMENT_METHOD_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod)
        : '-',
    },
  ];

  return {
    title: 'Invoice',
    number: invoice.number,
    statusLabel: PAYMENT_STATUS_LABELS[invoice.paymentStatus] ?? invoice.paymentStatus,
    watermark: null,
    organizationName: input.organizationName,
    customer: partyForCustomer(invoice.customer),
    depot: {
      name: `${invoice.warehouseCode} / ${invoice.locationCode}`,
      details: [
        invoice.warehouseName,
        invoice.locationName,
        'Goods leave this location. Quote the invoice number on all documents.',
      ],
    },
    meta: [
      { label: 'Issue date', value: dateOnly(invoice.issuedAt) },
      { label: 'Exit document', value: invoice.salesOrderNumber ?? '-' },
      { label: 'Reference', value: invoice.reference ?? '-' },
      { label: 'Sold by', value: invoice.createdByEmail ?? '-' },
    ],
    columns: 'invoice',
    lines,
    totals,
    payments: input.payments.map((payment) => ({
      methodLabel: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
      amountMinor: payment.amountMinor,
      detail: payment.note ?? payment.recordedByEmail ?? dateOnly(payment.recordedAt),
    })),
    note: invoice.notes ? { title: 'Notes', body: invoice.notes } : null,
    serials: buildSerials(lines),
    fileName: `nexora-${sanitizeFileName(invoice.number)}.pdf`,
  };
}

export interface IssueNoteDocumentInput {
  organizationName: string;
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
  const { invoice } = input;
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
    { label: 'Lines', value: String(lines.length) },
    { label: 'Total quantity', value: formatQuantityAscii(totalQuantity(lines)), strong: true },
  ];

  const standardNote =
    'Every quantity on this note has left the depot. ' +
    `This note is not a tax document: invoice ${invoice.number} carries the amounts.`;
  const body = invoice.notes?.trim() ? `${invoice.notes.trim()} ${standardNote}` : standardNote;

  return {
    title: 'Goods issue note',
    number: invoice.salesOrderNumber ?? invoice.number,
    statusLabel: ORDER_STATUS_LABELS[invoice.orderStatus ?? 'fulfilled'] ?? 'Issued',
    watermark: invoice.orderStatus === 'cancelled' ? 'CANCELLED' : null,
    organizationName: input.organizationName,
    customer: partyForCustomer(invoice.customer),
    depot: {
      name: `${invoice.warehouseCode} / ${invoice.locationCode}`,
      details: [invoice.warehouseName, invoice.locationName],
    },
    meta: [
      { label: 'Issue date', value: dateOnly(invoice.issuedAt) },
      { label: 'Invoice', value: invoice.number },
      { label: 'Reference', value: invoice.reference ?? '-' },
      { label: 'Released by', value: invoice.createdByEmail ?? '-' },
    ],
    columns: 'issue',
    lines,
    totals,
    payments: [],
    note: { title: 'Notes', body },
    serials: buildSerials(lines),
    fileName: `nexora-${sanitizeFileName(invoice.salesOrderNumber ?? invoice.number)}-issue-note.pdf`,
  };
}
