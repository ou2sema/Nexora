import type { Request } from 'express';

import { AppError } from '../errors/app-error';

/**
 * Reads an upload straight off the request instead of letting a body parser turn it
 * into JSON. The limit is enforced while counting, not from `content-length`, so a
 * lying header cannot smuggle a bigger file through.
 */
export async function readLimitedBody(req: Request, limitBytes: number): Promise<Buffer> {
  const declared = Number.parseInt(req.headers['content-length'] ?? '', 10);
  if (Number.isFinite(declared) && declared > limitBytes) {
    throw tooLarge(limitBytes);
  }

  const chunks: Buffer[] = [];
  let received = 0;

  for await (const piece of req) {
    const chunk = Buffer.isBuffer(piece) ? piece : Buffer.from(piece as Uint8Array);
    received += chunk.length;
    if (received > limitBytes) {
      throw tooLarge(limitBytes);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, received);
}

function tooLarge(limitBytes: number): AppError {
  return new AppError(
    'payload_too_large',
    `The image must be ${limitBytes} bytes or smaller.`,
    413,
  );
}
