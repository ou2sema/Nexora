import { type SQL, sql } from 'drizzle-orm';

import {
  type LowStockQuery,
  type LowStockResponse,
  lowStockResponseSchema,
} from '@mystock/contracts';

import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
import { toNumber } from './report.utils';

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

export async function readLowStock(
  tx: AppTransaction,
  organizationId: string,
  query: LowStockQuery,
): Promise<LowStockResponse> {
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
}
