import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { constants, inflateSync } from 'node:zlib';

import type { Response } from 'superagent';

/** Collects a binary response body instead of letting superagent decode it as text. */
export function pdfParser(
  response: Response,
  callback: (error: Error | null, body?: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}

/**
 * Bidi markers: the right-to-left templates isolate every ASCII run, and the extractor
 * carries the isolates into its output. They are invisible on paper, so tests never want them.
 */
const BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

function readPdfText(pdf: Buffer): string {
  const directory = mkdtempSync(join(tmpdir(), 'nexora-pdf-'));

  try {
    const path = join(directory, 'document.pdf');
    writeFileSync(path, pdf);
    const run = spawnSync('pdftotext', ['-enc', 'UTF-8', path, '-'], { encoding: 'utf8' });

    if (run.error) {
      throw new Error(
        `pdftotext could not run (${run.error.message}). Install poppler-utils — see docs/setup.md.`,
      );
    }
    if (run.status !== 0) {
      throw new Error(`pdftotext failed on a rendered document: ${run.stderr.trim()}`);
    }

    return run.stdout ?? '';
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * One entry per printed page, in reading order. Every page of every document carries a
 * footer, so a page with no text is a page that failed to render rather than a blank one.
 */
export function pdfPages(pdf: Buffer): string[] {
  return readPdfText(pdf)
    .split('\f')
    .map((page) => page.replace(BIDI_CONTROLS, '').trim())
    .filter((page) => page.length > 0);
}

/** The visible text of a document, pages joined in order. */
export function pdfText(pdf: Buffer): string {
  return pdfPages(pdf).join('\n');
}

/** The faces actually embedded in the file, so a document cannot silently fall back to a host font. */
export function pdfFontNames(pdf: Buffer): string[] {
  const names = new Set<string>();
  for (const match of pdf.toString('latin1').matchAll(/\/BaseFont\s*\/([A-Za-z0-9.+-]+)/g)) {
    names.add(match[1] ?? '');
  }
  return [...names].filter(Boolean).sort();
}

/** How many images the file carries; a soft mask is stored as an image of its own. */
export function pdfImageCount(pdf: Buffer): number {
  return [...pdf.toString('latin1').matchAll(/\/Subtype\s*\/Image/g)].length;
}

/** Decodes every Flate-compressed content stream so assertions can read the drawing operators. */
export function pdfContentStreams(pdf: Buffer): string[] {
  const raw = pdf.toString('latin1');
  const streams: string[] = [];
  const headers = /stream\r?\n/g;
  let header: RegExpExecArray | null;
  while ((header = headers.exec(raw)) !== null) {
    const start = header.index + header[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      streams.push(
        inflateSync(pdf.subarray(start, end), {
          finishFlush: constants.Z_SYNC_FLUSH,
        }).toString('latin1'),
      );
    } catch {
      // Streams that are not Flate-compressed carry no drawing operators here.
    }
  }
  return streams;
}

export interface PdfImagePlacement {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const CM_MATRIX = /(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm/g;

/**
 * Every image the pdf-lib label sheets actually placed, in page order: each draw is wrapped
 * in a graphics state whose matrix chain carries the page position and the drawn size. An
 * uploaded mark that never reached the page would otherwise look like a passing test.
 */
export function pdfImages(pdf: Buffer): PdfImagePlacement[] {
  const placements: PdfImagePlacement[] = [];

  for (const content of pdfContentStreams(pdf)) {
    const blocks = /q([\s\S]*?)\/([\w.-]+) Do\s*Q/g;
    let block: RegExpExecArray | null;
    while ((block = blocks.exec(content)) !== null) {
      const matrices = [...(block[1] ?? '').matchAll(CM_MATRIX)].map((match) =>
        match.slice(1, 7).map(Number),
      );
      const position = matrices.find((m) => m[0] === 1 && m[3] === 1);
      const scale = matrices.find((m) => m[1] === 0 && m[2] === 0 && m[0] !== 1);
      if (!position || !scale) continue;

      placements.push({
        name: block[2] ?? '',
        x: position[4] ?? 0,
        y: position[5] ?? 0,
        width: scale[0] ?? 0,
        height: scale[3] ?? 0,
      });
    }
  }

  return placements;
}
