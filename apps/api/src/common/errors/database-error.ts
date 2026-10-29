import type { ErrorDescriptor } from '../filters/all-exceptions.filter';

interface PostgresErrorLike {
  code?: unknown;
  severity?: unknown;
  constraint?: unknown;
  message?: unknown;
}

function isPostgresError(value: unknown): value is PostgresErrorLike {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as PostgresErrorLike;
  return typeof candidate.code === 'string' && typeof candidate.severity === 'string';
}

const CONSTRAINT_MESSAGES: Record<string, string> = {
  category_cycle: 'A category cannot be its own ancestor.',
  organization_requires_owner: 'An organization must keep at least one owner.',
};

/**
 * Translates PostgreSQL error codes into stable API errors. Raw database
 * messages never reach the client; only the constraint name is echoed for
 * duplicate-value feedback.
 */
function findPostgresError(error: unknown): PostgresErrorLike | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (isPostgresError(current)) return current;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export function toDatabaseErrorDescriptor(error: unknown): ErrorDescriptor | null {
  const databaseError = findPostgresError(error);
  if (!databaseError) return null;

  const constraint =
    typeof databaseError.constraint === 'string' ? databaseError.constraint : undefined;
  const rawMessage = typeof databaseError.message === 'string' ? databaseError.message : '';
  const details = constraint ? { constraint } : undefined;

  switch (databaseError.code) {
    case '23505':
      return {
        status: 409,
        code: 'conflict',
        message: 'A record with this value already exists.',
        details,
      };
    case '23503':
      return {
        status: 400,
        code: 'invalid_reference',
        message: 'A referenced record does not exist in this organization.',
        details,
      };
    case '23514':
      return {
        status: 400,
        code: 'constraint_violation',
        message: CONSTRAINT_MESSAGES[rawMessage] ?? 'A data constraint rejected the request.',
        details,
      };
    case '23502':
      return {
        status: 400,
        code: 'validation_error',
        message: 'A required value is missing.',
        details,
      };
    case '42501':
      return {
        status: 403,
        code: 'forbidden',
        message: 'Your role does not allow this action.',
      };
    case '28000':
      return { status: 401, code: 'unauthenticated', message: 'Authentication is required.' };
    case '22P02':
    case '22003':
      return {
        status: 400,
        code: 'validation_error',
        message: 'A value has an invalid type or range.',
      };
    default:
      return { status: 500, code: 'internal_error', message: 'Internal server error' };
  }
}
