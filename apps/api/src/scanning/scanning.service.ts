import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import type {
  BarcodeAssignmentResult,
  ScanQuery,
  ScanResult,
  ScanStockLine,
} from '@mystock/contracts';
import {
  barcodeAssignmentResultSchema,
  scanResultSchema,
  scanStockLineSchema,
  trackedItemEventSchema,
  trackedItemSummarySchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { brands, categories, products } from '../database/schema';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so it cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';
import { toProductSummary, type ProductRow } from '../catalog/catalog.service';
import { DEVICE_SELECT, toDeviceSummary, type DeviceRow } from '../devices/devices.service';

interface ScanStockRow {
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  on_hand: string;
  reserved: string;
  available: string;
}

interface TrackedItemRow {
  id: string;
  organization_id: string;
  product_id: string;
  unit_code: string;
  serial_number: string | null;
  imei: string | null;
  status: string;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  purchase_order_number: string | null;
  received_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface TrackedItemEventRow {
  id: string;
  event_type: string;
  status_from: string | null;
  status_to: string | null;
  note: string | null;
  created_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

@Injectable()
export class ScanningService {
  constructor(private readonly access: TenantAccessService) {}

  /**
   * Resolves a scanned code in priority order: an individually tracked unit
   * first, then serialized device identity (serial, then IMEI), then product
   * GTIN, SKU, and internal code. A code can never silently resolve to the
   * wrong entity because lookup stops at the first tier that matches.
   */
  async scan(userId: string, organizationId: string, query: ScanQuery): Promise<ScanResult> {
    const code = query.code;

    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const trackedRows = resultRows<TrackedItemRow>(
        await tx.execute(sql`
          select t.id, t.organization_id, t.product_id, t.unit_code, t.serial_number, t.imei,
                 t.status, t.warehouse_id, w.code as warehouse_code, t.location_id,
                 l.code as location_code, o.number as purchase_order_number,
                 t.received_at, t.created_at, t.updated_at
          from public.tracked_items t
          join public.warehouses w
            on w.id = t.warehouse_id and w.organization_id = t.organization_id
          join public.storage_locations l
            on l.id = t.location_id and l.organization_id = t.organization_id
            and l.warehouse_id = t.warehouse_id
          left join public.purchase_orders o
            on o.id = t.purchase_order_id and o.organization_id = t.organization_id
          where t.organization_id = ${organizationId}
            and lower(t.unit_code) = lower(${code})
          limit 1
        `),
      );

      const trackedRow = trackedRows[0];
      if (trackedRow) {
        const product = await this.readProduct(tx, organizationId, trackedRow.product_id);
        if (!product) {
          throw new AppError('scan_not_found', 'No product or device matches this code.', 404);
        }

        const eventRows = resultRows<TrackedItemEventRow>(
          await tx.execute(sql`
            select id, event_type, status_from, status_to, note, created_at
            from public.tracked_item_events
            where organization_id = ${organizationId}
              and tracked_item_id = ${trackedRow.id}
            order by created_at, id
          `),
        );

        return scanResultSchema.parse({
          kind: 'tracked_item',
          item: trackedItemSummarySchema.parse({
            id: trackedRow.id,
            organizationId: trackedRow.organization_id,
            productId: trackedRow.product_id,
            productSku: product.product.sku,
            productName: product.product.name,
            unitCode: trackedRow.unit_code,
            serialNumber: trackedRow.serial_number,
            imei: trackedRow.imei,
            status: trackedRow.status,
            warehouseId: trackedRow.warehouse_id,
            warehouseCode: trackedRow.warehouse_code,
            locationId: trackedRow.location_id,
            locationCode: trackedRow.location_code,
            purchaseOrderNumber: trackedRow.purchase_order_number,
            receivedAt: toIso(trackedRow.received_at),
            createdAt: toIso(trackedRow.created_at),
            updatedAt: toIso(trackedRow.updated_at),
          }),
          product: toProductSummary(product),
          events: eventRows.map((row) =>
            trackedItemEventSchema.parse({
              id: row.id,
              eventType: row.event_type,
              statusFrom: row.status_from,
              statusTo: row.status_to,
              note: row.note,
              createdAt: toIso(row.created_at),
            }),
          ),
        });
      }

      const deviceRows = resultRows<DeviceRow>(
        await tx.execute(sql`
          ${DEVICE_SELECT}
          where d.organization_id = ${organizationId}
            and (lower(d.serial_number) = lower(${code}) or d.imei = ${code})
          limit 1
        `),
      );

      const deviceRow = deviceRows[0];
      if (deviceRow) {
        return scanResultSchema.parse({ kind: 'device', device: toDeviceSummary(deviceRow) });
      }

      const matches = resultRows<{ id: string }>(
        await tx.execute(sql`
          select p.id
          from public.products p
          where p.organization_id = ${organizationId}
            and (
              p.barcode = ${code}
              or lower(p.sku) = lower(${code})
              or lower(p.internal_code) = lower(${code})
            )
          order by case
                     when p.barcode = ${code} then 0
                     when lower(p.sku) = lower(${code}) then 1
                     else 2
                   end,
                   lower(p.name)
          limit 1
        `),
      );

      const productId = matches[0]?.id;
      if (!productId) {
        throw new AppError('scan_not_found', 'No product or device matches this code.', 404);
      }

      const product = await this.readProduct(tx, organizationId, productId);

      if (!product) {
        throw new AppError('scan_not_found', 'No product or device matches this code.', 404);
      }

      const stockRows = resultRows<ScanStockRow>(
        await tx.execute(sql`
          select warehouse_id, warehouse_code, location_id, location_code,
                 on_hand, reserved, available
          from public.stock_levels
          where organization_id = ${organizationId} and product_id = ${productId}
          order by warehouse_code, location_code
        `),
      );

      const stockLines: ScanStockLine[] = stockRows.map((row) =>
        scanStockLineSchema.parse({
          warehouseId: row.warehouse_id,
          warehouseCode: row.warehouse_code,
          locationId: row.location_id,
          locationCode: row.location_code,
          onHand: toNumber(row.on_hand),
          reserved: toNumber(row.reserved),
          available: toNumber(row.available),
        }),
      );

      return scanResultSchema.parse({
        kind: 'product',
        product: toProductSummary(product),
        stockLines,
        totals: {
          onHand: stockLines.reduce((sum, line) => sum + line.onHand, 0),
          reserved: stockLines.reduce((sum, line) => sum + line.reserved, 0),
          available: stockLines.reduce((sum, line) => sum + line.available, 0),
        },
      });
    });
  }

  private async readProduct(
    tx: AppTransaction,
    organizationId: string,
    productId: string,
  ): Promise<ProductRow | null> {
    const [row] = await tx
      .select({ product: products, categoryName: categories.name, brandName: brands.name })
      .from(products)
      .leftJoin(
        categories,
        and(
          eq(categories.id, products.categoryId),
          eq(categories.organizationId, products.organizationId),
        ),
      )
      .leftJoin(
        brands,
        and(eq(brands.id, products.brandId), eq(brands.organizationId, products.organizationId)),
      )
      .where(and(eq(products.organizationId, organizationId), eq(products.id, productId)))
      .limit(1);

    return row ?? null;
  }

  async assignBarcode(
    userId: string,
    organizationId: string,
    productId: string,
  ): Promise<BarcodeAssignmentResult> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.assign_product_barcode(
            ${organizationId}::uuid, ${productId}::uuid
          ) as barcode
        `);

        const [row] = resultRows<{ barcode: string }>(result);
        if (!row) {
          throw new AppError('internal_error', 'The barcode was not assigned.', 500);
        }

        return barcodeAssignmentResultSchema.parse({
          productId,
          barcode: row.barcode,
        });
      },
      { roles: CATALOG_WRITERS },
    );
  }
}
