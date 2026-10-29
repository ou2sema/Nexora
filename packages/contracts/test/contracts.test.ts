import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { errorEnvelopeSchema, idParamSchema } from '../src/index';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginatedSchema,
  paginationQuerySchema,
} from '../src/pagination';

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
