import { type SQL, sql } from 'drizzle-orm';

import {
  type OrderCancelInput,
  type PurchaseReturnCreateInput,
  type PurchaseReturnDetail,
  type PurchaseReturnListResponse,
  type ReturnCancelResult,
  type ReturnCreateResult,
  type ReturnListQuery,
  type ReturnPostResult,
  purchaseReturnDetailSchema,
  purchaseReturnListResponseSchema,
  returnCancelResultSchema,
  returnCreateResultSchema,
  returnPostResultSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { fingerprintOf } from '../common/idempotency';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
import { parseResult } from './operations.utils';
import {
  RETURN_SELECT,
  assertOrderExists,
  assertReturnBelongs,
  toPurchaseReturnLine,
  toPurchaseReturnSummary,
  type PurchaseReturnDeviceRow,
  type PurchaseReturnLineRow,
  type PurchaseReturnRow,
} from './purchase-order.rows';

export async function readPurchaseReturnList(
  tx: AppTransaction,
  organizationId: string,
  purchaseOrderId: string,
  query: ReturnListQuery,
): Promise<PurchaseReturnListResponse> {
  await assertOrderExists(tx, organizationId, purchaseOrderId);

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
}

export async function readPurchaseReturnDetail(
  tx: AppTransaction,
  organizationId: string,
  purchaseOrderId: string,
  returnId: string,
): Promise<PurchaseReturnDetail> {
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
    lines: lines.map((line) => toPurchaseReturnLine(line, devices)),
  });
}

export async function insertPurchaseReturn(
  tx: AppTransaction,
  organizationId: string,
  purchaseOrderId: string,
  key: string,
  input: PurchaseReturnCreateInput,
): Promise<ReturnCreateResult> {
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
}

export async function postPurchaseReturn(
  tx: AppTransaction,
  organizationId: string,
  purchaseOrderId: string,
  returnId: string,
  key: string,
): Promise<ReturnPostResult> {
  await assertReturnBelongs(tx, organizationId, purchaseOrderId, returnId);

  const result = await tx.execute(sql`
    select app.post_purchase_return(
      ${organizationId}::uuid, ${returnId}::uuid, ${key},
      ${fingerprintOf({ purchaseOrderId, returnId })}
    ) as result
  `);

  const [row] = resultRows<{ result: unknown }>(result);
  return parseResult(returnPostResultSchema, row?.result);
}

export async function cancelPurchaseReturn(
  tx: AppTransaction,
  organizationId: string,
  purchaseOrderId: string,
  returnId: string,
  key: string,
  input: OrderCancelInput,
): Promise<ReturnCancelResult> {
  await assertReturnBelongs(tx, organizationId, purchaseOrderId, returnId);

  const result = await tx.execute(sql`
    select app.cancel_purchase_return(
      ${organizationId}::uuid, ${returnId}::uuid, ${key},
      ${fingerprintOf({ purchaseOrderId, returnId, ...input })}, ${input.reason ?? null}
    ) as result
  `);

  const [row] = resultRows<{ result: unknown }>(result);
  return parseResult(returnCancelResultSchema, row?.result);
}
