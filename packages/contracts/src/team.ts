import { z } from 'zod';

import { memberRoleSchema } from './account';

export const teamMemberSchema = z.object({
  userId: z.uuid(),
  email: z.string().nullable(),
  role: memberRoleSchema,
  joinedAt: z.string(),
});

export type TeamMemberSummary = z.infer<typeof teamMemberSchema>;

export const teamMembersResponseSchema = z.object({
  items: z.array(teamMemberSchema),
});

export type TeamMembersResponse = z.infer<typeof teamMembersResponseSchema>;

export const changeMemberRoleSchema = z.object({
  role: memberRoleSchema,
});

export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

export const invitationRoleSchema = z.enum(['admin', 'manager', 'viewer']);
export type InvitationRole = z.infer<typeof invitationRoleSchema>;

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  role: invitationRoleSchema,
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const invitationStatusSchema = z.enum(['pending', 'expired', 'accepted', 'revoked']);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const invitationSummarySchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: memberRoleSchema,
  status: invitationStatusSchema,
  invitedByEmail: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type InvitationSummary = z.infer<typeof invitationSummarySchema>;

export const invitationListResponseSchema = z.object({
  items: z.array(invitationSummarySchema),
});

export type InvitationListResponse = z.infer<typeof invitationListResponseSchema>;

export const pendingInvitationSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  role: memberRoleSchema,
  expiresAt: z.string(),
});

export type PendingInvitation = z.infer<typeof pendingInvitationSchema>;

export const pendingInvitationsResponseSchema = z.object({
  items: z.array(pendingInvitationSchema),
});

export type PendingInvitationsResponse = z.infer<typeof pendingInvitationsResponseSchema>;
