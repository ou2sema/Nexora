export const CURRENCY_CODE = 'TND';

/** TND has three decimal places; the smallest unit is one millime. */
export const MONEY_MINOR_UNITS = 3;

const SCALE = 10 ** MONEY_MINOR_UNITS;

function assertMinorUnits(minor: number): number {
  if (!Number.isInteger(minor) || Math.abs(minor) > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Money must be a safe integer number of millimes, received ${String(minor)}`);
  }
  return minor;
}

/**
 * Converts a TND amount to integer millimes. Amounts finer than one millime are
 * rejected rather than silently rounded, so pricing errors surface at the boundary.
 */
export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`Amount must be a finite number, received ${String(amount)}`);
  }
  const scaled = amount * SCALE;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw new Error(`Amount has more than ${MONEY_MINOR_UNITS} decimals: ${amount}`);
  }
  return assertMinorUnits(rounded);
}

export function fromMinorUnits(minor: number): number {
  assertMinorUnits(minor);
  return minor / SCALE;
}

export function formatTnd(minor: number, locale = 'fr-TN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY_CODE,
  }).format(fromMinorUnits(minor));
}
