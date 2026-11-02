import { type SQL, sql } from 'drizzle-orm';

import { type MovementExportQuery, type StockLevelExportQuery } from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
import { csvDocument } from './csv';
import { escapeLike, fileDate, toIso } from './report.utils';

export const REPORT_EXPORT_ROW_LIMIT = 50_000;

export interface CsvExport {
  filename: string;
  body: Buffer;
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

function assertWithinLimit(rowCount: number): void {
  if (rowCount > REPORT_EXPORT_ROW_LIMIT) {
    throw new AppError(
      'export_too_large',
      `The export exceeds ${REPORT_EXPORT_ROW_LIMIT} rows. Narrow the filters.`,
      422,
    );
  }
}

export async function readStockLevelExport(
  tx: AppTransaction,
  organizationId: string,
  query: StockLevelExportQuery,
): Promise<CsvExport> {
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

  assertWithinLimit(rows.length);

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
}

export async function readMovementExport(
  tx: AppTransaction,
  organizationId: string,
  query: MovementExportQuery,
): Promise<CsvExport> {
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

  assertWithinLimit(rows.length);

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
}
