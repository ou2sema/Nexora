import { describe, expect, it } from 'vitest';

import { computeGtinCheckDigit, isValidEan13, isValidGtin, isValidUpcA } from '../src/barcode/gs1';

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
});
