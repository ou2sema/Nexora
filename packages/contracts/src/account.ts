import { z } from 'zod';

export const memberRoleSchema = z.enum(['owner', 'admin', 'manager', 'viewer']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const membershipSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  role: memberRoleSchema,
});

export const meResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.string().nullable(),
    platformAdmin: z.boolean(),
  }),
  memberships: z.array(membershipSchema),
});

export type MembershipSummary = z.infer<typeof membershipSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  role: memberRoleSchema,
  createdAt: z.string(),
});

export type OrganizationSummary = z.infer<typeof organizationSchema>;

export const firstMemberRoleSchema = z.enum(['admin', 'manager', 'viewer']);
export type FirstMemberRole = z.infer<typeof firstMemberRoleSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens')
    .max(60)
    .optional(),
  firstMemberEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
  firstMemberRole: firstMemberRoleSchema.optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
