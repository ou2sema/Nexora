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
  type PurchaseOrderSummary,
  type PurchaseReceiptInput,
  type PurchaseReceiptResult,
  type PurchaseReturnCreateInput,
  type ReturnCreateResult,
  type PurchaseReturnDetail,
  type PurchaseReturnListResponse,
  type PurchaseReturnSummary,
  type ReturnCancelResult,
  type ReturnListQuery,
  type ReturnPostResult,
  purchaseOrderCreateResultSchema,
  purchaseOrderDetailSchema,
  purchaseOrderListResponseSchema,
  purchaseOrderStatusResultSchema,
  purchaseReceiptResultSchema,
  returnCreateResultSchema,
  purchaseReturnDetailSchema,
  purchaseReturnListResponseSchema,
  returnCancelResultSchema,
  returnPostResultSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { fingerprintOf, requireIdempotencyKey } from '../common/idempotency';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so it cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';
import { parseResult, toIso, toNullableIso, toNumber } from './operations.utils';

interface PurchaseOrderRow {
  id: string;
  organization_id: string;
  number: string;
  supplier_id: string;
  supplier_name: string;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  status: string;
  reference: string | null;
  notes: string | null;
  expected_on: string | null;
  ordered_at: Date | string | null;
  received_at: Date | string | null;
  cancelled_at: Date | string | null;
  line_count: number | string;
  total_quantity: string | number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PurchaseOrderLineRow {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  is_serialized: boolean;
  quantity_ordered: string;
  quantity_received: string;
  quantity_returned: string | number;
  unit_cost_minor: number | string | null;
}

interface PurchaseReturnRow {
  id: string;
  organization_id: string;
  number: string;
  purchase_order_id: string;
  purchase_order_number: string;
  supplier_id: string;
  supplier_name: string;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  status: string;
  reason: string;
  reference: string | null;
  posted_at: Date | string | null;
  cancelled_at: Date | string | null;
  line_count: number | string;
  total_quantity: string | number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PurchaseReturnLineRow {
  id: string;
  purchase_order_line_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  is_serialized: boolean;
  quantity: string;
  quantity_received: string;
}

interface PurchaseReturnDeviceRow {
  purchase_return_line_id: string;
  device_id: string;
  serial_number: string;
}

const ORDER_SELECT = sql`
  select o.id, o.organization_id, o.number, o.supplier_id, s.name as supplier_name,
         o.warehouse_id, w.code as warehouse_code, o.location_id, l.code as location_code,
         o.status, o.reference, o.notes, o.expected_on, o.ordered_at, o.received_at,
         o.cancelled_at, coalesce(a.line_count, 0) as line_count,
         coalesce(a.total_quantity, 0) as total_quantity, o.created_at, o.updated_at
  from public.purchase_orders o
  join public.suppliers s
    on s.id = o.supplier_id and s.organization_id = o.organization_id
  join public.warehouses w
    on w.id = o.warehouse_id and w.organization_id = o.organization_id
  join public.storage_locations l
    on l.id = o.location_id and l.organization_id = o.organization_id
    and l.warehouse_id = o.warehouse_id
  left join (
    select purchase_order_id, count(*) as line_count, sum(quantity_ordered) as total_quantity
    from public.purchase_order_lines
    group by purchase_order_id
  ) a on a.purchase_order_id = o.id
`;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toPurchaseOrderSummary(row: PurchaseOrderRow): PurchaseOrderSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    number: row.number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouse_code,
    locationId: row.location_id,
    locationCode: row.location_code,
    status: row.status as PurchaseOrderSummary['status'],
    reference: row.reference,
    notes: row.notes,
    expectedOn: row.expected_on,
    orderedAt: toNullableIso(row.ordered_at),
    receivedAt: toNullableIso(row.received_at),
    cancelledAt: toNullableIso(row.cancelled_at),
    lineCount: Number(row.line_count),
    totalQuantity: toNumber(row.total_quantity),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

const RETURN_SELECT = sql`
  select r.id, r.organization_id, r.number, r.purchase_order_id,
         o.number as purchase_order_number, r.supplier_id, s.name as supplier_name,
         r.warehouse_id, w.code as warehouse_code, r.location_id, l.code as location_code,
         r.status, r.reason, r.reference, r.posted_at, r.cancelled_at,
         coalesce(a.line_count, 0) as line_count,
         coalesce(a.total_quantity, 0) as total_quantity, r.created_at, r.updated_at
  from public.purchase_returns r
  join public.purchase_orders o
    on o.id = r.purchase_order_id and o.organization_id = r.organization_id
  join public.suppliers s
    on s.id = r.supplier_id and s.organization_id = r.organization_id
  join public.warehouses w
    on w.id = r.warehouse_id and w.organization_id = r.organization_id
  join public.storage_locations l
    on l.id = r.location_id and l.organization_id = r.organization_id
    and l.warehouse_id = r.warehouse_id
  left join (
    select purchase_return_id, count(*) as line_count, sum(quantity) as total_quantity
    from public.purchase_return_lines
    group by purchase_return_id
  ) a on a.purchase_return_id = r.id
`;

function toPurchaseReturnSummary(row: PurchaseReturnRow): PurchaseReturnSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    number: row.number,
    purchaseOrderId: row.purchase_order_id,
    purchaseOrderNumber: row.purchase_order_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouse_code,
    locationId: row.location_id,
    locationCode: row.location_code,
    status: row.status as PurchaseReturnSummary['status'],
    reason: row.reason,
    reference: row.reference,
    postedAt: toNullableIso(row.posted_at),
    cancelledAt: toNullableIso(row.cancelled_at),
    lineCount: Number(row.line_count),
    totalQuantity: toNumber(row.total_quantity),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

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
                 p.is_serialized, l.quantity_ordered, l.quantity_received,
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
        lines: lines.map((line) => ({
          id: line.id,
          productId: line.product_id,
          productSku: line.product_sku,
          productName: line.product_name,
          isSerialized: line.is_serialized,
          quantityOrdered: toNumber(line.quantity_ordered),
          quantityReceived: toNumber(line.quantity_received),
          quantityReturned: toNumber(line.quantity_returned),
          unitCostMinor: line.unit_cost_minor === null ? null : Number(line.unit_cost_minor),
        })),
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
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      await this.assertOrderExists(tx, organizationId, purchaseOrderId);

      const conditions: SQL[] = [
        sql`r.organization_id = ${organizationId}`,
        sql`r.purchase_order_id = ${purchaseOrderId}`,
      ];
      if (query.status) {
        conditions.push(sql`r.status = ${query.status}::app.return_status`);
      }

      const where = sql.join(conditions, sql` and `);
      const offset = (query.page - 1) * query.pageSize;

      const totals = resultRows<{ total: number }>(
        await tx.execute(sql`
          select count(*)::int as total
          from public.purchase_returns r
          where ${where}
        `),
      );

      const rows = resultRows<PurchaseReturnRow>(
        await tx.execute(sql`
          ${RETURN_SELECT}
          where ${where}
          order by r.created_at desc, r.id desc
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return purchaseReturnListResponseSchema.parse({
        items: rows.map(toPurchaseReturnSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: totals[0]?.total ?? 0,
      });
    });
  }

  async getReturn(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    returnId: string,
  ): Promise<PurchaseReturnDetail> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const rows = resultRows<PurchaseReturnRow>(
        await tx.execute(sql`
          ${RETURN_SELECT}
          where r.organization_id = ${organizationId}
            and r.purchase_order_id = ${purchaseOrderId}
            and r.id = ${returnId}
        `),
      );

      const purchaseReturn = rows[0];
      if (!purchaseReturn) {
        throw new AppError('purchase_return_not_found', 'Purchase return not found.', 404);
      }

      const lines = resultRows<PurchaseReturnLineRow>(
        await tx.execute(sql`
          select rl.id, rl.purchase_order_line_id, rl.product_id,
                 p.sku as product_sku, p.name as product_name, p.is_serialized,
                 rl.quantity, pol.quantity_received
          from public.purchase_return_lines rl
          join public.products p
            on p.id = rl.product_id and p.organization_id = rl.organization_id
          join public.purchase_order_lines pol
            on pol.id = rl.purchase_order_line_id
            and pol.organization_id = rl.organization_id
          where rl.organization_id = ${organizationId}
            and rl.purchase_return_id = ${returnId}
          order by p.name, rl.id
        `),
      );

      const devices = resultRows<PurchaseReturnDeviceRow>(
        await tx.execute(sql`
          select d.purchase_return_line_id, d.device_id, dev.serial_number
          from public.purchase_return_devices d
          join public.devices dev
            on dev.id = d.device_id and dev.organization_id = d.organization_id
          where d.organization_id = ${organizationId}
            and d.purchase_return_line_id in (
              select rl.id from public.purchase_return_lines rl
              where rl.organization_id = ${organizationId}
                and rl.purchase_return_id = ${returnId}
            )
          order by dev.serial_number
        `),
      );

      return purchaseReturnDetailSchema.parse({
        ...toPurchaseReturnSummary(purchaseReturn),
        lines: lines.map((line) => ({
          id: line.id,
          purchaseOrderLineId: line.purchase_order_line_id,
          productId: line.product_id,
          productSku: line.product_sku,
          productName: line.product_name,
          isSerialized: line.is_serialized,
          quantity: toNumber(line.quantity),
          quantityReceived: toNumber(line.quantity_received),
          devices: devices
            .filter((device) => device.purchase_return_line_id === line.id)
            .map((device) => ({ deviceId: device.device_id, serialNumber: device.serial_number })),
        })),
      });
    });
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
      async (tx) => {
        const result = await tx.execute(sql`
          select app.create_purchase_return(
            ${organizationId}::uuid, ${purchaseOrderId}::uuid,
            ${JSON.stringify(input.lines)}::jsonb, ${key},
            ${fingerprintOf({ purchaseOrderId, ...input })}, ${input.reason},
            ${input.reference ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(returnCreateResultSchema, row?.result);
      },
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
      async (tx) => {
        await this.assertReturnBelongs(tx, organizationId, purchaseOrderId, returnId);

        const result = await tx.execute(sql`
          select app.post_purchase_return(
            ${organizationId}::uuid, ${returnId}::uuid, ${key},
            ${fingerprintOf({ purchaseOrderId, returnId })}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(returnPostResultSchema, row?.result);
      },
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
      async (tx) => {
        await this.assertReturnBelongs(tx, organizationId, purchaseOrderId, returnId);

        const result = await tx.execute(sql`
          select app.cancel_purchase_return(
            ${organizationId}::uuid, ${returnId}::uuid, ${key},
            ${fingerprintOf({ purchaseOrderId, returnId, ...input })}, ${input.reason ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(returnCancelResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  private async assertOrderExists(
    tx: AppTransaction,
    organizationId: string,
    purchaseOrderId: string,
  ): Promise<void> {
    const rows = resultRows<{ id: string }>(
      await tx.execute(sql`
        select id from public.purchase_orders
        where organization_id = ${organizationId} and id = ${purchaseOrderId}
      `),
    );

    if (!rows[0]) {
      throw new AppError('purchase_order_not_found', 'Purchase order not found.', 404);
    }
  }

  private async assertReturnBelongs(
    tx: AppTransaction,
    organizationId: string,
    purchaseOrderId: string,
    returnId: string,
  ): Promise<void> {
    const rows = resultRows<{ id: string }>(
      await tx.execute(sql`
        select id from public.purchase_returns
        where organization_id = ${organizationId}
          and purchase_order_id = ${purchaseOrderId}
          and id = ${returnId}
      `),
    );

    if (!rows[0]) {
      throw new AppError('purchase_return_not_found', 'Purchase return not found.', 404);
    }
  }
}
