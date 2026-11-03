import { z } from 'zod';

export const organizationParamsSchema = z.object({
  organizationId: z.uuid(),
});

export const supplierParamsSchema = organizationParamsSchema.extend({
  supplierId: z.uuid(),
});

export const purchaseOrderParamsSchema = organizationParamsSchema.extend({
  purchaseOrderId: z.uuid(),
});

export const salesOrderParamsSchema = organizationParamsSchema.extend({
  salesOrderId: z.uuid(),
});

export const purchaseReturnParamsSchema = purchaseOrderParamsSchema.extend({
  returnId: z.uuid(),
});

export const salesReturnParamsSchema = salesOrderParamsSchema.extend({
  returnId: z.uuid(),
});

export const customerParamsSchema = organizationParamsSchema.extend({
  customerId: z.uuid(),
});

export const salesInvoiceParamsSchema = organizationParamsSchema.extend({
  invoiceId: z.uuid(),
});

export type OrganizationParams = z.infer<typeof organizationParamsSchema>;
export type SupplierParams = z.infer<typeof supplierParamsSchema>;
export type PurchaseOrderParams = z.infer<typeof purchaseOrderParamsSchema>;
export type SalesOrderParams = z.infer<typeof salesOrderParamsSchema>;
export type PurchaseReturnParams = z.infer<typeof purchaseReturnParamsSchema>;
export type SalesReturnParams = z.infer<typeof salesReturnParamsSchema>;
export type CustomerParams = z.infer<typeof customerParamsSchema>;
export type SalesInvoiceParams = z.infer<typeof salesInvoiceParamsSchema>;
