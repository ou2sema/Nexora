import { fromMinorUnits, toMinorUnits } from '@mystock/domain';

/** TND typed with either separator; empty reads as "not entered". */
export function parseAmountToMinor(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;

  try {
    return toMinorUnits(amount);
  } catch {
    return null;
  }
}

/** A percentage rate with up to four decimals, within the 0–100 the tax column allows. */
export function parsePercent(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(normalized)) return null;

  const percent = Number(normalized);
  return percent >= 0 && percent <= 100 ? percent : null;
}

/** A quantity with at most four decimals, strictly positive. */
export function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  if (!/^\d+(\.\d{1,4})?$/.test(normalized)) return null;

  const quantity = Number(normalized);
  return quantity > 0 ? quantity : null;
}

export function formatMinorAsInput(minor: number): string {
  return fromMinorUnits(minor).toFixed(3);
}
