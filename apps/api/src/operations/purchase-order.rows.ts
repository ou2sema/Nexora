import { sql } from 'drizzle-orm';

import type { PurchaseOrderSummary, PurchaseReturnSummary } from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
import { toIso, toNullableIso, toNumber } from './operations.utils';

export interface PurchaseOrderRow {
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

export interface PurchaseOrderLineRow {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  is_serialized: boolean;
  is_individually_tracked: boolean;
  quantity_ordered: string;
  quantity_received: string;
  quantity_returned: string | number;
  unit_cost_minor: number | string | null;
}

export interface PurchaseReturnRow {
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

export interface PurchaseReturnLineRow {
  id: string;
  purchase_order_line_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  is_serialized: boolean;
  quantity: string;
  quantity_received: string;
}

export interface PurchaseReturnDeviceRow {
  purchase_return_line_id: string;
  device_id: string;
  serial_number: string;
}

export const ORDER_SELECT = sql`
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

export const RETURN_SELECT = sql`
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

export function toPurchaseOrderSummary(row: PurchaseOrderRow): PurchaseOrderSummary {
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

export function toPurchaseOrderLine(row: PurchaseOrderLineRow) {
  return {
    id: row.id,
    productId: row.product_id,
    productSku: row.product_sku,
    productName: row.product_name,
    isSerialized: row.is_serialized,
    isIndividuallyTracked: row.is_individually_tracked,
    quantityOrdered: toNumber(row.quantity_ordered),
    quantityReceived: toNumber(row.quantity_received),
    quantityReturned: toNumber(row.quantity_returned),
    unitCostMinor: row.unit_cost_minor === null ? null : Number(row.unit_cost_minor),
  };
}

export function toPurchaseReturnSummary(row: PurchaseReturnRow): PurchaseReturnSummary {
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

export function toPurchaseReturnLine(
  line: PurchaseReturnLineRow,
  devices: PurchaseReturnDeviceRow[],
) {
  return {
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
  };
}

export async function assertOrderExists(
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

export async function assertReturnBelongs(
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
