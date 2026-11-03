import type { PDFDocument, PDFImage } from 'pdf-lib';

import type { StoredLogo } from './logo.reader';

/**
 * pdf-lib's JPEG embedder reads the backing ArrayBuffer instead of the view, and both an
 * upload chunk and a bytea value from the driver can sit inside Node's shared buffer pool.
 * A copy at offset zero is the only form it parses reliably.
 */
export function embedLogoImage(pdf: PDFDocument, logo: StoredLogo): Promise<PDFImage> {
  const bytes = new Uint8Array(logo.bytes);
  return logo.mime === 'image/png' ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}
