/**
 * Presentational model for the purchase documents. Everything here is pure:
 * rows come in as plain values, and the renderer only draws what the model
 * says. Amounts are integer millimes; a line amount is rounded once and the
 * document total is the sum of the rounded line amounts.
 */

export interface SupplierDocumentInfo {
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  countryCode: string | null;
  taxId: string | null;
}

export interface DocumentParty {
  name: string;
  details: string[];
}

export interface PurchaseDocumentMeta {
  label: string;
  value: string;
}

export interface PurchaseDocumentLine {
  sku: string;
  description: string;
  quantity: number;
  unitCostMinor: number | null;
  amountMinor: number | null;
  serials: string[];
}

export interface PurchaseDocumentTotals {
  lineCount: number;
  quantity: number;
  pricedLines: number;
  missingCostLines: number;
  knownValueMinor: number;
}

export interface PurchaseDocumentNote {
  title: string;
  body: string;
}

export interface PurchaseDocument {
  kind: 'purchase_order' | 'purchase_return';
  title: string;
  number: string;
  statusLabel: string;
  watermark: 'DRAFT' | 'CANCELLED' | null;
  organizationName: string;
  supplier: DocumentParty;
  shipTo: DocumentParty;
  meta: PurchaseDocumentMeta[];
  lines: PurchaseDocumentLine[];
  totals: PurchaseDocumentTotals;
  note: PurchaseDocumentNote | null;
  serials: { sku: string; serials: string[] }[];
  fileName: string;
}

const PURCHASE_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partially_received: 'Partially received',
  received: 'Received',
  cancelled: 'Cancelled',
};

const RETURN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  posted: 'Posted',
  cancelled: 'Cancelled',
};

export function formatMillimesAscii(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(minor));
  const dinars = Math.floor(absolute / 1000)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const millimes = (absolute % 1000).toString().padStart(3, '0');
  return `${sign}${dinars}.${millimes}`;
}

export function formatQuantityAscii(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity);
  return quantity.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** Standard PDF fonts use WinAnsi, so non-Latin text is transliterated or replaced. */
export function sanitizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[^\x20-\x7e\n]/g, '?');
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '-');
}

function dateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : '-';
}

function roundQuantity(quantity: number): number {
  return Math.round(quantity * 10_000) / 10_000;
}

function partyForSupplier(supplier: SupplierDocumentInfo): DocumentParty {
  const cityLine = [supplier.city, supplier.countryCode].filter(Boolean).join(', ');
  return {
    name: supplier.name,
    details: [
      supplier.contactName ? `Contact: ${supplier.contactName}` : null,
      supplier.addressLine,
      cityLine || null,
      supplier.email,
      supplier.phone,
      supplier.taxId ? `Tax ID: ${supplier.taxId}` : null,
    ].filter((detail): detail is string => Boolean(detail)),
  };
}

function buildTotals(lines: PurchaseDocumentLine[]): PurchaseDocumentTotals {
  let quantity = 0;
  let pricedLines = 0;
  let missingCostLines = 0;
  let knownValueMinor = 0;

  for (const line of lines) {
    quantity += line.quantity;
    if (line.amountMinor === null) {
      missingCostLines += 1;
      continue;
    }
    pricedLines += 1;
    knownValueMinor += line.amountMinor;
  }

  return {
    lineCount: lines.length,
    quantity: roundQuantity(quantity),
    pricedLines,
    missingCostLines,
    knownValueMinor,
  };
}

function buildSerials(lines: PurchaseDocumentLine[]): { sku: string; serials: string[] }[] {
  return lines
    .filter((line) => line.serials.length > 0)
    .map((line) => ({ sku: line.sku, serials: line.serials }));
}

export interface PurchaseOrderDocumentInput {
  organizationName: string;
  order: {
    number: string;
    status: string;
    reference: string | null;
    notes: string | null;
    expectedOn: string | null;
    orderedAt: string | null;
    createdAt: string;
    warehouseCode: string;
    warehouseName: string;
    locationCode: string;
    locationName: string;
    supplier: SupplierDocumentInfo;
  };
  lines: {
    productSku: string;
    productName: string;
    quantityOrdered: number;
    unitCostMinor: number | null;
  }[];
}

export function buildPurchaseOrderDocument(input: PurchaseOrderDocumentInput): PurchaseDocument {
  const { order } = input;
  const lines: PurchaseDocumentLine[] = input.lines.map((line) => ({
    sku: line.productSku,
    description: line.productName,
    quantity: line.quantityOrdered,
    unitCostMinor: line.unitCostMinor,
    amountMinor:
      line.unitCostMinor === null ? null : Math.round(line.quantityOrdered * line.unitCostMinor),
    serials: [],
  }));

  return {
    kind: 'purchase_order',
    title: 'Purchase order',
    number: order.number,
    statusLabel: PURCHASE_ORDER_STATUS_LABELS[order.status] ?? order.status,
    watermark:
      order.status === 'draft' ? 'DRAFT' : order.status === 'cancelled' ? 'CANCELLED' : null,
    organizationName: input.organizationName,
    supplier: partyForSupplier(order.supplier),
    shipTo: {
      name: `${order.warehouseCode} / ${order.locationCode}`,
      details: [
        order.warehouseName,
        order.locationName,
        'Deliver to this location. Quote the purchase order number on all documents.',
      ],
    },
    meta: [
      { label: 'Order date', value: dateOnly(order.orderedAt ?? order.createdAt) },
      { label: 'Expected', value: order.expectedOn ?? '-' },
      { label: 'Reference', value: order.reference ?? '-' },
    ],
    lines,
    totals: buildTotals(lines),
    note: order.notes ? { title: 'Notes', body: order.notes } : null,
    serials: [],
    fileName: `nexora-${sanitizeFileName(order.number)}.pdf`,
  };
}

export interface PurchaseReturnDocumentInput {
  organizationName: string;
  purchaseReturn: {
    number: string;
    status: string;
    reason: string;
    reference: string | null;
    postedAt: string | null;
    createdAt: string;
    purchaseOrderNumber: string;
    warehouseCode: string;
    warehouseName: string;
    locationCode: string;
    locationName: string;
    supplier: SupplierDocumentInfo;
  };
  lines: {
    productSku: string;
    productName: string;
    quantity: number;
    unitCostMinor: number | null;
    serials: string[];
  }[];
}

export function buildPurchaseReturnDocument(input: PurchaseReturnDocumentInput): PurchaseDocument {
  const purchaseReturn = input.purchaseReturn;
  const lines: PurchaseDocumentLine[] = input.lines.map((line) => ({
    sku: line.productSku,
    description: line.productName,
    quantity: line.quantity,
    unitCostMinor: line.unitCostMinor,
    amountMinor:
      line.unitCostMinor === null ? null : Math.round(line.quantity * line.unitCostMinor),
    serials: [...line.serials].sort(),
  }));

  return {
    kind: 'purchase_return',
    title: 'Purchase return note',
    number: purchaseReturn.number,
    statusLabel: RETURN_STATUS_LABELS[purchaseReturn.status] ?? purchaseReturn.status,
    watermark:
      purchaseReturn.status === 'draft'
        ? 'DRAFT'
        : purchaseReturn.status === 'cancelled'
          ? 'CANCELLED'
          : null,
    organizationName: input.organizationName,
    supplier: partyForSupplier(purchaseReturn.supplier),
    shipTo: {
      name: `${purchaseReturn.warehouseCode} / ${purchaseReturn.locationCode}`,
      details: [purchaseReturn.warehouseName, purchaseReturn.locationName],
    },
    meta: [
      {
        label: 'Return date',
        value: dateOnly(purchaseReturn.postedAt ?? purchaseReturn.createdAt),
      },
      { label: 'Source order', value: purchaseReturn.purchaseOrderNumber },
      { label: 'Reference', value: purchaseReturn.reference ?? '-' },
    ],
    lines,
    totals: buildTotals(lines),
    note: { title: 'Return reason', body: purchaseReturn.reason },
    serials: buildSerials(lines),
    fileName: `nexora-${sanitizeFileName(purchaseReturn.number)}.pdf`,
  };
}
