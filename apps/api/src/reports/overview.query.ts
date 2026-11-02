import { type SQL, sql } from 'drizzle-orm';

import {
  type ReportOverview,
  type ReportOverviewQuery,
  reportOverviewSchema,
} from '@mystock/contracts';

import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
import { toNumber } from './report.utils';

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

export interface OverviewWindow {
  from: Date;
  to: Date;
  fromDate: string;
  toDate: string;
}

export async function readOverview(
  tx: AppTransaction,
  organizationId: string,
  query: ReportOverviewQuery,
  window: OverviewWindow,
): Promise<ReportOverview> {
  const { from, to, fromDate, toDate } = window;

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
        Number(ledgerTotals?.sale_value_minor ?? 0) + Number(deviceTotals?.sale_value_minor ?? 0),
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
}
