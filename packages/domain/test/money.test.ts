import { describe, expect, it } from 'vitest';

import {
  CURRENCY_CODE,
  formatTnd,
  fromMinorUnits,
  MONEY_MINOR_UNITS,
  toMinorUnits,
} from '../src/money';

const normalizeSpaces = (value: string) => value.replace(/\s/g, ' ');

describe('TND money rules', () => {
  it('uses the Tunisian dinar with three decimal places', () => {
    expect(CURRENCY_CODE).toBe('TND');
    expect(MONEY_MINOR_UNITS).toBe(3);
  });

  it('converts amounts to integer millimes', () => {
    expect(toMinorUnits(0)).toBe(0);
    expect(toMinorUnits(12.345)).toBe(12345);
    expect(toMinorUnits(-1.5)).toBe(-1500);
    expect(toMinorUnits(0.1 + 0.2)).toBe(300);
  });

  it('rejects amounts finer than one millime', () => {
    expect(() => toMinorUnits(1.2345)).toThrow(/more than 3 decimals/);
    expect(() => toMinorUnits(0.0001)).toThrow(/more than 3 decimals/);
  });

  it('rejects non-finite and unsafe amounts', () => {
    expect(() => toMinorUnits(Number.NaN)).toThrow(/finite/);
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY)).toThrow(/finite/);
    expect(() => toMinorUnits(1e15)).toThrow(/safe integer/);
  });

  it('rejects fractional minor units', () => {
    expect(() => fromMinorUnits(1.5)).toThrow(/safe integer/);
  });

  it('round-trips millimes without drift', () => {
    for (const minor of [0, 1, 999, 12345, -1500, 9_007_199_254_740]) {
      expect(toMinorUnits(fromMinorUnits(minor))).toBe(minor);
    }
  });

  it('formats millimes in Tunisian French and English conventions', () => {
    expect(normalizeSpaces(formatTnd(1_234_567))).toBe('1 234,567 DT');
    expect(normalizeSpaces(formatTnd(0))).toBe('0,000 DT');
    expect(normalizeSpaces(formatTnd(1_234_567, 'en-TN'))).toBe('TND 1,234.567');
  });
});
