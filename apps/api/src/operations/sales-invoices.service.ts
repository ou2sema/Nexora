import { Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';

import {
  type SalesInvoiceCreateInput,
  type SalesInvoiceCreateResult,
  type SalesInvoiceDetail,
  type SalesInvoiceListQuery,
  type SalesInvoiceListResponse,
  type SalesInvoicePaymentCreateInput,
  type SalesInvoicePaymentResult,
  type SalesInvoiceSummary,
  salesInvoiceCreateResultSchema,
  salesInvoiceDetailSchema,
  salesInvoiceListResponseSchema,
  salesInvoicePaymentResultSchema,
  salesInvoiceSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { fingerprintOf, requireIdempotencyKey } from '../common/idempotency';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so it cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';
import { parseResult, toIso, toNumber } from './operations.utils';

interface SalesInvoiceRow {
  id: string;
  organization_id: string;
  number: string;
  sales_order_id: string | null;
  sales_order_number: string | null;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  net_amount_minor: number | string;
  tax_amount_minor: number | string;
  total_amount_minor: number | string;
  paid_amount_minor: number | string;
  remaining_amount_minor: number | string;
  payment_status: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  line_count: number | string;
  total_quantity: string | number;
  issued_at: Date | string;
  created_by_email: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SalesInvoiceLineRow {
  id: string;
  kind: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  device_id: string | null;
  serial_number: string | null;
  quantity: string | number;
  unit_price_minor: number | string;
  tax_rate_percent: string | number;
  net_amount_minor: number | string;
  tax_amount_minor: number | string;
}

interface SalesInvoicePaymentRow {
  id: string;
  amount_minor: number | string;
  method: string;
  note: string | null;
  recorded_at: Date | string;
  recorded_by_email: string | null;
}

const INVOICE_SELECT = sql`
  select i.id, i.organization_id, i.number, i.sales_order_id, so.number as sales_order_number,
         i.warehouse_id, w.code as warehouse_code, i.location_id, l.code as location_code,
         i.customer_id, i.customer_name, i.customer_email, i.customer_phone,
         i.net_amount_minor, i.tax_amount_minor, i.total_amount_minor, i.paid_amount_minor,
         i.total_amount_minor - i.paid_amount_minor as remaining_amount_minor,
         i.payment_status, i.payment_method, i.reference, i.notes,
         coalesce(a.line_count, 0) as line_count, coalesce(a.total_quantity, 0) as total_quantity,
         i.issued_at, u.email as created_by_email, i.created_at, i.updated_at
  from public.sales_invoices i
  join public.warehouses w
    on w.id = i.warehouse_id and w.organization_id = i.organization_id
  join public.storage_locations l
    on l.id = i.location_id and l.organization_id = i.organization_id
    and l.warehouse_id = i.warehouse_id
  left join public.sales_orders so
    on so.id = i.sales_order_id and so.organization_id = i.organization_id
  left join public.profiles u on u.id = i.created_by
  left join (
    select sales_invoice_id, count(*) as line_count, sum(quantity) as total_quantity
    from public.sales_invoice_lines
    group by sales_invoice_id
  ) a on a.sales_invoice_id = i.id
`;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toSalesInvoiceSummary(row: SalesInvoiceRow): SalesInvoiceSummary {
  return salesInvoiceSchema.parse({
    id: row.id,
    organizationId: row.organization_id,
    number: row.number,
    salesOrderId: row.sales_order_id,
    salesOrderNumber: row.sales_order_number,
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouse_code,
    locationId: row.location_id,
    locationCode: row.location_code,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    netAmountMinor: toNumber(row.net_amount_minor),
    taxAmountMinor: toNumber(row.tax_amount_minor),
    totalAmountMinor: toNumber(row.total_amount_minor),
    paidAmountMinor: toNumber(row.paid_amount_minor),
    remainingAmountMinor: toNumber(row.remaining_amount_minor),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    reference: row.reference,
    notes: row.notes,
    lineCount: toNumber(row.line_count),
    totalQuantity: toNumber(row.total_quantity),
    issuedAt: toIso(row.issued_at),
    createdByEmail: row.created_by_email,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
}

@Injectable()
export class SalesInvoicesService {
  constructor(private readonly access: TenantAccessService) {}

  async list(
    userId: string,
    organizationId: string,
    query: SalesInvoiceListQuery,
  ): Promise<SalesInvoiceListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`i.organization_id = ${organizationId}`];

      if (query.paymentStatus) {
        conditions.push(sql`i.payment_status = ${query.paymentStatus}::app.payment_status`);
      }
      if (query.search) {
        const pattern = `%${escapeLike(query.search)}%`;
        conditions.push(
          sql`(i.number ilike ${pattern} or i.customer_name ilike ${pattern} or i.reference ilike ${pattern})`,
        );
      }

      const where = sql.join(conditions, sql` and `);
      const offset = (query.page - 1) * query.pageSize;

      const totals = resultRows<{ total: number }>(
        await tx.execute(sql`
          select count(*)::int as total
          from public.sales_invoices i
          join public.warehouses w
            on w.id = i.warehouse_id and w.organization_id = i.organization_id
          join public.storage_locations l
            on l.id = i.location_id and l.organization_id = i.organization_id
            and l.warehouse_id = i.warehouse_id
          where ${where}
        `),
      );

      const rows = resultRows<SalesInvoiceRow>(
        await tx.execute(sql`
          ${INVOICE_SELECT}
          where ${where}
          order by i.issued_at desc, i.id desc
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return salesInvoiceListResponseSchema.parse({
        items: rows.map(toSalesInvoiceSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: totals[0]?.total ?? 0,
      });
    });
  }

  async get(
    userId: string,
    organizationId: string,
    invoiceId: string,
  ): Promise<SalesInvoiceDetail> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const invoice = await this.findInvoice(tx, organizationId, invoiceId);

      const lines = resultRows<SalesInvoiceLineRow>(
        await tx.execute(sql`
          select il.id, il.kind, il.product_id, p.sku as product_sku, p.name as product_name,
                 il.device_id, d.serial_number, il.quantity, il.unit_price_minor,
                 il.tax_rate_percent, il.net_amount_minor, il.tax_amount_minor
          from public.sales_invoice_lines il
          join public.products p
            on p.id = il.product_id and p.organization_id = il.organization_id
          left join public.devices d
            on d.id = il.device_id and d.organization_id = il.organization_id
          where il.organization_id = ${organizationId} and il.sales_invoice_id = ${invoiceId}
          order by p.name, il.id
        `),
      );

      const payments = resultRows<SalesInvoicePaymentRow>(
        await tx.execute(sql`
          select pm.id, pm.amount_minor, pm.method, pm.note, pm.recorded_at,
                 u.email as recorded_by_email
          from public.sales_invoice_payments pm
          left join public.profiles u on u.id = pm.recorded_by
          where pm.organization_id = ${organizationId} and pm.sales_invoice_id = ${invoiceId}
          order by pm.recorded_at, pm.id
        `),
      );

      return salesInvoiceDetailSchema.parse({
        ...invoice,
        lines: lines.map((line) => ({
          id: line.id,
          kind: line.kind,
          productId: line.product_id,
          productSku: line.product_sku,
          productName: line.product_name,
          deviceId: line.device_id,
          serialNumber: line.serial_number,
          quantity: toNumber(line.quantity),
          unitPriceMinor: toNumber(line.unit_price_minor),
          taxRatePercent: toNumber(line.tax_rate_percent),
          netAmountMinor: toNumber(line.net_amount_minor),
          taxAmountMinor: toNumber(line.tax_amount_minor),
        })),
        payments: payments.map((payment) => ({
          id: payment.id,
          amountMinor: toNumber(payment.amount_minor),
          method: payment.method,
          note: payment.note,
          recordedAt: toIso(payment.recorded_at),
          recordedByEmail: payment.recorded_by_email,
        })),
      });
    });
  }

  async create(
    userId: string,
    organizationId: string,
    idempotencyKey: string | undefined,
    input: SalesInvoiceCreateInput,
  ): Promise<SalesInvoiceCreateResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.create_sales_invoice(
            ${organizationId}::uuid, ${input.warehouseId}::uuid, ${input.locationId}::uuid,
            ${JSON.stringify(input.lines)}::jsonb, ${key}, ${fingerprintOf(input)},
            ${input.customerId ?? null}::uuid, ${input.customerName ?? null},
            ${input.customerEmail ?? null}, ${input.customerPhone ?? null},
            ${input.paidAmountMinor}::bigint, ${input.paymentMethod}, ${input.paymentNote ?? null},
            ${input.reference ?? null}, ${input.notes ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(salesInvoiceCreateResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async addPayment(
    userId: string,
    organizationId: string,
    invoiceId: string,
    idempotencyKey: string | undefined,
    input: SalesInvoicePaymentCreateInput,
  ): Promise<SalesInvoicePaymentResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.record_sales_invoice_payment(
            ${organizationId}::uuid, ${invoiceId}::uuid, ${input.amountMinor}::bigint,
            ${input.method}, ${key}, ${fingerprintOf({ invoiceId, ...input })},
            ${input.note ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(salesInvoicePaymentResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  private async findInvoice(
    tx: AppTransaction,
    organizationId: string,
    invoiceId: string,
  ): Promise<SalesInvoiceSummary> {
    const rows = resultRows<SalesInvoiceRow>(
      await tx.execute(sql`
        ${INVOICE_SELECT}
        where i.organization_id = ${organizationId} and i.id = ${invoiceId}
      `),
    );

    const invoice = rows[0];
    if (!invoice) {
      throw new AppError('sales_invoice_not_found', 'Sales invoice not found.', 404);
    }

    return toSalesInvoiceSummary(invoice);
  }
}
