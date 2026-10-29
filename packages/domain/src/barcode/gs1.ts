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
