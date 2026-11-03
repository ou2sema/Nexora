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

/** Decodes the Flate-compressed content streams and pulls out drawn text runs. */
export function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  let content = '';
  const streams = /stream\r?\n/g;
  let stream: RegExpExecArray | null;
  while ((stream = streams.exec(raw)) !== null) {
    const start = stream.index + stream[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      content += inflateSync(pdf.subarray(start, end), {
        finishFlush: constants.Z_SYNC_FLUSH,
      }).toString('latin1');
    } catch {
      // Streams that are not Flate-compressed carry no visible text here.
    }
  }

  let text = '';
  const runs = /<([0-9A-Fa-f]+)>\s*Tj/g;
  let run: RegExpExecArray | null;
  while ((run = runs.exec(content)) !== null) {
    text += `${Buffer.from(run[1] ?? '', 'hex').toString('latin1')}\n`;
  }
  return text;
}
