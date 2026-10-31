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

export const adminAuditEventSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  actorId: z.uuid().nullable(),
  actorEmail: z.string().nullable(),
  organizationId: z.uuid().nullable(),
  organizationName: z.string().nullable(),
  targetUserId: z.uuid().nullable(),
  targetEmail: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export type AdminAuditEvent = z.infer<typeof adminAuditEventSchema>;

export const adminAuditResponseSchema = z.object({
  items: z.array(adminAuditEventSchema),
});

export type AdminAuditResponse = z.infer<typeof adminAuditResponseSchema>;

export const adminAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
