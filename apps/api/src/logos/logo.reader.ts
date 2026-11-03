import { eq, sql } from 'drizzle-orm';

import type { LogoMimeType, LogoSummary } from '@mystock/contracts';

import type { AppTransaction } from '../database/database.types';
import { toIso } from '../operations/operations.utils';
import { resultRows } from '../database/results';
import { organizationLogos } from '../database/schema';

export interface StoredLogo {
  mime: LogoMimeType;
  bytes: Uint8Array;
}

interface LogoMetadataRow {
  organization_id: string;
  mime: string;
  byte_length: number | string;
  updated_at: Date | string;
}

/** Absence is not an error here: the caller draws without a mark. */
export async function readStoredLogo(
  tx: AppTransaction,
  organizationId: string,
): Promise<StoredLogo | null> {
  const [row] = await tx
    .select({ mime: organizationLogos.mime, bytes: organizationLogos.bytes })
    .from(organizationLogos)
    .where(eq(organizationLogos.organizationId, organizationId))
    .limit(1);

  if (!row) return null;
  return { mime: row.mime, bytes: row.bytes };
}

/**
 * Metadata only — the bytes do not belong in a list response, and the interface needs
 * the upload timestamp to build a URL the browser can hold on to.
 */
export async function readVisibleLogoMetadata(
  tx: AppTransaction,
  organizationId?: string,
): Promise<LogoSummary[]> {
  const rows = resultRows<LogoMetadataRow>(
    await tx.execute(sql`
      select organization_id, mime, octet_length(bytes) as byte_length, updated_at
      from public.organization_logos
      ${organizationId ? sql`where organization_id = ${organizationId}::uuid` : sql``}
    `),
  );

  return rows.map(toLogoSummary);
}

export function toLogoSummary(row: LogoMetadataRow): LogoSummary {
  return {
    organizationId: row.organization_id,
    mime: row.mime as LogoMimeType,
    byteLength: Number(row.byte_length),
    updatedAt: toIso(row.updated_at),
  };
}
