import { Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { ZodType } from 'zod';

import type {
  StockCount,
  StockCountDiscardResult,
  StockCountLine,
  StockCountListQuery,
  StockCountListResponse,
  StockCountPostResult,
  StockCountRecordInput,
  StockCountRecordResult,
  StockCountStartInput,
  StockCountStartResult,
  StockCountSummary,
} from '@mystock/contracts';
import {
  stockCountDiscardResultSchema,
  stockCountLineSchema,
  stockCountListResponseSchema,
  stockCountPostResultSchema,
  stockCountRecordResultSchema,
  stockCountStartResultSchema,
  stockCountStatusSchema,
  stockCountSummarySchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { fingerprintOf, requireIdempotencyKey } from '../common/idempotency';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';

interface StockCountHeaderRow {
  id: string;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  status: string;
  note: string | null;
  line_count: number | string;
  created_at: Date | string;
  posted_at: Date | string | null;
}

interface StockCountLineRow {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  counted_quantity: string;
  on_hand: string;
  variance: string;
  updated_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function toSummary(row: StockCountHeaderRow): StockCountSummary {
  return stockCountSummarySchema.parse({
    id: row.id,
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouse_code,
    locationId: row.location_id,
    locationCode: row.location_code,
    status: stockCountStatusSchema.parse(row.status),
    note: row.note,
    lineCount: Number(row.line_count),
    createdAt: toIso(row.created_at),
    postedAt: row.posted_at === null ? null : toIso(row.posted_at),
  });
}

function toLine(row: StockCountLineRow): StockCountLine {
  return stockCountLineSchema.parse({
    id: row.id,
    productId: row.product_id,
    productSku: row.product_sku,
    productName: row.product_name,
    countedQuantity: toNumber(row.counted_quantity),
    onHand: toNumber(row.on_hand),
    variance: toNumber(row.variance),
    updatedAt: toIso(row.updated_at),
  });
}

function parseResult<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError('internal_error', 'Unexpected stock count response.', 500);
  }
  return parsed.data;
}

const COUNT_SELECT = sql`
  select c.id, c.warehouse_id, w.code as warehouse_code,
         c.location_id, l.code as location_code, c.status, c.note,
         (select count(*)::int from public.stock_count_lines l2
          where l2.organization_id = c.organization_id and l2.count_id = c.id) as line_count,
         c.created_at, c.posted_at
  from public.stock_counts c
  join public.warehouses w
    on w.id = c.warehouse_id and w.organization_id = c.organization_id
  join public.storage_locations l
    on l.id = c.location_id and l.organization_id = c.organization_id
    and l.warehouse_id = c.warehouse_id
`;

@Injectable()
export class StockCountsService {
  constructor(private readonly access: TenantAccessService) {}

  async list(
    userId: string,
    organizationId: string,
    query: StockCountListQuery,
  ): Promise<StockCountListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`c.organization_id = ${organizationId}`];
      if (query.status) {
        conditions.push(sql`c.status = ${query.status}::app.stock_count_status`);
      }

      const where = sql.join(conditions, sql` and `);
      const offset = (query.page - 1) * query.pageSize;

      const totals = resultRows<{ total: number }>(
        await tx.execute(
          sql`select count(*)::int as total from public.stock_counts c where ${where}`,
        ),
      );

      const rows = resultRows<StockCountHeaderRow>(
        await tx.execute(sql`
          ${COUNT_SELECT}
          where ${where}
          order by c.created_at desc, c.id desc
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return stockCountListResponseSchema.parse({
        items: rows.map(toSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: totals[0]?.total ?? 0,
      });
    });
  }

  async get(userId: string, organizationId: string, countId: string): Promise<StockCount> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const [header] = resultRows<StockCountHeaderRow>(
        await tx.execute(sql`
          ${COUNT_SELECT}
          where c.organization_id = ${organizationId} and c.id = ${countId}
        `),
      );

      if (!header) throw new AppError('stock_count_not_found', 'Stock count not found.', 404);

      const lineRows = resultRows<StockCountLineRow>(
        await tx.execute(sql`
          select l.id, l.product_id, p.sku as product_sku, p.name as product_name,
                 l.counted_quantity, coalesce(sl.on_hand, 0) as on_hand,
                 l.counted_quantity - coalesce(sl.on_hand, 0) as variance, l.updated_at
          from public.stock_count_lines l
          join public.products p
            on p.id = l.product_id and p.organization_id = l.organization_id
          left join public.stock_levels sl
            on sl.organization_id = l.organization_id
            and sl.product_id = l.product_id
            and sl.warehouse_id = ${header.warehouse_id}
            and sl.location_id = ${header.location_id}
          where l.organization_id = ${organizationId} and l.count_id = ${countId}
          order by lower(p.name), p.sku
        `),
      );

      return { ...toSummary(header), lines: lineRows.map(toLine) };
    });
  }

  async start(
    userId: string,
    organizationId: string,
    input: StockCountStartInput,
  ): Promise<StockCountStartResult> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.start_stock_count(
            ${organizationId}::uuid, ${input.warehouseId}::uuid,
            ${input.locationId}::uuid, ${input.note ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(stockCountStartResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async record(
    userId: string,
    organizationId: string,
    countId: string,
    input: StockCountRecordInput,
  ): Promise<StockCountRecordResult> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.record_stock_count(
            ${organizationId}::uuid, ${countId}::uuid, ${input.productId}::uuid,
            ${input.quantity}::numeric, ${input.mode ?? 'increment'}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(stockCountRecordResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async post(
    userId: string,
    organizationId: string,
    countId: string,
    idempotencyKey: string | undefined,
  ): Promise<StockCountPostResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.post_stock_count(
            ${organizationId}::uuid, ${countId}::uuid, ${key}, ${fingerprintOf({ countId })}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(stockCountPostResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async discard(
    userId: string,
    organizationId: string,
    countId: string,
  ): Promise<StockCountDiscardResult> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.discard_stock_count(
            ${organizationId}::uuid, ${countId}::uuid
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(stockCountDiscardResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }
}
