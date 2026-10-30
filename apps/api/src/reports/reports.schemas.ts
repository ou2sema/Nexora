import { z } from 'zod';

export const organizationParamsSchema = z.object({
  organizationId: z.uuid(),
});

export type OrganizationParams = z.infer<typeof organizationParamsSchema>;
