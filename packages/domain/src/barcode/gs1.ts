/**
 * GS1 check-digit helpers for EAN-13 and UPC-A.
 * A barcode is only sent to a printer or accepted from a scanner when its
 * check digit validates.
 */

export function computeGtinCheckDigit(payload: string): number {
  if (!/^\d+$/.test(payload)) {
    throw new Error('Barcode payload must contain digits only');
  }

  let sum = 0;
  let weight = 3;

  for (let index = payload.length - 1; index >= 0; index -= 1) {
    const digit = Number(payload[index]);
    sum += digit * weight;
    weight = weight === 3 ? 1 : 3;
  }

  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(digits: string, expectedLength: 8 | 12 | 13 | 14): boolean {
  if (digits.length !== expectedLength || !/^\d+$/.test(digits)) {
    return false;
  }

  const payload = digits.slice(0, -1);
  const checkDigit = Number(digits.at(-1));

  return computeGtinCheckDigit(payload) === checkDigit;
}

export function isValidEan13(digits: string): boolean {
  return isValidGtin(digits, 13);
}

export function isValidUpcA(digits: string): boolean {
  return isValidGtin(digits, 12);
}

/** Accepts the GTIN lengths used by retail barcodes: EAN-8, UPC-A, EAN-13, GTIN-14. */
export function isValidGtinBarcode(value: string): boolean {
  const length = value.length;
  if (length !== 8 && length !== 12 && length !== 13 && length !== 14) {
    return false;
  }
  return isValidGtin(value, length);
}

/**
 * Builds an EAN-13 in the `2` prefix range, which GS1 reserves for in-store
 * internal numbering, so generated labels never collide with a manufacturer's
 * real barcode.
 */
export function buildInternalEan13(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 99_999_999_999) {
    throw new Error('Barcode sequence must be a positive integer below 100 billion');
  }

  const payload = `2${String(sequence).padStart(11, '0')}`;
  return `${payload}${computeGtinCheckDigit(payload)}`;
}
