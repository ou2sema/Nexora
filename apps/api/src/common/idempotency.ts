import { createHash } from 'node:crypto';

import { z } from 'zod';

import { AppError } from './errors/app-error';

export const idempotencyKeySchema = z.string().trim().min(8).max(120);

/** Stable JSON so a retry with the same body produces the same fingerprint. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function fingerprintOf(payload: unknown): string {
  const normalized = JSON.parse(JSON.stringify(payload)) as unknown;
  return createHash('sha256').update(stableStringify(normalized)).digest('hex');
}

export function requireIdempotencyKey(value: string | undefined): string {
  const parsed = idempotencyKeySchema.safeParse(value ?? '');
  if (!parsed.success) {
    throw new AppError(
      'idempotency_key_required',
      'Provide an Idempotency-Key header between 8 and 120 characters.',
      400,
    );
  }
  return parsed.data;
}
