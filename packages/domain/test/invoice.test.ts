import { describe, expect, it } from 'vitest';

import { invoiceLineAmounts, invoiceTotals } from '../src/index';

describe('invoice line amounts', () => {
  it('applies the tax rate to the rounded line net', () => {
    expect(invoiceLineAmounts({ quantity: 3, unitPriceMinor: 8_900, taxRatePercent: 19 })).toEqual({
      netMinor: 26_700,
      taxMinor: 5_073,
      totalMinor: 31_773,
    });
  });

  it('leaves an untaxed line at its net', () => {
    expect(
      invoiceLineAmounts({ quantity: 1, unitPriceMinor: 3_690_000, taxRatePercent: 0 }),
    ).toEqual({ netMinor: 3_690_000, taxMinor: 0, totalMinor: 3_690_000 });
  });

  it('rounds a fractional quantity against the price before taxing', () => {
    expect(
      invoiceLineAmounts({ quantity: 2.5, unitPriceMinor: 199, taxRatePercent: 7 }),
    ).toMatchObject({ netMinor: 498, taxMinor: 35 });
  });

  it('sums rounded lines rather than rounding the sum', () => {
    const lines = [
      invoiceLineAmounts({ quantity: 1, unitPriceMinor: 1_000, taxRatePercent: 0.05 }),
      invoiceLineAmounts({ quantity: 1, unitPriceMinor: 1_000, taxRatePercent: 0.05 }),
    ];

    expect(lines.map((line) => line.taxMinor)).toEqual([1, 1]);
    expect(invoiceTotals(lines)).toEqual({ netMinor: 2_000, taxMinor: 2, totalMinor: 2_002 });
  });

  it('totals an empty basket at zero', () => {
    expect(invoiceTotals([])).toEqual({ netMinor: 0, taxMinor: 0, totalMinor: 0 });
  });
});
