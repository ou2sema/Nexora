import { z } from 'zod';

export const memberRoleSchema = z.enum(['owner', 'admin', 'manager', 'viewer']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

/** The only image shapes `pdf-lib` can embed, so anything else is refused at the write. */
export const logoMimeTypeSchema = z.enum(['image/png', 'image/jpeg']);
export type LogoMimeType = z.infer<typeof logoMimeTypeSchema>;

export const MIN_LOGO_BYTES = 8;
export const MAX_LOGO_BYTES = 409_600;

/** Everything the interface needs to draw a mark and to ask for the same bytes again. */
export const logoSummarySchema = z.object({
  organizationId: z.uuid(),
  mime: logoMimeTypeSchema,
  byteLength: z.int().min(MIN_LOGO_BYTES).max(MAX_LOGO_BYTES),
  updatedAt: z.string(),
});

export type LogoSummary = z.infer<typeof logoSummarySchema>;

export const membershipSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  role: memberRoleSchema,
  logo: logoSummarySchema.nullable(),
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
