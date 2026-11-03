import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantAccessService } from '../tenancy/tenant-access.service';
import { readStoredLogo } from '../logos/logo.reader';
import { toIso, toNumber } from '../operations/operations.utils';
import {
  type CustomerDocumentInfo,
  type SalesInvoiceDocumentInput,
  buildIssueNoteDocument,
  buildSalesInvoiceDocument,
} from './sales-document-model';
import { renderSalesDocument } from './sales-documents.pdf';
import type { RenderedDocument } from './rendered-document';

interface InvoiceDocumentRow {
  number: string;
  issued_at: Date | string;
  sales_order_number: string | null;
  order_status: string | null;
  reference: string | null;
  notes: string | null;
  payment_status: string;
  payment_method: string | null;
  net_amount_minor: number | string;
  tax_amount_minor: number | string;
  total_amount_minor: number | string;
  paid_amount_minor: number | string;
  remaining_amount_minor: number | string;
  created_by_email: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  address_line: string | null;
  city: string | null;
  country_code: string | null;
  tax_id: string | null;
  warehouse_code: string;
  warehouse_name: string;
  location_code: string;
  location_name: string;
}

interface InvoiceDocumentLineRow {
  product_sku: string;
  product_name: string;
  quantity: string | number;
  unit_price_minor: number | string;
  tax_rate_percent: string | number;
  net_amount_minor: number | string;
  tax_amount_minor: number | string;
  serial_number: string | null;
}

interface InvoiceDocumentPaymentRow {
  amount_minor: number | string;
  method: string;
  note: string | null;
  recorded_at: Date | string;
  recorded_by_email: string | null;
}

const INVOICE_DOCUMENT_SELECT = sql`
  select i.number, i.issued_at, i.payment_status, i.payment_method, i.reference, i.notes,
         i.net_amount_minor, i.tax_amount_minor, i.total_amount_minor, i.paid_amount_minor,
         i.total_amount_minor - i.paid_amount_minor as remaining_amount_minor,
         i.customer_id, i.customer_name, i.customer_email, i.customer_phone,
         so.number as sales_order_number, so.status as order_status,
         c.address_line, c.city, c.country_code, c.tax_id,
         u.email as created_by_email,
         w.code as warehouse_code, w.name as warehouse_name,
         l.code as location_code, l.name as location_name
  from public.sales_invoices i
  join public.warehouses w
    on w.id = i.warehouse_id and w.organization_id = i.organization_id
  join public.storage_locations l
    on l.id = i.location_id and l.organization_id = i.organization_id
    and l.warehouse_id = i.warehouse_id
  left join public.sales_orders so
    on so.id = i.sales_order_id and so.organization_id = i.organization_id
  left join public.customers c
    on c.id = i.customer_id and c.organization_id = i.organization_id
  left join public.profiles u on u.id = i.created_by
`;

function customerOf(row: InvoiceDocumentRow): CustomerDocumentInfo {
  // A counter sale to a walk-in customer only has the details typed at the time of
  // the sale; a linked customer adds the address and tax identifiers.
  return {
    name: row.customer_name,
    email: row.customer_email,
    phone: row.customer_phone,
    addressLine: row.address_line,
    city: row.city,
    countryCode: row.country_code,
    taxId: row.tax_id,
  };
}

@Injectable()
export class SalesDocumentsService {
  constructor(private readonly access: TenantAccessService) {}

  async invoicePdf(
    userId: string,
    organizationId: string,
    invoiceId: string,
  ): Promise<RenderedDocument> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const organizationName = await this.organizationName(tx, organizationId);
      const logo = await readStoredLogo(tx, organizationId);
      const invoice = await this.findInvoice(tx, organizationId, invoiceId);
      const lines = await this.lines(tx, organizationId, invoiceId);
      const payments = await this.payments(tx, organizationId, invoiceId);

      const document = buildSalesInvoiceDocument({
        organizationName,
        invoice: {
          number: invoice.number,
          paymentStatus: invoice.payment_status,
          paymentMethod: invoice.payment_method,
          issuedAt: toIso(invoice.issued_at),
          salesOrderNumber: invoice.sales_order_number,
          reference: invoice.reference,
          notes: invoice.notes,
          netAmountMinor: toNumber(invoice.net_amount_minor),
          taxAmountMinor: toNumber(invoice.tax_amount_minor),
          totalAmountMinor: toNumber(invoice.total_amount_minor),
          paidAmountMinor: toNumber(invoice.paid_amount_minor),
          remainingAmountMinor: toNumber(invoice.remaining_amount_minor),
          createdByEmail: invoice.created_by_email,
          warehouseCode: invoice.warehouse_code,
          warehouseName: invoice.warehouse_name,
          locationCode: invoice.location_code,
          locationName: invoice.location_name,
          customer: customerOf(invoice),
        },
        lines: lines.map(toDocumentLine),
        payments: payments.map((payment) => ({
          amountMinor: toNumber(payment.amount_minor),
          method: payment.method,
          note: payment.note,
          recordedByEmail: payment.recorded_by_email,
          recordedAt: toIso(payment.recorded_at),
        })),
      });

      return { pdf: await renderSalesDocument(document, logo), fileName: document.fileName };
    });
  }

  async issueNotePdf(
    userId: string,
    organizationId: string,
    invoiceId: string,
  ): Promise<RenderedDocument> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const organizationName = await this.organizationName(tx, organizationId);
      const logo = await readStoredLogo(tx, organizationId);
      const invoice = await this.findInvoice(tx, organizationId, invoiceId);
      const lines = await this.lines(tx, organizationId, invoiceId);

      const document = buildIssueNoteDocument({
        organizationName,
        invoice: {
          number: invoice.number,
          orderStatus: invoice.order_status,
          issuedAt: toIso(invoice.issued_at),
          salesOrderNumber: invoice.sales_order_number,
          reference: invoice.reference,
          notes: invoice.notes,
          createdByEmail: invoice.created_by_email,
          warehouseCode: invoice.warehouse_code,
          warehouseName: invoice.warehouse_name,
          locationCode: invoice.location_code,
          locationName: invoice.location_name,
          customer: customerOf(invoice),
        },
        lines: lines.map(toDocumentLine),
      });

      return { pdf: await renderSalesDocument(document, logo), fileName: document.fileName };
    });
  }

  private async findInvoice(
    tx: AppTransaction,
    organizationId: string,
    invoiceId: string,
  ): Promise<InvoiceDocumentRow> {
    const rows = resultRows<InvoiceDocumentRow>(
      await tx.execute(sql`
        ${INVOICE_DOCUMENT_SELECT}
        where i.organization_id = ${organizationId} and i.id = ${invoiceId}
      `),
    );

    const invoice = rows[0];
    if (!invoice) {
      throw new AppError('sales_invoice_not_found', 'Sales invoice not found.', 404);
    }

    return invoice;
  }

  private async lines(
    tx: AppTransaction,
    organizationId: string,
    invoiceId: string,
  ): Promise<InvoiceDocumentLineRow[]> {
    return resultRows<InvoiceDocumentLineRow>(
      await tx.execute(sql`
        select p.sku as product_sku, p.name as product_name, il.quantity, il.unit_price_minor,
               il.tax_rate_percent, il.net_amount_minor, il.tax_amount_minor, d.serial_number
        from public.sales_invoice_lines il
        join public.products p
          on p.id = il.product_id and p.organization_id = il.organization_id
        left join public.devices d
          on d.id = il.device_id and d.organization_id = il.organization_id
        where il.organization_id = ${organizationId} and il.sales_invoice_id = ${invoiceId}
        order by p.name, il.id
      `),
    );
  }

  private async payments(
    tx: AppTransaction,
    organizationId: string,
    invoiceId: string,
  ): Promise<InvoiceDocumentPaymentRow[]> {
    return resultRows<InvoiceDocumentPaymentRow>(
      await tx.execute(sql`
        select pm.amount_minor, pm.method, pm.note, pm.recorded_at, u.email as recorded_by_email
        from public.sales_invoice_payments pm
        left join public.profiles u on u.id = pm.recorded_by
        where pm.organization_id = ${organizationId} and pm.sales_invoice_id = ${invoiceId}
        order by pm.recorded_at, pm.id
      `),
    );
  }

  private async organizationName(tx: AppTransaction, organizationId: string): Promise<string> {
    const rows = resultRows<{ name: string }>(
      await tx.execute(sql`
        select name from public.organizations where id = ${organizationId}
      `),
    );
    return rows[0]?.name ?? '';
  }
}

function toDocumentLine(line: InvoiceDocumentLineRow): SalesInvoiceDocumentInput['lines'][number] {
  return {
    productSku: line.product_sku,
    productName: line.product_name,
    quantity: toNumber(line.quantity),
    unitPriceMinor: toNumber(line.unit_price_minor),
    taxRatePercent: toNumber(line.tax_rate_percent),
    netAmountMinor: toNumber(line.net_amount_minor),
    taxAmountMinor: toNumber(line.tax_amount_minor),
    serialNumber: line.serial_number,
  };
}
