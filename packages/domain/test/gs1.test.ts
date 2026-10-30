import { describe, expect, it } from 'vitest';

import {
  buildInternalEan13,
  computeGtinCheckDigit,
  isValidEan13,
  isValidGtin,
  isValidGtinBarcode,
  isValidUpcA,
} from '../src/barcode/gs1';

describe('computeGtinCheckDigit', () => {
  it('computes the EAN-13 check digit', () => {
    expect(computeGtinCheckDigit('400638133393')).toBe(1);
  });

  it('computes the UPC-A check digit', () => {
    expect(computeGtinCheckDigit('03600029145')).toBe(2);
  });

  it('rejects non-numeric payloads', () => {
    expect(() => computeGtinCheckDigit('4006381A3393')).toThrowError(/digits only/);
  });
});

describe('GTIN validation', () => {
  it('accepts a valid EAN-13', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
  });

  it('rejects an EAN-13 with a wrong check digit', () => {
    expect(isValidEan13('4006381333932')).toBe(false);
  });

  it('accepts a valid UPC-A', () => {
    expect(isValidUpcA('036000291452')).toBe(true);
  });

  it('rejects a UPC-A with a wrong check digit', () => {
    expect(isValidUpcA('036000291453')).toBe(false);
  });

  it('rejects wrong lengths', () => {
    expect(isValidEan13('400638133393')).toBe(false);
    expect(isValidGtin('4006381333931', 12)).toBe(false);
  });

  it('rejects non-digit input', () => {
    expect(isValidEan13('40063813339X1')).toBe(false);
  });

  it('accepts every supported GTIN length with a valid check digit', () => {
    for (const digits of ['96385074', '036000291452', '4006381333931', '10012345000017']) {
      expect(isValidGtinBarcode(digits)).toBe(true);
    }
  });

  it('rejects unsupported lengths and bad check digits', () => {
    expect(isValidGtinBarcode('123456789')).toBe(false);
    expect(isValidGtinBarcode('4006381333932')).toBe(false);
    expect(isValidGtinBarcode('ABC')).toBe(false);
  });
});

describe('buildInternalEan13', () => {
  it('builds a valid in-store EAN-13 from a sequence', () => {
    const barcode = buildInternalEan13(42);
    expect(barcode).toBe('2000000000428');
    expect(isValidEan13(barcode)).toBe(true);
  });

  it('is deterministic and keeps the reserved 2 prefix', () => {
    expect(buildInternalEan13(1)).toBe('2000000000015');
    expect(buildInternalEan13(99_999_999_999).startsWith('299999999999')).toBe(true);
  });

  it('rejects sequences outside the supported range', () => {
    expect(() => buildInternalEan13(0)).toThrowError(/positive integer/);
    expect(() => buildInternalEan13(100_000_000_000)).toThrowError(/positive integer/);
    expect(() => buildInternalEan13(1.5)).toThrowError(/positive integer/);
  });
});
