import { AppError } from '../common/errors/app-error';
import type { ZodType } from 'zod';

export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toNullableIso(value: Date | string | null): string | null {
  return value === null ? null : toIso(value);
}

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export function parseResult<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError('internal_error', 'Unexpected operation response.', 500);
  }
  return parsed.data;
}
