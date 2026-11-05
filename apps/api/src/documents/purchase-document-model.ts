/**
 * Presentational model for the purchase documents. Everything here is pure:
 * rows come in as plain values, and the renderer only draws what the model
 * says. Amounts are integer millimes; a line amount is rounded once and the
 * document total is the sum of the rounded line amounts.
 *
 * Every printed word comes from `DocumentStrings` (ADR-0019 decision 3), so the same model
 * builds an English, French or Arabic document and the template never holds a literal.
 */

import {
  type DocumentHeading,
  type DocumentMeta,
  type DocumentNote,
  type DocumentParty,
  dateOnly,
  roundQuantity,
  sanitizeFileName,
} from './document-format';
import {
  type DocumentStrings,
  type PurchaseOrderStatus,
  type PurchaseReturnStatus,
  pickLabel,
} from './document-catalog';

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

export interface PurchaseDocument extends DocumentHeading {
  kind: 'purchase_order' | 'purchase_return';
  /** The catalog the document was built from; the template reads its labels from here. */
  strings: DocumentStrings;
  statusLabel: string;
  watermark: string | null;
  supplier: DocumentParty;
  shipTo: DocumentParty;
  meta: DocumentMeta[];
  lines: PurchaseDocumentLine[];
  totals: PurchaseDocumentTotals;
  note: DocumentNote | null;
  serials: { sku: string; serials: string[] }[];
  fileName: string;
}

function partyForSupplier(supplier: SupplierDocumentInfo, strings: DocumentStrings): DocumentParty {
  const cityLine = [supplier.city, supplier.countryCode].filter(Boolean).join(', ');
  return {
    name: supplier.name,
    details: [
      supplier.contactName ? `${strings.partyFields.contact}: ${supplier.contactName}` : null,
      supplier.addressLine,
      cityLine || null,
      supplier.email,
      supplier.phone,
      supplier.taxId ? `${strings.partyFields.taxId}: ${supplier.taxId}` : null,
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

function watermarkFor(status: string, strings: DocumentStrings): string | null {
  if (status === 'draft') return strings.watermarks.draft;
  if (status === 'cancelled') return strings.watermarks.cancelled;
  return null;
}

export interface PurchaseOrderDocumentInput {
  organizationName: string;
  strings: DocumentStrings;
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
  const { order, strings } = input;
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
    strings,
    title: strings.titles.purchaseOrder,
    number: order.number,
    statusLabel: pickLabel(strings.statuses.purchaseOrder, order.status as PurchaseOrderStatus),
    watermark: watermarkFor(order.status, strings),
    organizationName: input.organizationName,
    supplier: partyForSupplier(order.supplier, strings),
    shipTo: {
      name: `${order.warehouseCode} / ${order.locationCode}`,
      details: [order.warehouseName, order.locationName, strings.instructions.deliverTo],
    },
    meta: [
      { label: strings.meta.orderDate, value: dateOnly(order.orderedAt ?? order.createdAt) },
      { label: strings.meta.expected, value: order.expectedOn ?? '-' },
      { label: strings.meta.reference, value: order.reference ?? '-' },
    ],
    lines,
    totals: buildTotals(lines),
    note: order.notes ? { title: strings.notes.title, body: order.notes } : null,
    serials: [],
    fileName: `nexora-${sanitizeFileName(order.number)}.pdf`,
  };
}

export interface PurchaseReturnDocumentInput {
  organizationName: string;
  strings: DocumentStrings;
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
  const { strings } = input;
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
    strings,
    title: strings.titles.purchaseReturnNote,
    number: purchaseReturn.number,
    statusLabel: pickLabel(
      strings.statuses.purchaseReturn,
      purchaseReturn.status as PurchaseReturnStatus,
    ),
    watermark: watermarkFor(purchaseReturn.status, strings),
    organizationName: input.organizationName,
    supplier: partyForSupplier(purchaseReturn.supplier, strings),
    shipTo: {
      name: `${purchaseReturn.warehouseCode} / ${purchaseReturn.locationCode}`,
      details: [purchaseReturn.warehouseName, purchaseReturn.locationName],
    },
    meta: [
      {
        label: strings.meta.returnDate,
        value: dateOnly(purchaseReturn.postedAt ?? purchaseReturn.createdAt),
      },
      { label: strings.meta.sourceOrder, value: purchaseReturn.purchaseOrderNumber },
      { label: strings.meta.reference, value: purchaseReturn.reference ?? '-' },
    ],
    lines,
    totals: buildTotals(lines),
    note: { title: strings.notes.returnReason, body: purchaseReturn.reason },
    serials: buildSerials(lines),
    fileName: `nexora-${sanitizeFileName(purchaseReturn.number)}.pdf`,
  };
}
