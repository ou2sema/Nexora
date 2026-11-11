import { Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';

import {
  type OrderCancelInput,
  type PurchaseOrderCreateInput,
  type PurchaseOrderCreateResult,
  type PurchaseOrderDetail,
  type PurchaseOrderListQuery,
  type PurchaseOrderListResponse,
  type PurchaseOrderStatusResult,
  type PurchaseReceiptInput,
  type PurchaseReceiptResult,
  type PurchaseReturnCreateInput,
  type PurchaseReturnDetail,
  type PurchaseReturnListResponse,
  type ReturnCancelResult,
  type ReturnCreateResult,
  type ReturnListQuery,
  type ReturnPostResult,
  purchaseOrderCreateResultSchema,
  purchaseOrderDetailSchema,
  purchaseOrderListResponseSchema,
  purchaseOrderStatusResultSchema,
  purchaseReceiptResultSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { fingerprintOf, requireIdempotencyKey } from '../common/idempotency';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so it cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';
import { parseResult } from './operations.utils';
import {
  ORDER_SELECT,
  toPurchaseOrderLine,
  toPurchaseOrderSummary,
  type PurchaseOrderLineRow,
  type PurchaseOrderRow,
} from './purchase-order.rows';
import {
  cancelPurchaseReturn,
  insertPurchaseReturn,
  postPurchaseReturn,
  readPurchaseReturnDetail,
  readPurchaseReturnList,
} from './purchase-returns.query';

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Purchase orders and their returns. Order rows, SELECT fragments and mappers live in
 * `purchase-order.rows.ts`; the return workflow lives in `purchase-returns.query.ts`.
 * This service owns the tenant session and the idempotency keys.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly access: TenantAccessService) {}

  async list(
    userId: string,
    organizationId: string,
    query: PurchaseOrderListQuery,
  ): Promise<PurchaseOrderListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`o.organization_id = ${organizationId}`];

      if (query.status) {
        conditions.push(sql`o.status = ${query.status}::app.purchase_order_status`);
      }
      if (query.supplierId) conditions.push(sql`o.supplier_id = ${query.supplierId}`);
      if (query.search) {
        const pattern = `%${escapeLike(query.search)}%`;
        conditions.push(sql`(o.number ilike ${pattern} or s.name ilike ${pattern})`);
      }

      const where = sql.join(conditions, sql` and `);
      const offset = (query.page - 1) * query.pageSize;

      const totals = resultRows<{ total: number }>(
        await tx.execute(sql`
          select count(*)::int as total
          from public.purchase_orders o
          join public.suppliers s
            on s.id = o.supplier_id and s.organization_id = o.organization_id
          where ${where}
        `),
      );

      const rows = resultRows<PurchaseOrderRow>(
        await tx.execute(sql`
          ${ORDER_SELECT}
          where ${where}
          order by o.created_at desc, o.id desc
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return purchaseOrderListResponseSchema.parse({
        items: rows.map(toPurchaseOrderSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: totals[0]?.total ?? 0,
      });
    });
  }

  async get(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
  ): Promise<PurchaseOrderDetail> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const rows = resultRows<PurchaseOrderRow>(
        await tx.execute(sql`
          ${ORDER_SELECT}
          where o.organization_id = ${organizationId} and o.id = ${purchaseOrderId}
        `),
      );

      const order = rows[0];
      if (!order) throw new AppError('purchase_order_not_found', 'Purchase order not found.', 404);

      const lines = resultRows<PurchaseOrderLineRow>(
        await tx.execute(sql`
          select l.id, l.product_id, p.sku as product_sku, p.name as product_name,
                 p.is_serialized, p.is_individually_tracked,
                 l.quantity_ordered, l.quantity_received,
                 coalesce((
                   select sum(rl.quantity)
                   from public.purchase_return_lines rl
                   join public.purchase_returns r
                     on r.id = rl.purchase_return_id
                     and r.organization_id = rl.organization_id
                   where rl.organization_id = l.organization_id
                     and rl.purchase_order_line_id = l.id
                     and r.status = 'posted'
                 ), 0) as quantity_returned,
                 l.unit_cost_minor
          from public.purchase_order_lines l
          join public.products p
            on p.id = l.product_id and p.organization_id = l.organization_id
          where l.organization_id = ${organizationId} and l.purchase_order_id = ${purchaseOrderId}
          order by p.name, l.id
        `),
      );

      return purchaseOrderDetailSchema.parse({
        ...toPurchaseOrderSummary(order),
        lines: lines.map(toPurchaseOrderLine),
      });
    });
  }

  async create(
    userId: string,
    organizationId: string,
    idempotencyKey: string | undefined,
    input: PurchaseOrderCreateInput,
  ): Promise<PurchaseOrderCreateResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.create_purchase_order(
            ${organizationId}::uuid, ${input.supplierId}::uuid, ${input.warehouseId}::uuid,
            ${input.locationId}::uuid, ${JSON.stringify(input.lines)}::jsonb,
            ${key}, ${fingerprintOf(input)}, ${input.expectedOn ?? null}::date,
            ${input.reference ?? null}, ${input.notes ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(purchaseOrderCreateResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async markOrdered(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    idempotencyKey: string | undefined,
  ): Promise<PurchaseOrderStatusResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.order_purchase_order(
            ${organizationId}::uuid, ${purchaseOrderId}::uuid, ${key},
            ${fingerprintOf({ purchaseOrderId })}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(purchaseOrderStatusResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async receive(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    idempotencyKey: string | undefined,
    input: PurchaseReceiptInput,
  ): Promise<PurchaseReceiptResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.receive_purchase_order(
            ${organizationId}::uuid, ${purchaseOrderId}::uuid,
            ${JSON.stringify(input.lines)}::jsonb, ${key},
            ${fingerprintOf({ purchaseOrderId, ...input })}, ${input.note ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(purchaseReceiptResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async cancel(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    idempotencyKey: string | undefined,
    input: OrderCancelInput,
  ): Promise<PurchaseOrderStatusResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.cancel_purchase_order(
            ${organizationId}::uuid, ${purchaseOrderId}::uuid, ${key},
            ${fingerprintOf({ purchaseOrderId, ...input })}, ${input.reason ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(purchaseOrderStatusResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async listReturns(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    query: ReturnListQuery,
  ): Promise<PurchaseReturnListResponse> {
    return this.access.runAsMember(userId, organizationId, (tx) =>
      readPurchaseReturnList(tx, organizationId, purchaseOrderId, query),
    );
  }

  async getReturn(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    returnId: string,
  ): Promise<PurchaseReturnDetail> {
    return this.access.runAsMember(userId, organizationId, (tx) =>
      readPurchaseReturnDetail(tx, organizationId, purchaseOrderId, returnId),
    );
  }

  async createReturn(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    idempotencyKey: string | undefined,
    input: PurchaseReturnCreateInput,
  ): Promise<ReturnCreateResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      (tx) => insertPurchaseReturn(tx, organizationId, purchaseOrderId, key, input),
      { roles: CATALOG_WRITERS },
    );
  }

  async postReturn(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    returnId: string,
    idempotencyKey: string | undefined,
  ): Promise<ReturnPostResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      (tx) => postPurchaseReturn(tx, organizationId, purchaseOrderId, returnId, key),
      { roles: CATALOG_WRITERS },
    );
  }

  async cancelReturn(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    returnId: string,
    idempotencyKey: string | undefined,
    input: OrderCancelInput,
  ): Promise<ReturnCancelResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      (tx) => cancelPurchaseReturn(tx, organizationId, purchaseOrderId, returnId, key, input),
      { roles: CATALOG_WRITERS },
    );
  }
}
