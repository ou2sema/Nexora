import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';

import { MIN_LOGO_BYTES, type LogoMimeType, type LogoSummary } from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';
import { embedLogoImage } from './logo.embed';
import { type StoredLogo, readStoredLogo, readVisibleLogoMetadata } from './logo.reader';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * What the client declared is not what it sent, and bytes the renderer cannot decode
 * would break every document of that tenant from then on. The signature check refuses
 * the obvious mismatch and the embed probe below refuses anything `pdf-lib` would
 * choke on: both belong at the write, where a rejection costs one upload, rather than
 * at the print of a sale.
 */
export function sniffLogoMime(bytes: Uint8Array): LogoMimeType | null {
  if (bytes.length < MIN_LOGO_BYTES) return null;
  if (PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Embeds the bytes exactly as a document renderer will, so an accepted upload is printable. */
export async function assertLogoEmbeddable(bytes: Uint8Array, mime: LogoMimeType): Promise<void> {
  try {
    const pdf = await PDFDocument.create();
    await embedLogoImage(pdf, { mime, bytes });
  } catch {
    throw new AppError(
      'invalid_logo_image',
      'The image could not be read. Re-export it as a PNG or JPEG file.',
      400,
    );
  }
}

@Injectable()
export class OrganizationLogosService {
  constructor(private readonly access: TenantAccessService) {}

  async store(
    userId: string,
    organizationId: string,
    declaredMime: string,
    bytes: Uint8Array,
  ): Promise<LogoSummary> {
    const mime = sniffLogoMime(bytes);
    if (!mime) {
      throw new AppError('invalid_logo_image', 'The upload is not a PNG or JPEG image.', 400);
    }
    if (mime !== declaredMime) {
      throw new AppError('invalid_logo_image', 'The upload does not match its content type.', 400, {
        declared: declaredMime,
        detected: mime,
      });
    }

    await assertLogoEmbeddable(bytes, mime);

    return this.runAsWriter(userId, organizationId, async (tx) => {
      await tx.execute(sql`
        select app.set_organization_logo(
          ${organizationId}::uuid,
          ${mime}::text,
          decode(${Buffer.from(bytes).toString('hex')}, 'hex')
        ) as logo
      `);

      const [logo] = await readVisibleLogoMetadata(tx, organizationId);
      if (!logo) {
        throw new AppError('internal_error', 'The logo could not be stored.', 500);
      }
      return logo;
    });
  }

  async remove(userId: string, organizationId: string): Promise<{ removed: boolean }> {
    const rows = resultRows<{ removed: boolean }>(
      await this.runAsWriter(userId, organizationId, (tx) =>
        tx.execute(sql`select app.clear_organization_logo(${organizationId}::uuid) as removed`),
      ),
    );

    return { removed: rows[0]?.removed === true };
  }

  async readForMember(userId: string, organizationId: string): Promise<StoredLogo> {
    const logo = await this.access.runAsMember(userId, organizationId, (tx) =>
      readStoredLogo(tx, organizationId),
    );

    if (!logo) {
      throw new AppError('logo_not_found', 'This organization has no logo.', 404);
    }

    return logo;
  }

  private runAsWriter<T>(
    userId: string,
    organizationId: string,
    action: (tx: AppTransaction) => Promise<T>,
  ): Promise<T> {
    return this.access.runAsMember(userId, organizationId, action, { roles: CATALOG_WRITERS });
  }
}
