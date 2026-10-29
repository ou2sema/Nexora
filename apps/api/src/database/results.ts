/**
 * Drizzle returns rows as an array from postgres.js and as `{ rows }` from
 * PGlite (used in tests). Normalise both so raw SQL stays driver-agnostic.
 */
export function resultRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (typeof result === 'object' && result !== null) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}
