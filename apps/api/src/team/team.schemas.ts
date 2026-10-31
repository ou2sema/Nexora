import { z } from 'zod';

export const organizationParamsSchema = z.object({
  organizationId: z.uuid(),
});

export const memberParamsSchema = organizationParamsSchema.extend({
  userId: z.uuid(),
});

export const invitationParamsSchema = organizationParamsSchema.extend({
  invitationId: z.uuid(),
});

export const invitationIdParamsSchema = z.object({
  invitationId: z.uuid(),
});

export type OrganizationParams = z.infer<typeof organizationParamsSchema>;
export type MemberParams = z.infer<typeof memberParamsSchema>;
export type InvitationParams = z.infer<typeof invitationParamsSchema>;
export type InvitationIdParams = z.infer<typeof invitationIdParamsSchema>;
