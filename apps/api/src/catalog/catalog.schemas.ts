import { z } from 'zod';

export const organizationParamsSchema = z.object({
  organizationId: z.uuid(),
});

export const productParamsSchema = organizationParamsSchema.extend({
  productId: z.uuid(),
});

export const warehouseParamsSchema = organizationParamsSchema.extend({
  warehouseId: z.uuid(),
});

export type OrganizationParams = z.infer<typeof organizationParamsSchema>;
export type ProductParams = z.infer<typeof productParamsSchema>;
export type WarehouseParams = z.infer<typeof warehouseParamsSchema>;
