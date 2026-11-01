import { describe, expect, it } from 'vitest';

import {
  buildPurchaseOrderDocument,
  buildPurchaseReturnDocument,
  formatMillimesAscii,
  formatQuantityAscii,
  sanitizeText,
  type SupplierDocumentInfo,
} from '../../src/documents/purchase-document-model';

const supplier: SupplierDocumentInfo = {
  name: 'Atlas Components',
  contactName: 'Samir Trabelsi',
  email: 'orders@atlas.example',
  phone: '+216 71 000 000',
  addressLine: '12 Rue du Lac',
  city: 'Tunis',
  countryCode: 'TN',
  taxId: 'TN1234567',
};

function orderInput() {
  return {
    organizationName: 'Org A',
    order: {
      number: 'PO-2026-0001',
      status: 'draft',
      reference: 'SUP-77',
      notes: 'Deliver before noon.',
      expectedOn: '2026-11-15',
      orderedAt: null,
      createdAt: '2026-10-31T09:30:00.000Z',
      warehouseCode: 'MAIN',
      warehouseName: 'Main warehouse',
      locationCode: 'A-01',
      locationName: 'Aisle A shelf 01',
      supplier,
    },
    lines: [
      {
        productSku: 'CABLE-USB-C',
        productName: 'USB-C cable 2m',
        quantityOrdered: 2,
        unitCostMinor: 4500,
      },
      {
        productSku: 'IPHONE-15',
        productName: 'iPhone 15 128GB',
        quantityOrdered: 1.5,
        unitCostMinor: 1200,
      },
      {
        productSku: 'SPARE-01',
        productName: 'Spare part',
        quantityOrdered: 1,
        unitCostMinor: null,
      },
    ],
  };
}

describe('purchase document model', () => {
  it('builds a purchase order with rounded line amounts and integer totals', () => {
    const document = buildPurchaseOrderDocument(orderInput());

    expect(document.kind).toBe('purchase_order');
    expect(document.title).toBe('Purchase order');
    expect(document.number).toBe('PO-2026-0001');
    expect(document.statusLabel).toBe('Draft');
    expect(document.watermark).toBe('DRAFT');
    expect(document.fileName).toBe('nexora-PO-2026-0001.pdf');
    expect(document.meta).toEqual([
      { label: 'Order date', value: '2026-10-31' },
      { label: 'Expected', value: '2026-11-15' },
      { label: 'Reference', value: 'SUP-77' },
    ]);

    expect(document.lines.map((line) => line.amountMinor)).toEqual([9000, 1800, null]);
    expect(document.totals).toEqual({
      lineCount: 3,
      quantity: 4.5,
      pricedLines: 2,
      missingCostLines: 1,
      knownValueMinor: 10_800,
    });

    expect(document.supplier.name).toBe('Atlas Components');
    expect(document.supplier.details).toContain('Tax ID: TN1234567');
    expect(document.shipTo.details[0]).toBe('Main warehouse');
    expect(document.note).toEqual({ title: 'Notes', body: 'Deliver before noon.' });
    expect(document.serials).toEqual([]);
  });

  it('marks ordered and cancelled purchase orders without a draft watermark', () => {
    const ordered = buildPurchaseOrderDocument({
      ...orderInput(),
      order: { ...orderInput().order, status: 'partially_received' },
    });
    expect(ordered.watermark).toBeNull();
    expect(ordered.statusLabel).toBe('Partially received');

    const cancelled = buildPurchaseOrderDocument({
      ...orderInput(),
      order: { ...orderInput().order, status: 'cancelled' },
    });
    expect(cancelled.watermark).toBe('CANCELLED');
  });

  it('builds a posted return note with the source order, reason, and sorted serials', () => {
    const document = buildPurchaseReturnDocument({
      organizationName: 'Org A',
      purchaseReturn: {
        number: 'PR-2026-0001',
        status: 'posted',
        reason: 'Damaged in transit',
        reference: 'HOSTED-PR',
        postedAt: '2026-10-31T12:00:00.000Z',
        createdAt: '2026-10-31T11:00:00.000Z',
        purchaseOrderNumber: 'PO-2026-0001',
        warehouseCode: 'MAIN',
        warehouseName: 'Main warehouse',
        locationCode: 'A-01',
        locationName: 'Aisle A shelf 01',
        supplier,
      },
      lines: [
        {
          productSku: 'IPHONE-15',
          productName: 'iPhone 15 128GB',
          quantity: 2,
          unitCostMinor: 3_150_000,
          serials: ['SN-B', 'SN-A'],
        },
      ],
    });

    expect(document.kind).toBe('purchase_return');
    expect(document.title).toBe('Purchase return note');
    expect(document.watermark).toBeNull();
    expect(document.statusLabel).toBe('Posted');
    expect(document.fileName).toBe('nexora-PR-2026-0001.pdf');
    expect(document.meta).toEqual([
      { label: 'Return date', value: '2026-10-31' },
      { label: 'Source order', value: 'PO-2026-0001' },
      { label: 'Reference', value: 'HOSTED-PR' },
    ]);
    expect(document.note).toEqual({ title: 'Return reason', body: 'Damaged in transit' });
    expect(document.lines[0]?.amountMinor).toBe(6_300_000);
    expect(document.totals.knownValueMinor).toBe(6_300_000);
    expect(document.serials).toEqual([{ sku: 'IPHONE-15', serials: ['SN-A', 'SN-B'] }]);
  });

  it('formats millimes, quantities, and non-Latin text for standard PDF fonts', () => {
    expect(formatMillimesAscii(0)).toBe('0.000');
    expect(formatMillimesAscii(999)).toBe('0.999');
    expect(formatMillimesAscii(1_234_567)).toBe('1,234.567');
    expect(formatMillimesAscii(-1234)).toBe('-1.234');

    expect(formatQuantityAscii(2)).toBe('2');
    expect(formatQuantityAscii(1.5)).toBe('1.5');
    expect(formatQuantityAscii(0.0001)).toBe('0.0001');
    expect(formatQuantityAscii(12.3456)).toBe('12.3456');

    expect(sanitizeText('Café – “écran”…')).toBe('Cafe - "ecran"...');
    expect(sanitizeText('Tunis\u00a0TND')).toBe('Tunis TND');
    expect(sanitizeText('مخزون')).toBe('?????');
  });
});
