import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { errorEnvelopeSchema, idParamSchema } from '../src/index';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginatedSchema,
  paginationQuerySchema,
} from '../src/pagination';
import { customerCreateSchema, salesInvoiceCreateSchema } from '../src/invoicing';

const PRODUCT_ID = '20000000-0000-4000-8000-0000000000a1';
const DEVICE_ID = '70000000-0000-4000-8000-000000000001';
const WAREHOUSE_ID = '50000000-0000-4000-8000-00000000000a';
const LOCATION_ID = '60000000-0000-4000-8000-00000000000a';

function basket(lines: unknown[], rest: Record<string, unknown> = {}) {
  return salesInvoiceCreateSchema.parse({
    warehouseId: WAREHOUSE_ID,
    locationId: LOCATION_ID,
    customerName: 'SBS Vision',
    lines,
    ...rest,
  });
}

describe('paginationQuerySchema', () => {
  it('applies defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it('coerces query string values', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('rejects a page size above the cap', () => {
    const result = paginationQuerySchema.safeParse({ pageSize: String(MAX_PAGE_SIZE + 1) });
    expect(result.success).toBe(false);
  });

  it('rejects a zero or negative page', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
  });
});

describe('paginatedSchema', () => {
  it('validates a page of items', () => {
    const schema = paginatedSchema(z.object({ id: z.string() }));
    const parsed = schema.parse({
      items: [{ id: 'a' }],
      page: 1,
      pageSize: 25,
      total: 1,
    });

    expect(parsed.items).toHaveLength(1);
  });

  it('rejects a negative total', () => {
    const schema = paginatedSchema(z.object({ id: z.string() }));
    expect(schema.safeParse({ items: [], page: 1, pageSize: 25, total: -1 }).success).toBe(false);
  });
});

describe('errorEnvelopeSchema', () => {
  it('accepts the API error shape', () => {
    const parsed = errorEnvelopeSchema.parse({
      error: { code: 'not_found', message: 'Missing', requestId: 'req-1' },
    });

    expect(parsed.error.code).toBe('not_found');
  });
});

describe('idParamSchema', () => {
  it('accepts a uuid and rejects anything else', () => {
    expect(idParamSchema.safeParse({ id: '00000000-0000-4000-8000-000000000000' }).success).toBe(
      true,
    );
    expect(idParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('customerCreateSchema', () => {
  it('normalizes a country code and keeps optional fields absent', () => {
    const parsed = customerCreateSchema.parse({ name: 'SBS Vision', countryCode: 'tn' });

    expect(parsed).toEqual({ name: 'SBS Vision', countryCode: 'TN' });
  });

  it('rejects a blank name and a malformed email', () => {
    expect(customerCreateSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(customerCreateSchema.safeParse({ name: 'Ok', email: 'no-at-sign' }).success).toBe(false);
  });
});

describe('salesInvoiceCreateSchema', () => {
  it('applies the settlement defaults', () => {
    const parsed = basket([{ kind: 'product', productId: PRODUCT_ID, quantity: 2 }]);

    expect(parsed.paidAmountMinor).toBe(0);
    expect(parsed.paymentMethod).toBe('cash');
  });

  it('requires a customer, either a record or a named walk-in buyer', () => {
    const lines = [{ kind: 'device', deviceId: DEVICE_ID }];
    const base = { warehouseId: WAREHOUSE_ID, locationId: LOCATION_ID, lines };

    expect(salesInvoiceCreateSchema.safeParse(base).success).toBe(false);
    expect(salesInvoiceCreateSchema.safeParse({ ...base, customerName: '  ' }).success).toBe(false);
    expect(salesInvoiceCreateSchema.safeParse({ ...base, customerId: PRODUCT_ID }).success).toBe(
      true,
    );
  });

  it('keeps one product or one physical unit to a single line', () => {
    expect(
      salesInvoiceCreateSchema.safeParse({
        warehouseId: WAREHOUSE_ID,
        locationId: LOCATION_ID,
        customerName: 'SBS Vision',
        lines: [
          { kind: 'product', productId: PRODUCT_ID, quantity: 1 },
          { kind: 'product', productId: PRODUCT_ID, quantity: 2 },
        ],
      }).success,
    ).toBe(false);
    expect(
      salesInvoiceCreateSchema.safeParse({
        warehouseId: WAREHOUSE_ID,
        locationId: LOCATION_ID,
        customerName: 'SBS Vision',
        lines: [
          { kind: 'device', deviceId: DEVICE_ID },
          { kind: 'device', deviceId: DEVICE_ID },
        ],
      }).success,
    ).toBe(false);
  });

  it('refuses invented rates, quantities and line kinds', () => {
    expect(
      salesInvoiceCreateSchema.safeParse({
        warehouseId: WAREHOUSE_ID,
        locationId: LOCATION_ID,
        customerName: 'SBS Vision',
        lines: [{ kind: 'product', productId: PRODUCT_ID, quantity: 1, taxRatePercent: 100.0001 }],
      }).success,
    ).toBe(false);
    expect(
      salesInvoiceCreateSchema.safeParse({
        warehouseId: WAREHOUSE_ID,
        locationId: LOCATION_ID,
        customerName: 'SBS Vision',
        lines: [{ kind: 'product', productId: PRODUCT_ID, quantity: 1.00001 }],
      }).success,
    ).toBe(false);
    expect(
      salesInvoiceCreateSchema.safeParse({
        warehouseId: WAREHOUSE_ID,
        locationId: LOCATION_ID,
        customerName: 'SBS Vision',
        lines: [{ kind: 'bundle', productId: PRODUCT_ID, quantity: 1 }],
      }).success,
    ).toBe(false);
  });
});
