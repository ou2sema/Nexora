import { z } from 'zod';

import { uuidSchema } from '@mystock/contracts';

export const logoParamsSchema = z.object({
  organizationId: uuidSchema,
});

export type LogoParams = z.infer<typeof logoParamsSchema>;

/** The two formats `pdf-lib` can embed; anything else is refused before a byte is read. */
export const LOGO_MEDIA_TYPES: readonly string[] = ['image/png', 'image/jpeg'];

export function mediaTypeOf(contentType: string | undefined): string | null {
  if (!contentType) return null;
  return contentType.split(';')[0]?.trim().toLowerCase() ?? null;
}
