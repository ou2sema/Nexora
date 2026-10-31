import { z } from 'zod';

export const adminOrganizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
  memberCount: z.number().int().nonnegative(),
  pendingInvitationCount: z.number().int().nonnegative(),
});

export type AdminOrganizationSummary = z.infer<typeof adminOrganizationSchema>;

export const adminOrganizationsResponseSchema = z.object({
  items: z.array(adminOrganizationSchema),
});

export type AdminOrganizationsResponse = z.infer<typeof adminOrganizationsResponseSchema>;
