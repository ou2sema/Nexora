import { Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';

import {
  type LowStockQuery,
  type LowStockResponse,
  type MovementExportQuery,
  type ReportOverview,
  type ReportOverviewQuery,
  type StockLevelExportQuery,
  type SupplierPerformanceQuery,
  type SupplierPerformanceResponse,
  lowStockResponseSchema,
  reportOverviewSchema,
  supplierPerformanceResponseSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantAccessService } from '../tenancy/tenant-access.service';
import { csvDocument } from './csv';

export const REPORT_EXPORT_ROW_LIMIT = 50_000;

interface LedgerTotalsRow {
  on_hand: string;
  reserved: string;
  available: string;
  product_count: number | string;
  location_count: number | string;
  warehouse_count: number | string;
  purchase_value_minor: string;
  sale_value_minor: string;
  unpriced_product_count: number | string;
}

interface DeviceTotalsRow {
  serialized_in_stock: number | string;
  purchase_value_minor: string;
  sale_value_minor: string;
  unpriced_product_count: number | string;
}

interface MovementTotalsRow {
  count: number | string;
  received_quantity: string;
  issued_quantity: string;
  adjusted_quantity: string;
  net_quantity: string;
}

interface SeriesRow {
  date: string;
  received_quantity: string;
  issued_quantity: string;
  net_quantity: string;
}

interface WarehouseRow {
  warehouse_id: string;
  code: string;
  name: string;
  on_hand: string;
  reserved: string;
  available: string;
  purchase_value_minor: string;
  sale_value_minor: string;
  serialized_in_stock: number | string;
}

interface LowStockRow {
  product_id: string;
  sku: string;
  product_name: string;
  category_name: string | null;
  is_serialized: boolean;
  reorder_threshold: string;
  on_hand: string;
  reserved: string;
  available: string;
  shortfall: string;
  total: number | string;
}

interface StockLevelExportRow {
  sku: string;
  product_name: string;
  warehouse_code: string;
  location_code: string;
  on_hand: string;
  reserved: string;
  available: string;
  updated_at: Date | string;
}

interface MovementExportRow {
  created_at: Date | string;
  movement_type: string;
  sku: string;
  product_name: string;
  warehouse_code: string;
  location_code: string;
  quantity_delta: string;
  on_hand_after: string;
  reference_type: string;
  reference_id: string | null;
  reason: string | null;
  actor_id: string | null;
}

interface SupplierPerformanceRow {
  supplier_id: string;
  supplier_name: string;
  orders_created: number | string;
  orders_received: number | string;
  expected_orders: number | string;
  on_time_orders: number | string;
  average_lead_time_days: string | number | null;
  ordered_value_minor: string;
  received_value_minor: string;
  received_quantity: string;
  returned_quantity: string;
}

export interface CsvExport {
  filename: string;
  body: Buffer;
}

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 30;
const SUPPLIER_WINDOW_DAYS = 90;

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function fileDate(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ReportsService {
  constructor(private readonly access: TenantAccessService) {}

  async overview(
    userId: string,
    organizationId: string,
    query: ReportOverviewQuery,
  ): Promise<ReportOverview> {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - (DEFAULT_WINDOW_DAYS - 1) * DAY_MS);
    const fromDate = from.toISOString().slice(0, 10);
    const toDate = to.toISOString().slice(0, 10);

    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const stockConditions: SQL[] = [sql`sl.organization_id = ${organizationId}`];
      if (query.warehouseId) {
        stockConditions.push(sql`sl.warehouse_id = ${query.warehouseId}`);
      }
      if (query.categoryId) {
        stockConditions.push(sql`p.category_id = ${query.categoryId}`);
      }
      const stockWhere = sql.join(stockConditions, sql` and `);

      const deviceConditions: SQL[] = [
        sql`d.organization_id = ${organizationId}`,
        sql`d.status = 'in_stock'`,
      ];
      if (query.warehouseId) {
        deviceConditions.push(sql`d.warehouse_id = ${query.warehouseId}`);
      }
      if (query.categoryId) {
        deviceConditions.push(sql`p.category_id = ${query.categoryId}`);
      }
      const deviceWhere = sql.join(deviceConditions, sql` and `);

      const movementConditions: SQL[] = [
        sql`m.organization_id = ${organizationId}`,
        sql`m.created_at >= ${from.toISOString()}::timestamptz`,
        sql`m.created_at <= ${to.toISOString()}::timestamptz`,
      ];
      if (query.warehouseId) {
        movementConditions.push(sql`m.warehouse_id = ${query.warehouseId}`);
      }
      if (query.categoryId) {
        movementConditions.push(sql`p.category_id = ${query.categoryId}`);
      }
      const movementWhere = sql.join(movementConditions, sql` and `);

      const [ledgerTotals] = resultRows<LedgerTotalsRow>(
        await tx.execute(sql`
          select coalesce(sum(sl.on_hand), 0)::text as on_hand,
                 coalesce(sum(sl.reserved), 0)::text as reserved,
                 coalesce(sum(sl.available), 0)::text as available,
                 count(distinct sl.product_id)::int as product_count,
                 count(*)::int as location_count,
                 count(distinct sl.warehouse_id)::int as warehouse_count,
                 coalesce(sum(round(sl.on_hand * p.purchase_price_minor)), 0)::text
                   as purchase_value_minor,
                 coalesce(sum(round(sl.on_hand * p.sale_price_minor)), 0)::text
                   as sale_value_minor,
                 count(distinct case
                   when sl.on_hand > 0
                     and (p.purchase_price_minor is null or p.sale_price_minor is null)
                   then p.id
                 end)::int as unpriced_product_count
          from public.stock_levels sl
          join public.products p
            on p.id = sl.product_id and p.organization_id = sl.organization_id
          where ${stockWhere}
        `),
      );

      const [deviceTotals] = resultRows<DeviceTotalsRow>(
        await tx.execute(sql`
          select count(*)::int as serialized_in_stock,
                 coalesce(sum(round(p.purchase_price_minor)), 0)::text as purchase_value_minor,
                 coalesce(sum(round(p.sale_price_minor)), 0)::text as sale_value_minor,
                 count(distinct case
                   when p.purchase_price_minor is null or p.sale_price_minor is null then p.id
                 end)::int as unpriced_product_count
          from public.devices d
          join public.products p
            on p.id = d.product_id and p.organization_id = d.organization_id
          where ${deviceWhere}
        `),
      );

      const [movementTotals] = resultRows<MovementTotalsRow>(
        await tx.execute(sql`
          select count(*)::int as count,
                 coalesce(sum(case
                   when m.movement_type in ('receipt', 'transfer_in') then m.quantity_delta
                   else 0
                 end), 0)::text as received_quantity,
                 coalesce(sum(case
                   when m.movement_type in ('issue', 'transfer_out') then -m.quantity_delta
                   else 0
                 end), 0)::text as issued_quantity,
                 coalesce(sum(case
                   when m.movement_type = 'adjustment' then m.quantity_delta
                   else 0
                 end), 0)::text as adjusted_quantity,
                 coalesce(sum(m.quantity_delta), 0)::text as net_quantity
          from public.stock_movements m
          join public.products p
            on p.id = m.product_id and p.organization_id = m.organization_id
          where ${movementWhere}
        `),
      );

      const seriesConditions: SQL[] = [
        sql`m.organization_id = ${organizationId}`,
        sql`m.created_at >= ${from.toISOString()}::timestamptz`,
        sql`m.created_at <= ${to.toISOString()}::timestamptz`,
      ];
      if (query.warehouseId) {
        seriesConditions.push(sql`m.warehouse_id = ${query.warehouseId}`);
      }
      if (query.categoryId) {
        seriesConditions.push(sql`p.category_id = ${query.categoryId}`);
      }
      const seriesWhere = sql.join(seriesConditions, sql` and `);

      const seriesRows = resultRows<SeriesRow>(
        await tx.execute(sql`
          select to_char(days.day, 'YYYY-MM-DD') as date,
                 coalesce(sum(case
                   when m.movement_type in ('receipt', 'transfer_in') then m.quantity_delta
                   else 0
                 end), 0)::text as received_quantity,
                 coalesce(sum(case
                   when m.movement_type in ('issue', 'transfer_out') then -m.quantity_delta
                   else 0
                 end), 0)::text as issued_quantity,
                 coalesce(sum(m.quantity_delta), 0)::text as net_quantity
          from generate_series(${fromDate}::date, ${toDate}::date, interval '1 day') as days(day)
          left join (
            select (m.created_at at time zone 'UTC')::date as day,
                   m.quantity_delta, m.movement_type
            from public.stock_movements m
            join public.products p
              on p.id = m.product_id and p.organization_id = m.organization_id
            where ${seriesWhere}
          ) m on m.day = days.day
          group by days.day
          order by days.day
        `),
      );

      const warehouseConditions: SQL[] = [sql`w.organization_id = ${organizationId}`];
      if (query.warehouseId) {
        warehouseConditions.push(sql`w.id = ${query.warehouseId}`);
      }
      const warehouseWhere = sql.join(warehouseConditions, sql` and `);

      const ledgerWarehouseConditions: SQL[] = [sql`sl.organization_id = ${organizationId}`];
      if (query.warehouseId) {
        ledgerWarehouseConditions.push(sql`sl.warehouse_id = ${query.warehouseId}`);
      }
      if (query.categoryId) {
        ledgerWarehouseConditions.push(sql`p.category_id = ${query.categoryId}`);
      }
      const ledgerWarehouseWhere = sql.join(ledgerWarehouseConditions, sql` and `);

      const deviceWarehouseConditions: SQL[] = [
        sql`d.organization_id = ${organizationId}`,
        sql`d.status = 'in_stock'`,
      ];
      if (query.warehouseId) {
        deviceWarehouseConditions.push(sql`d.warehouse_id = ${query.warehouseId}`);
      }
      if (query.categoryId) {
        deviceWarehouseConditions.push(sql`p.category_id = ${query.categoryId}`);
      }
      const deviceWarehouseWhere = sql.join(deviceWarehouseConditions, sql` and `);

      const warehouseRows = resultRows<WarehouseRow>(
        await tx.execute(sql`
          select w.id as warehouse_id, w.code, w.name,
                 coalesce(l.on_hand, 0)::text as on_hand,
                 coalesce(l.reserved, 0)::text as reserved,
                 coalesce(l.available, 0)::text as available,
                 (coalesce(l.purchase_value_minor, 0)
                   + coalesce(d.purchase_value_minor, 0))::text as purchase_value_minor,
                 (coalesce(l.sale_value_minor, 0)
                   + coalesce(d.sale_value_minor, 0))::text as sale_value_minor,
                 coalesce(d.serialized_in_stock, 0)::int as serialized_in_stock
          from public.warehouses w
          left join (
            select sl.warehouse_id,
                   sum(sl.on_hand) as on_hand,
                   sum(sl.reserved) as reserved,
                   sum(sl.available) as available,
                   sum(round(sl.on_hand * p.purchase_price_minor)) as purchase_value_minor,
                   sum(round(sl.on_hand * p.sale_price_minor)) as sale_value_minor
            from public.stock_levels sl
            join public.products p
              on p.id = sl.product_id and p.organization_id = sl.organization_id
            where ${ledgerWarehouseWhere}
            group by sl.warehouse_id
          ) l on l.warehouse_id = w.id
          left join (
            select d.warehouse_id,
                   count(*)::int as serialized_in_stock,
                   sum(round(p.purchase_price_minor)) as purchase_value_minor,
                   sum(round(p.sale_price_minor)) as sale_value_minor
            from public.devices d
            join public.products p
              on p.id = d.product_id and p.organization_id = d.organization_id
            where ${deviceWarehouseWhere}
            group by d.warehouse_id
          ) d on d.warehouse_id = w.id
          where ${warehouseWhere}
          order by w.code, w.name
        `),
      );

      return reportOverviewSchema.parse({
        generatedAt: new Date().toISOString(),
        window: { from: from.toISOString(), to: to.toISOString() },
        totals: {
          onHand: toNumber(ledgerTotals?.on_hand ?? 0),
          reserved: toNumber(ledgerTotals?.reserved ?? 0),
          available: toNumber(ledgerTotals?.available ?? 0),
          productCount: Number(ledgerTotals?.product_count ?? 0),
          locationCount: Number(ledgerTotals?.location_count ?? 0),
          warehouseCount: Number(ledgerTotals?.warehouse_count ?? 0),
          serializedInStock: Number(deviceTotals?.serialized_in_stock ?? 0),
        },
        valuation: {
          purchaseValueMinor:
            Number(ledgerTotals?.purchase_value_minor ?? 0) +
            Number(deviceTotals?.purchase_value_minor ?? 0),
          saleValueMinor:
            Number(ledgerTotals?.sale_value_minor ?? 0) +
            Number(deviceTotals?.sale_value_minor ?? 0),
          unpricedProductCount:
            Number(ledgerTotals?.unpriced_product_count ?? 0) +
            Number(deviceTotals?.unpriced_product_count ?? 0),
        },
        movements: {
          count: Number(movementTotals?.count ?? 0),
          receivedQuantity: toNumber(movementTotals?.received_quantity ?? 0),
          issuedQuantity: toNumber(movementTotals?.issued_quantity ?? 0),
          adjustedQuantity: toNumber(movementTotals?.adjusted_quantity ?? 0),
          netQuantity: toNumber(movementTotals?.net_quantity ?? 0),
        },
        series: seriesRows.map((row) => ({
          date: row.date,
          receivedQuantity: toNumber(row.received_quantity),
          issuedQuantity: toNumber(row.issued_quantity),
          netQuantity: toNumber(row.net_quantity),
        })),
        warehouses: warehouseRows.map((row) => ({
          warehouseId: row.warehouse_id,
          code: row.code,
          name: row.name,
          onHand: toNumber(row.on_hand),
          reserved: toNumber(row.reserved),
          available: toNumber(row.available),
          purchaseValueMinor: Number(row.purchase_value_minor),
          saleValueMinor: Number(row.sale_value_minor),
          serializedInStock: Number(row.serialized_in_stock),
        })),
      });
    });
  }

  async lowStock(
    userId: string,
    organizationId: string,
    query: LowStockQuery,
  ): Promise<LowStockResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const ledgerConditions: SQL[] = [sql`sl.organization_id = ${organizationId}`];
      if (query.warehouseId) {
        ledgerConditions.push(sql`sl.warehouse_id = ${query.warehouseId}`);
      }
      const ledgerWhere = sql.join(ledgerConditions, sql` and `);

      const deviceConditions: SQL[] = [
        sql`d.organization_id = ${organizationId}`,
        sql`d.status = 'in_stock'`,
      ];
      if (query.warehouseId) {
        deviceConditions.push(sql`d.warehouse_id = ${query.warehouseId}`);
      }
      const deviceWhere = sql.join(deviceConditions, sql` and `);

      const productConditions: SQL[] = [
        sql`p.organization_id = ${organizationId}`,
        sql`p.status = 'active'`,
        sql`p.reorder_threshold > 0`,
      ];
      if (query.categoryId) {
        productConditions.push(sql`p.category_id = ${query.categoryId}`);
      }
      const productWhere = sql.join(productConditions, sql` and `);

      const offset = (query.page - 1) * query.pageSize;

      const rows = resultRows<LowStockRow>(
        await tx.execute(sql`
          with ledger as (
            select sl.product_id,
                   sum(sl.on_hand) as on_hand,
                   sum(sl.reserved) as reserved,
                   sum(sl.available) as available
            from public.stock_levels sl
            where ${ledgerWhere}
            group by sl.product_id
          ),
          device_stock as (
            select d.product_id, count(*)::int as on_hand
            from public.devices d
            where ${deviceWhere}
            group by d.product_id
          ),
          stock as (
            select p.id as product_id, p.sku, p.name as product_name,
                   c.name as category_name, p.is_serialized, p.reorder_threshold,
                   case when p.is_serialized then coalesce(ds.on_hand, 0)
                        else coalesce(l.on_hand, 0) end as on_hand,
                   case when p.is_serialized then 0
                        else coalesce(l.reserved, 0) end as reserved,
                   case when p.is_serialized then coalesce(ds.on_hand, 0)
                        else coalesce(l.available, 0) end as available
            from public.products p
            left join public.categories c
              on c.id = p.category_id and c.organization_id = p.organization_id
            left join ledger l on l.product_id = p.id
            left join device_stock ds on ds.product_id = p.id
            where ${productWhere}
          )
          select product_id, sku, product_name, category_name, is_serialized,
                 reorder_threshold, on_hand, reserved, available,
                 (reorder_threshold - available) as shortfall,
                 count(*) over ()::int as total
          from stock
          where available < reorder_threshold
          order by shortfall desc, lower(product_name), product_id
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return lowStockResponseSchema.parse({
        items: rows.map((row) => ({
          productId: row.product_id,
          sku: row.sku,
          productName: row.product_name,
          categoryName: row.category_name,
          isSerialized: row.is_serialized,
          reorderThreshold: toNumber(row.reorder_threshold),
          onHand: toNumber(row.on_hand),
          reserved: toNumber(row.reserved),
          available: toNumber(row.available),
          shortfall: toNumber(row.shortfall),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: Number(rows[0]?.total ?? 0),
      });
    });
  }

  async supplierPerformance(
    userId: string,
    organizationId: string,
    query: SupplierPerformanceQuery,
  ): Promise<SupplierPerformanceResponse> {
    const to = query.to ?? new Date().toISOString().slice(0, 10);
    const from =
      query.from ??
      new Date(Date.parse(`${to}T00:00:00Z`) - (SUPPLIER_WINDOW_DAYS - 1) * DAY_MS)
        .toISOString()
        .slice(0, 10);

    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const supplierFilter = query.supplierId ? sql`and s.id = ${query.supplierId}` : sql``;

      const rows = resultRows<SupplierPerformanceRow>(
        await tx.execute(sql`
          with order_lines as (
            select l.purchase_order_id,
                   sum(l.quantity_ordered * coalesce(l.unit_cost_minor, 0))
                     as ordered_value_minor,
                   sum(l.quantity_received * coalesce(l.unit_cost_minor, 0))
                     as received_value_minor,
                   sum(l.quantity_received) as received_quantity
            from public.purchase_order_lines l
            where l.organization_id = ${organizationId}
            group by l.purchase_order_id
          ),
          orders as (
            select o.supplier_id, o.status, o.created_at, o.ordered_at, o.received_at,
                   o.expected_on, ov.ordered_value_minor, ov.received_value_minor,
                   ov.received_quantity
            from public.purchase_orders o
            left join order_lines ov on ov.purchase_order_id = o.id
            where o.organization_id = ${organizationId}
          ),
          order_agg as (
            select supplier_id,
                   count(*) filter (
                     where created_at >= ${from}::date and created_at < (${to}::date + 1)
                   )::int as orders_created,
                   count(*) filter (
                     where received_at >= ${from}::date and received_at < (${to}::date + 1)
                   )::int as orders_received,
                   coalesce(sum(ordered_value_minor) filter (
                     where created_at >= ${from}::date and created_at < (${to}::date + 1)
                   ), 0)::text as ordered_value_minor,
                   coalesce(sum(received_value_minor) filter (
                     where received_at >= ${from}::date and received_at < (${to}::date + 1)
                   ), 0)::text as received_value_minor,
                   coalesce(sum(received_quantity) filter (
                     where received_at >= ${from}::date and received_at < (${to}::date + 1)
                   ), 0)::text as received_quantity,
                   count(*) filter (
                     where status = 'received' and expected_on is not null
                       and received_at >= ${from}::date
                       and received_at < (${to}::date + 1)
                   )::int as expected_orders,
                   count(*) filter (
                     where status = 'received' and expected_on is not null
                       and received_at >= ${from}::date
                       and received_at < (${to}::date + 1)
                       and received_at::date <= expected_on
                   )::int as on_time_orders,
                   avg(
                     extract(epoch from (received_at - ordered_at)) / 86400
                   ) filter (
                     where status = 'received' and ordered_at is not null
                       and received_at >= ${from}::date
                       and received_at < (${to}::date + 1)
                   ) as average_lead_time_days
            from orders
            group by supplier_id
          ),
          returns as (
            select r.supplier_id, sum(rl.quantity)::text as returned_quantity
            from public.purchase_returns r
            join public.purchase_return_lines rl
              on rl.purchase_return_id = r.id and rl.organization_id = r.organization_id
            where r.organization_id = ${organizationId}
              and r.status = 'posted'
              and r.posted_at >= ${from}::date
              and r.posted_at < (${to}::date + 1)
            group by r.supplier_id
          )
          select s.id as supplier_id, s.name as supplier_name,
                 coalesce(a.orders_created, 0) as orders_created,
                 coalesce(a.orders_received, 0) as orders_received,
                 coalesce(a.expected_orders, 0) as expected_orders,
                 coalesce(a.on_time_orders, 0) as on_time_orders,
                 a.average_lead_time_days,
                 coalesce(a.ordered_value_minor, '0') as ordered_value_minor,
                 coalesce(a.received_value_minor, '0') as received_value_minor,
                 coalesce(a.received_quantity, '0') as received_quantity,
                 coalesce(r.returned_quantity, '0') as returned_quantity
          from public.suppliers s
          left join order_agg a on a.supplier_id = s.id
          left join returns r on r.supplier_id = s.id
          where s.organization_id = ${organizationId} ${supplierFilter}
          order by s.name, s.id
        `),
      );

      const suppliers = rows
        .map((row) => {
          const expectedOrders = Number(row.expected_orders);
          const onTimeOrders = Number(row.on_time_orders);
          const receivedQuantity = toNumber(row.received_quantity);
          const returnedQuantity = toNumber(row.returned_quantity);
          const averageLeadTime =
            row.average_lead_time_days === null ? null : toNumber(row.average_lead_time_days);

          return {
            supplierId: row.supplier_id,
            supplierName: row.supplier_name,
            ordersCreated: Number(row.orders_created),
            ordersReceived: Number(row.orders_received),
            onTimeOrders,
            lateOrders: expectedOrders - onTimeOrders,
            onTimeRate: expectedOrders > 0 ? onTimeOrders / expectedOrders : null,
            averageLeadTimeDays:
              averageLeadTime === null ? null : Math.round(averageLeadTime * 100) / 100,
            orderedValueMinor: toNumber(row.ordered_value_minor),
            receivedValueMinor: toNumber(row.received_value_minor),
            receivedQuantity,
            returnedQuantity,
            returnRate: receivedQuantity > 0 ? returnedQuantity / receivedQuantity : null,
          };
        })
        .filter(
          (row) => row.ordersCreated > 0 || row.ordersReceived > 0 || row.returnedQuantity > 0,
        );

      return supplierPerformanceResponseSchema.parse({
        generatedAt: new Date().toISOString(),
        window: { from, to },
        suppliers,
      });
    });
  }

  async exportStockLevels(
    userId: string,
    organizationId: string,
    query: StockLevelExportQuery,
  ): Promise<CsvExport> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`sl.organization_id = ${organizationId}`];
      if (query.warehouseId) {
        conditions.push(sql`sl.warehouse_id = ${query.warehouseId}`);
      }
      if (query.categoryId) {
        conditions.push(sql`p.category_id = ${query.categoryId}`);
      }
      if (query.search) {
        const pattern = `%${escapeLike(query.search)}%`;
        conditions.push(sql`(sl.sku ilike ${pattern} or sl.product_name ilike ${pattern})`);
      }
      const where = sql.join(conditions, sql` and `);

      const rows = resultRows<StockLevelExportRow>(
        await tx.execute(sql`
          select sl.sku, sl.product_name, sl.warehouse_code, sl.location_code,
                 sl.on_hand, sl.reserved, sl.available, sl.updated_at
          from public.stock_levels sl
          join public.products p
            on p.id = sl.product_id and p.organization_id = sl.organization_id
          where ${where}
          order by lower(sl.product_name), sl.warehouse_code, sl.location_code
          limit ${REPORT_EXPORT_ROW_LIMIT + 1}
        `),
      );

      if (rows.length > REPORT_EXPORT_ROW_LIMIT) {
        throw new AppError(
          'export_too_large',
          `The export exceeds ${REPORT_EXPORT_ROW_LIMIT} rows. Narrow the filters.`,
          422,
        );
      }

      return {
        filename: `nexora-stock-levels-${fileDate()}.csv`,
        body: csvDocument(
          [
            'sku',
            'product',
            'warehouse_code',
            'location_code',
            'on_hand',
            'reserved',
            'available',
            'updated_at',
          ],
          rows.map((row) => [
            row.sku,
            row.product_name,
            row.warehouse_code,
            row.location_code,
            row.on_hand,
            row.reserved,
            row.available,
            toIso(row.updated_at),
          ]),
        ),
      };
    });
  }

  async exportMovements(
    userId: string,
    organizationId: string,
    query: MovementExportQuery,
  ): Promise<CsvExport> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`m.organization_id = ${organizationId}`];
      if (query.warehouseId) {
        conditions.push(sql`m.warehouse_id = ${query.warehouseId}`);
      }
      if (query.categoryId) {
        conditions.push(sql`p.category_id = ${query.categoryId}`);
      }
      if (query.movementType) {
        conditions.push(sql`m.movement_type = ${query.movementType}::app.stock_movement_type`);
      }
      if (query.from) {
        conditions.push(sql`m.created_at >= ${query.from}::timestamptz`);
      }
      if (query.to) {
        conditions.push(sql`m.created_at <= ${query.to}::timestamptz`);
      }
      const where = sql.join(conditions, sql` and `);

      const rows = resultRows<MovementExportRow>(
        await tx.execute(sql`
          select m.created_at, m.movement_type, p.sku, p.name as product_name,
                 w.code as warehouse_code, l.code as location_code,
                 m.quantity_delta, m.on_hand_after, m.reference_type, m.reference_id,
                 m.reason, m.actor_id
          from public.stock_movements m
          join public.products p
            on p.id = m.product_id and p.organization_id = m.organization_id
          join public.warehouses w
            on w.id = m.warehouse_id and w.organization_id = m.organization_id
          join public.storage_locations l
            on l.id = m.location_id and l.organization_id = m.organization_id
            and l.warehouse_id = m.warehouse_id
          where ${where}
          order by m.created_at desc, m.id desc
          limit ${REPORT_EXPORT_ROW_LIMIT + 1}
        `),
      );

      if (rows.length > REPORT_EXPORT_ROW_LIMIT) {
        throw new AppError(
          'export_too_large',
          `The export exceeds ${REPORT_EXPORT_ROW_LIMIT} rows. Narrow the filters.`,
          422,
        );
      }

      return {
        filename: `nexora-stock-movements-${fileDate()}.csv`,
        body: csvDocument(
          [
            'created_at',
            'type',
            'sku',
            'product',
            'warehouse_code',
            'location_code',
            'quantity_delta',
            'on_hand_after',
            'reference_type',
            'reference_id',
            'reason',
            'actor_id',
          ],
          rows.map((row) => [
            toIso(row.created_at),
            row.movement_type,
            row.sku,
            row.product_name,
            row.warehouse_code,
            row.location_code,
            row.quantity_delta,
            row.on_hand_after,
            row.reference_type,
            row.reference_id,
            row.reason,
            row.actor_id,
          ]),
        ),
      };
    });
  }
}
