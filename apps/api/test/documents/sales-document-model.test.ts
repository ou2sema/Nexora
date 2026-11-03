import { describe, expect, it } from 'vitest';

import {
  type IssueNoteDocumentInput,
  type SalesInvoiceDocumentInput,
  buildIssueNoteDocument,
  buildSalesInvoiceDocument,
} from '../../src/documents/sales-document-model';

const CUSTOMER = {
  name: 'Amel Ben Salem',
  email: 'amel@example.tn',
  phone: '+216 22 111 222',
  addressLine: '5 Avenue Habib Bourguiba',
  city: 'Sfax',
  countryCode: 'TN',
  taxId: 'TN9876543',
};

const WALK_IN = {
  name: 'Walk-in',
  email: null,
  phone: null,
  addressLine: null,
  city: null,
  countryCode: null,
  taxId: null,
};

function invoiceInput(
  overrides: Partial<SalesInvoiceDocumentInput['invoice']> = {},
): SalesInvoiceDocumentInput {
  return {
    organizationName: 'SBS VISION',
    invoice: {
      number: 'FI-2026-0007',
      paymentStatus: 'partial',
      paymentMethod: 'card_manual',
      issuedAt: '2026-11-02T09:15:00.000Z',
      salesOrderNumber: 'SO-2026-0004',
      reference: 'DEVIS-11',
      notes: 'Hand over at the counter.',
      netAmountMinor: 26700,
      taxAmountMinor: 3382,
      totalAmountMinor: 30082,
      paidAmountMinor: 10000,
      remainingAmountMinor: 20082,
      createdByEmail: 'alice@example.com',
      warehouseCode: 'MAIN',
      warehouseName: 'Main depot',
      locationCode: 'A1',
      locationName: 'Shelf A1',
      customer: CUSTOMER,
      ...overrides,
    },
    lines: [
      {
        productSku: 'CABLE-USB-C',
        productName: 'USB-C cable',
        quantity: 3,
        unitPriceMinor: 8900,
        taxRatePercent: 19,
        netAmountMinor: 26700,
        taxAmountMinor: 5073,
        serialNumber: null,
      },
      {
        productSku: 'IPHONE-15',
        productName: 'iPhone 15',
        quantity: 1,
        unitPriceMinor: 3690000,
        taxRatePercent: 0,
        netAmountMinor: 3690000,
        taxAmountMinor: 0,
        serialNumber: 'SN-INVOICE-0001',
      },
    ],
    payments: [
      {
        amountMinor: 10000,
        method: 'card_manual',
        note: 'Terminal slip 4411',
        recordedByEmail: 'alice@example.com',
        recordedAt: '2026-11-02T09:16:00.000Z',
      },
    ],
  };
}

function issueNoteInput(
  overrides: Partial<IssueNoteDocumentInput['invoice']> = {},
): IssueNoteDocumentInput {
  const input = invoiceInput();
  const { invoice } = input;
  return {
    organizationName: 'SBS VISION',
    invoice: {
      number: invoice.number,
      orderStatus: 'fulfilled',
      issuedAt: invoice.issuedAt,
      salesOrderNumber: invoice.salesOrderNumber,
      reference: invoice.reference,
      notes: invoice.notes,
      createdByEmail: invoice.createdByEmail,
      warehouseCode: invoice.warehouseCode,
      warehouseName: invoice.warehouseName,
      locationCode: invoice.locationCode,
      locationName: invoice.locationName,
      customer: invoice.customer,
      ...overrides,
    },
    lines: input.lines,
  };
}

describe('sales invoice document', () => {
  it('prints the fiscal totals, the payments, and the serial numbers', () => {
    const document = buildSalesInvoiceDocument(invoiceInput());

    expect(document.title).toBe('Invoice');
    expect(document.number).toBe('FI-2026-0007');
    expect(document.statusLabel).toBe('Partially paid');
    expect(document.watermark).toBe(null);
    expect(document.columns).toBe('invoice');
    expect(document.fileName).toBe('nexora-FI-2026-0007.pdf');

    expect(document.totals).toEqual([
      { label: 'Total excl. tax', value: '26.700 TND' },
      { label: 'Tax', value: '3.382 TND' },
      { label: 'Total incl. tax', value: '30.082 TND', strong: true },
      { label: 'Paid', value: '10.000 TND' },
      { label: 'Remaining', value: '20.082 TND', strong: true },
      { label: 'Payment method', value: 'Card (manual entry)' },
    ]);

    expect(document.meta).toEqual([
      { label: 'Issue date', value: '2026-11-02' },
      { label: 'Exit document', value: 'SO-2026-0004' },
      { label: 'Reference', value: 'DEVIS-11' },
      { label: 'Sold by', value: 'alice@example.com' },
    ]);

    expect(document.customer.details).toEqual([
      '5 Avenue Habib Bourguiba',
      'Sfax, TN',
      'amel@example.tn',
      '+216 22 111 222',
      'Tax ID: TN9876543',
    ]);
    expect(document.depot.name).toBe('MAIN / A1');

    expect(document.serials).toEqual([{ sku: 'IPHONE-15', serials: ['SN-INVOICE-0001'] }]);
    expect(document.payments).toEqual([
      { methodLabel: 'Card (manual entry)', amountMinor: 10000, detail: 'Terminal slip 4411' },
    ]);
  });

  it('keeps a walk-in sale readable and an unpaid invoice flat', () => {
    const document = buildSalesInvoiceDocument(
      invoiceInput({
        paymentStatus: 'unpaid',
        paymentMethod: null,
        salesOrderNumber: null,
        reference: null,
        notes: null,
        paidAmountMinor: 0,
        remainingAmountMinor: 30082,
        customer: WALK_IN,
      }),
    );

    expect(document.statusLabel).toBe('Unpaid');
    expect(document.note).toBe(null);
    expect(document.meta[1]).toEqual({ label: 'Exit document', value: '-' });
    expect(document.totals[5]).toEqual({ label: 'Payment method', value: '-' });
    expect(document.customer).toEqual({ name: 'Walk-in', details: [] });
  });

  it('is an invoice, never a receipt', () => {
    const document = buildSalesInvoiceDocument(invoiceInput());
    const text = JSON.stringify(document).toLowerCase();

    for (const forbidden of ['ticket', 'receipt', 'cash register', 'caisse']) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe('goods issue note document', () => {
  it('carries the exit document number and no amounts', () => {
    const document = buildIssueNoteDocument(issueNoteInput());

    expect(document.title).toBe('Goods issue note');
    expect(document.number).toBe('SO-2026-0004');
    expect(document.statusLabel).toBe('Issued');
    expect(document.watermark).toBe(null);
    expect(document.columns).toBe('issue');
    expect(document.fileName).toBe('nexora-SO-2026-0004-issue-note.pdf');
    expect(document.payments).toEqual([]);
    expect(document.totals).toEqual([
      { label: 'Lines', value: '2' },
      { label: 'Total quantity', value: '4', strong: true },
    ]);
    expect(document.meta[1]).toEqual({ label: 'Invoice', value: 'FI-2026-0007' });
    expect(document.note!.body).toContain('Every quantity on this note has left the depot.');
    expect(document.note!.body).toMatch(/^Hand over at the counter\. /);
  });

  it('falls back to the invoice number when the sale only issued devices', () => {
    const document = buildIssueNoteDocument(
      issueNoteInput({ salesOrderNumber: null, notes: null, orderStatus: null }),
    );

    expect(document.number).toBe('FI-2026-0007');
    expect(document.fileName).toBe('nexora-FI-2026-0007-issue-note.pdf');
    expect(document.statusLabel).toBe('Issued');
    expect(document.note!.body).not.toMatch(/^\s/);
  });

  it('marks a cancelled exit document', () => {
    const document = buildIssueNoteDocument(issueNoteInput({ orderStatus: 'cancelled' }));

    expect(document.statusLabel).toBe('Cancelled');
    expect(document.watermark).toBe('CANCELLED');
  });
});
