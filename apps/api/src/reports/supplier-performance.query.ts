import { sql } from 'drizzle-orm';

import {
  type SupplierPerformanceQuery,
  type SupplierPerformanceResponse,
  supplierPerformanceResponseSchema,
} from '@mystock/contracts';

import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
import { toNumber } from './report.utils';

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

export async function readSupplierPerformance(
  tx: AppTransaction,
  organizationId: string,
  query: SupplierPerformanceQuery,
  window: { from: string; to: string },
): Promise<SupplierPerformanceResponse> {
  const { from, to } = window;
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
    .filter((row) => row.ordersCreated > 0 || row.ordersReceived > 0 || row.returnedQuantity > 0);

  return supplierPerformanceResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    window: { from, to },
    suppliers,
  });
}
