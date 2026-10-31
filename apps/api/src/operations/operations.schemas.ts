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

export type OrganizationParams = z.infer<typeof organizationParamsSchema>;
export type SupplierParams = z.infer<typeof supplierParamsSchema>;
export type PurchaseOrderParams = z.infer<typeof purchaseOrderParamsSchema>;
export type SalesOrderParams = z.infer<typeof salesOrderParamsSchema>;
