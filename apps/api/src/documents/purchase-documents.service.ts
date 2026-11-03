import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantAccessService } from '../tenancy/tenant-access.service';
import { toIso, toNullableIso, toNumber } from '../operations/operations.utils';
import {
  type SupplierDocumentInfo,
  buildPurchaseOrderDocument,
  buildPurchaseReturnDocument,
} from './purchase-document-model';
import { renderPurchaseDocument } from './purchase-documents.pdf';
import type { RenderedDocument } from './rendered-document';

interface OrganizationRow {
  name: string;
}

interface DocumentPartyColumns {
  warehouse_code: string;
  warehouse_name: string;
  location_code: string;
  location_name: string;
  supplier_name: string;
  supplier_contact_name: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  supplier_address_line: string | null;
  supplier_city: string | null;
  supplier_country_code: string | null;
  supplier_tax_id: string | null;
}

interface PurchaseOrderDocumentRow extends DocumentPartyColumns {
  number: string;
  status: string;
  reference: string | null;
  notes: string | null;
  expected_on: string | null;
  ordered_at: Date | string | null;
  created_at: Date | string;
}

interface PurchaseOrderDocumentLineRow {
  product_sku: string;
  product_name: string;
  quantity_ordered: string;
  unit_cost_minor: number | string | null;
}

interface PurchaseReturnDocumentRow extends DocumentPartyColumns {
  number: string;
  status: string;
  reason: string;
  reference: string | null;
  posted_at: Date | string | null;
  created_at: Date | string;
  purchase_order_number: string;
}

interface PurchaseReturnDocumentLineRow {
  id: string;
  product_sku: string;
  product_name: string;
  quantity: string;
  unit_cost_minor: number | string | null;
}

interface PurchaseReturnDeviceRow {
  purchase_return_line_id: string;
  serial_number: string;
}

function supplierOf(row: DocumentPartyColumns): SupplierDocumentInfo {
  return {
    name: row.supplier_name,
    contactName: row.supplier_contact_name,
    email: row.supplier_email,
    phone: row.supplier_phone,
    addressLine: row.supplier_address_line,
    city: row.supplier_city,
    countryCode: row.supplier_country_code,
    taxId: row.supplier_tax_id,
  };
}

@Injectable()
export class PurchaseDocumentsService {
  constructor(private readonly access: TenantAccessService) {}

  async purchaseOrderPdf(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
  ): Promise<RenderedDocument> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const organization = await this.organizationName(tx, organizationId);

      const rows = resultRows<PurchaseOrderDocumentRow>(
        await tx.execute(sql`
          select o.number, o.status, o.reference, o.notes, o.expected_on, o.ordered_at,
                 o.created_at,
                 w.code as warehouse_code, w.name as warehouse_name,
                 l.code as location_code, l.name as location_name,
                 s.name as supplier_name, s.contact_name as supplier_contact_name,
                 s.email as supplier_email, s.phone as supplier_phone,
                 s.address_line as supplier_address_line, s.city as supplier_city,
                 s.country_code as supplier_country_code, s.tax_id as supplier_tax_id
          from public.purchase_orders o
          join public.suppliers s
            on s.id = o.supplier_id and s.organization_id = o.organization_id
          join public.warehouses w
            on w.id = o.warehouse_id and w.organization_id = o.organization_id
          join public.storage_locations l
            on l.id = o.location_id and l.organization_id = o.organization_id
            and l.warehouse_id = o.warehouse_id
          where o.organization_id = ${organizationId} and o.id = ${purchaseOrderId}
        `),
      );

      const order = rows[0];
      if (!order) throw new AppError('purchase_order_not_found', 'Purchase order not found.', 404);

      const lines = resultRows<PurchaseOrderDocumentLineRow>(
        await tx.execute(sql`
          select p.sku as product_sku, p.name as product_name,
                 l.quantity_ordered, l.unit_cost_minor
          from public.purchase_order_lines l
          join public.products p
            on p.id = l.product_id and p.organization_id = l.organization_id
          where l.organization_id = ${organizationId} and l.purchase_order_id = ${purchaseOrderId}
          order by p.name, l.id
        `),
      );

      const document = buildPurchaseOrderDocument({
        organizationName: organization,
        order: {
          number: order.number,
          status: order.status,
          reference: order.reference,
          notes: order.notes,
          expectedOn: order.expected_on,
          orderedAt: toNullableIso(order.ordered_at),
          createdAt: toIso(order.created_at),
          warehouseCode: order.warehouse_code,
          warehouseName: order.warehouse_name,
          locationCode: order.location_code,
          locationName: order.location_name,
          supplier: supplierOf(order),
        },
        lines: lines.map((line) => ({
          productSku: line.product_sku,
          productName: line.product_name,
          quantityOrdered: toNumber(line.quantity_ordered),
          unitCostMinor: line.unit_cost_minor === null ? null : Number(line.unit_cost_minor),
        })),
      });

      return { pdf: await renderPurchaseDocument(document), fileName: document.fileName };
    });
  }

  async purchaseReturnPdf(
    userId: string,
    organizationId: string,
    purchaseOrderId: string,
    returnId: string,
  ): Promise<RenderedDocument> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const organization = await this.organizationName(tx, organizationId);

      const rows = resultRows<PurchaseReturnDocumentRow>(
        await tx.execute(sql`
          select r.number, r.status, r.reason, r.reference, r.posted_at, r.created_at,
                 o.number as purchase_order_number,
                 w.code as warehouse_code, w.name as warehouse_name,
                 l.code as location_code, l.name as location_name,
                 s.name as supplier_name, s.contact_name as supplier_contact_name,
                 s.email as supplier_email, s.phone as supplier_phone,
                 s.address_line as supplier_address_line, s.city as supplier_city,
                 s.country_code as supplier_country_code, s.tax_id as supplier_tax_id
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
          where r.organization_id = ${organizationId}
            and r.purchase_order_id = ${purchaseOrderId}
            and r.id = ${returnId}
        `),
      );

      const purchaseReturn = rows[0];
      if (!purchaseReturn) {
        throw new AppError('purchase_return_not_found', 'Purchase return not found.', 404);
      }

      const lines = resultRows<PurchaseReturnDocumentLineRow>(
        await tx.execute(sql`
          select rl.id, p.sku as product_sku, p.name as product_name,
                 rl.quantity, pol.unit_cost_minor
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
          select d.purchase_return_line_id, dev.serial_number
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

      const document = buildPurchaseReturnDocument({
        organizationName: organization,
        purchaseReturn: {
          number: purchaseReturn.number,
          status: purchaseReturn.status,
          reason: purchaseReturn.reason,
          reference: purchaseReturn.reference,
          postedAt: toNullableIso(purchaseReturn.posted_at),
          createdAt: toIso(purchaseReturn.created_at),
          purchaseOrderNumber: purchaseReturn.purchase_order_number,
          warehouseCode: purchaseReturn.warehouse_code,
          warehouseName: purchaseReturn.warehouse_name,
          locationCode: purchaseReturn.location_code,
          locationName: purchaseReturn.location_name,
          supplier: supplierOf(purchaseReturn),
        },
        lines: lines.map((line) => ({
          productSku: line.product_sku,
          productName: line.product_name,
          quantity: toNumber(line.quantity),
          unitCostMinor: line.unit_cost_minor === null ? null : Number(line.unit_cost_minor),
          serials: devices
            .filter((device) => device.purchase_return_line_id === line.id)
            .map((device) => device.serial_number),
        })),
      });

      return { pdf: await renderPurchaseDocument(document), fileName: document.fileName };
    });
  }

  private async organizationName(tx: AppTransaction, organizationId: string): Promise<string> {
    const rows = resultRows<OrganizationRow>(
      await tx.execute(sql`
        select name from public.organizations where id = ${organizationId}
      `),
    );
    return rows[0]?.name ?? '';
  }
}
