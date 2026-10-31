import { Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';

import {
  type OrderCancelInput,
  type SalesOrderCancelResult,
  type SalesOrderConfirmResult,
  type SalesOrderCreateInput,
  type SalesOrderCreateResult,
  type SalesOrderDetail,
  type SalesOrderFulfilResult,
  type SalesOrderListQuery,
  type SalesOrderListResponse,
  type SalesOrderSummary,
  salesOrderCancelResultSchema,
  salesOrderConfirmResultSchema,
  salesOrderCreateResultSchema,
  salesOrderDetailSchema,
  salesOrderFulfilResultSchema,
  salesOrderListResponseSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { fingerprintOf, requireIdempotencyKey } from '../common/idempotency';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so it cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';
import { parseResult, toIso, toNullableIso, toNumber } from './operations.utils';

interface SalesOrderRow {
  id: string;
  organization_id: string;
  number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  status: string;
  reference: string | null;
  notes: string | null;
  confirmed_at: Date | string | null;
  fulfilled_at: Date | string | null;
  cancelled_at: Date | string | null;
  line_count: number | string;
  total_quantity: string | number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SalesOrderLineRow {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  quantity: string;
  unit_price_minor: number | string | null;
  reservation_id: string | null;
}

const ORDER_SELECT = sql`
  select o.id, o.organization_id, o.number, o.customer_name, o.customer_email,
         o.customer_phone, o.warehouse_id, w.code as warehouse_code, o.location_id,
         l.code as location_code, o.status, o.reference, o.notes, o.confirmed_at,
         o.fulfilled_at, o.cancelled_at, coalesce(a.line_count, 0) as line_count,
         coalesce(a.total_quantity, 0) as total_quantity, o.created_at, o.updated_at
  from public.sales_orders o
  join public.warehouses w
    on w.id = o.warehouse_id and w.organization_id = o.organization_id
  join public.storage_locations l
    on l.id = o.location_id and l.organization_id = o.organization_id
    and l.warehouse_id = o.warehouse_id
  left join (
    select sales_order_id, count(*) as line_count, sum(quantity) as total_quantity
    from public.sales_order_lines
    group by sales_order_id
  ) a on a.sales_order_id = o.id
`;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toSalesOrderSummary(row: SalesOrderRow): SalesOrderSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    number: row.number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouse_code,
    locationId: row.location_id,
    locationCode: row.location_code,
    status: row.status as SalesOrderSummary['status'],
    reference: row.reference,
    notes: row.notes,
    confirmedAt: toNullableIso(row.confirmed_at),
    fulfilledAt: toNullableIso(row.fulfilled_at),
    cancelledAt: toNullableIso(row.cancelled_at),
    lineCount: Number(row.line_count),
    totalQuantity: toNumber(row.total_quantity),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

@Injectable()
export class SalesOrdersService {
  constructor(private readonly access: TenantAccessService) {}

  async list(
    userId: string,
    organizationId: string,
    query: SalesOrderListQuery,
  ): Promise<SalesOrderListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`o.organization_id = ${organizationId}`];

      if (query.status) {
        conditions.push(sql`o.status = ${query.status}::app.sales_order_status`);
      }
      if (query.search) {
        const pattern = `%${escapeLike(query.search)}%`;
        conditions.push(sql`(o.number ilike ${pattern} or o.customer_name ilike ${pattern})`);
      }

      const where = sql.join(conditions, sql` and `);
      const offset = (query.page - 1) * query.pageSize;

      const totals = resultRows<{ total: number }>(
        await tx.execute(sql`
          select count(*)::int as total from public.sales_orders o where ${where}
        `),
      );

      const rows = resultRows<SalesOrderRow>(
        await tx.execute(sql`
          ${ORDER_SELECT}
          where ${where}
          order by o.created_at desc, o.id desc
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return salesOrderListResponseSchema.parse({
        items: rows.map(toSalesOrderSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: totals[0]?.total ?? 0,
      });
    });
  }

  async get(
    userId: string,
    organizationId: string,
    salesOrderId: string,
  ): Promise<SalesOrderDetail> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const rows = resultRows<SalesOrderRow>(
        await tx.execute(sql`
          ${ORDER_SELECT}
          where o.organization_id = ${organizationId} and o.id = ${salesOrderId}
        `),
      );

      const order = rows[0];
      if (!order) throw new AppError('sales_order_not_found', 'Outgoing order not found.', 404);

      const lines = resultRows<SalesOrderLineRow>(
        await tx.execute(sql`
          select l.id, l.product_id, p.sku as product_sku, p.name as product_name,
                 l.quantity, l.unit_price_minor, l.reservation_id
          from public.sales_order_lines l
          join public.products p
            on p.id = l.product_id and p.organization_id = l.organization_id
          where l.organization_id = ${organizationId} and l.sales_order_id = ${salesOrderId}
          order by p.name, l.id
        `),
      );

      return salesOrderDetailSchema.parse({
        ...toSalesOrderSummary(order),
        lines: lines.map((line) => ({
          id: line.id,
          productId: line.product_id,
          productSku: line.product_sku,
          productName: line.product_name,
          quantity: toNumber(line.quantity),
          unitPriceMinor: line.unit_price_minor === null ? null : Number(line.unit_price_minor),
          reservationId: line.reservation_id,
        })),
      });
    });
  }

  async create(
    userId: string,
    organizationId: string,
    idempotencyKey: string | undefined,
    input: SalesOrderCreateInput,
  ): Promise<SalesOrderCreateResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.create_sales_order(
            ${organizationId}::uuid, ${input.customerName}, ${input.warehouseId}::uuid,
            ${input.locationId}::uuid, ${JSON.stringify(input.lines)}::jsonb, ${key},
            ${fingerprintOf(input)}, ${input.customerEmail ?? null},
            ${input.customerPhone ?? null}, ${input.reference ?? null}, ${input.notes ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(salesOrderCreateResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async confirm(
    userId: string,
    organizationId: string,
    salesOrderId: string,
    idempotencyKey: string | undefined,
  ): Promise<SalesOrderConfirmResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.confirm_sales_order(
            ${organizationId}::uuid, ${salesOrderId}::uuid, ${key},
            ${fingerprintOf({ salesOrderId })}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(salesOrderConfirmResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async fulfil(
    userId: string,
    organizationId: string,
    salesOrderId: string,
    idempotencyKey: string | undefined,
  ): Promise<SalesOrderFulfilResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.fulfil_sales_order(
            ${organizationId}::uuid, ${salesOrderId}::uuid, ${key},
            ${fingerprintOf({ salesOrderId })}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(salesOrderFulfilResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async cancel(
    userId: string,
    organizationId: string,
    salesOrderId: string,
    idempotencyKey: string | undefined,
    input: OrderCancelInput,
  ): Promise<SalesOrderCancelResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.cancel_sales_order(
            ${organizationId}::uuid, ${salesOrderId}::uuid, ${key},
            ${fingerprintOf({ salesOrderId, ...input })}, ${input.reason ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(salesOrderCancelResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }
}
