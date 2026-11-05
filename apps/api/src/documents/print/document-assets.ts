/**
 * The two things a printed document needs that are not text: a font it owns and the
 * tenant mark it was given.
 *
 * The face is bundled under `src/documents/fonts` (ADR-0019 decision 2) and reaches the
 * browser as a `data:` URI, so the bytes embedded in a document are the same on a Windows
 * laptop and a Linux container instead of whichever UI font the host happens to have.
 * Both weights of one Latin + Arabic family cover every script we print, including the
 * SKUs, serials and amounts, so nothing falls back to a host font.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const FONT_FAMILY = 'Nexora Document';

const FONT_FACES = [
  { weight: 400, file: 'IBMPlexSansArabic-Regular.ttf' },
  { weight: 700, file: 'IBMPlexSansArabic-Bold.ttf' },
] as const;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

function readFont(file: string): Uint8Array {
  return new Uint8Array(readFileSync(join(__dirname, '..', 'fonts', file)));
}

let fontCssPromise: Promise<string> | null = null;

/** `@font-face` rules with inlined faces, read and encoded once per process. */
export function documentFontCss(): Promise<string> {
  fontCssPromise ??= (async () =>
    FONT_FACES.map(
      (face) =>
        `@font-face{font-family:'${FONT_FAMILY}';font-style:normal;font-weight:${face.weight};` +
        `src:url(data:font/ttf;base64,${toBase64(readFont(face.file))}) format('truetype');}`,
    ).join('\n'))();

  return fontCssPromise;
}

/**
 * A stored mark is already validated bytes, so the document shows exactly what the
 * tenant uploaded — the same bytes the pdf-lib path embedded, never a re-encode.
 */
export function logoDataUri(logo: { mime: string; bytes: Uint8Array } | null): string | null {
  return logo ? `data:${logo.mime};base64,${toBase64(logo.bytes)}` : null;
}
