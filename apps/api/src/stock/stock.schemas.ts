import { z } from 'zod';

export const organizationParamsSchema = z.object({
  organizationId: z.uuid(),
});

export const reservationParamsSchema = organizationParamsSchema.extend({
  reservationId: z.uuid(),
});

export type OrganizationParams = z.infer<typeof organizationParamsSchema>;
export type ReservationParams = z.infer<typeof reservationParamsSchema>;
