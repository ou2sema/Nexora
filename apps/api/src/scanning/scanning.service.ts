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
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
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

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

@Injectable()
export class ScanningService {
  constructor(private readonly access: TenantAccessService) {}

  /**
   * Resolves a scanned code in priority order: serialized device identity
   * first (serial, then IMEI), then product GTIN, SKU, and internal code.
   * A serial number or barcode can never silently resolve to the wrong entity
   * because lookup stops at the first tier that matches.
   */
  async scan(userId: string, organizationId: string, query: ScanQuery): Promise<ScanResult> {
    const code = query.code;

    return this.access.runAsMember(userId, organizationId, async (tx) => {
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

      const [product] = await tx
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
        product: toProductSummary(product as ProductRow),
        stockLines,
        totals: {
          onHand: stockLines.reduce((sum, line) => sum + line.onHand, 0),
          reserved: stockLines.reduce((sum, line) => sum + line.reserved, 0),
          available: stockLines.reduce((sum, line) => sum + line.available, 0),
        },
      });
    });
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
