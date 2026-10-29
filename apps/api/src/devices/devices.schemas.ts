import { z } from 'zod';

export const organizationParamsSchema = z.object({
  organizationId: z.uuid(),
});

export const deviceParamsSchema = organizationParamsSchema.extend({
  deviceId: z.uuid(),
});

export type OrganizationParams = z.infer<typeof organizationParamsSchema>;
export type DeviceParams = z.infer<typeof deviceParamsSchema>;
