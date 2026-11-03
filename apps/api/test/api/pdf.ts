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

/** The visible text of a document, in the order it was drawn. */
export function pdfText(pdf: Buffer): string {
  let text = '';
  const runs = /<([0-9A-Fa-f]+)>\s*Tj/g;
  for (const content of pdfContentStreams(pdf)) {
    let run: RegExpExecArray | null;
    while ((run = runs.exec(content)) !== null) {
      text += `${Buffer.from(run[1] ?? '', 'hex').toString('latin1')}\n`;
    }
  }
  return text;
}

export interface PdfRule {
  y: number;
  fromX: number;
  toX: number;
}

export interface PdfRun {
  value: string;
  size: number;
  x: number;
  y: number;
}

/**
 * The geometry a renderer actually drew: horizontal rules and text runs with their
 * baseline position. Layout regressions are invisible to pdfText, so they need this.
 */
export function pdfGeometry(pdf: Buffer): { rules: PdfRule[]; runs: PdfRun[] } {
  const rules: PdfRule[] = [];
  const runs: PdfRun[] = [];

  for (const content of pdfContentStreams(pdf)) {
    const segments =
      /(-?[\d.]+) (-?[\d.]+) m\s+(?:-?[\d.]+ -?[\d.]+ m\s+)?(-?[\d.]+) (-?[\d.]+) l\s+S/g;
    let segment: RegExpExecArray | null;
    while ((segment = segments.exec(content)) !== null) {
      const fromX = Number(segment[1]);
      const y = Number(segment[2]);
      const toX = Number(segment[3]);
      if (Number(segment[4]) === y) rules.push({ y, fromX, toX });
    }

    const placed = /(-?[\d.]+) Tf[\s\S]*?1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm\s*<([0-9A-Fa-f]+)> Tj/g;
    let glyph: RegExpExecArray | null;
    while ((glyph = placed.exec(content)) !== null) {
      runs.push({
        size: Number(glyph[1]),
        x: Number(glyph[2]),
        y: Number(glyph[3]),
        value: Buffer.from(glyph[4] ?? '', 'hex').toString('latin1'),
      });
    }
  }

  return { rules, runs };
}
