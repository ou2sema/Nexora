import { describe, expect, it } from 'vitest';

import { availableQuantity, isReservationFeasible, roundQuantity } from '../src/quantity';

describe('roundQuantity', () => {
  it('rounds to four decimal places', () => {
    expect(roundQuantity(1.23456)).toBe(1.2346);
    expect(roundQuantity(0.00004)).toBe(0);
  });

  it('rejects non-finite values', () => {
    expect(() => roundQuantity(Number.NaN)).toThrowError(/finite/);
    expect(() => roundQuantity(Number.POSITIVE_INFINITY)).toThrowError(/finite/);
  });
});

describe('availableQuantity', () => {
  it('subtracts reservations from on-hand stock', () => {
    expect(availableQuantity({ onHand: 10, reserved: 3 })).toBe(7);
  });

  it('can reach zero when everything is reserved', () => {
    expect(availableQuantity({ onHand: 5, reserved: 5 })).toBe(0);
  });

  it('stays exact for fractional quantities', () => {
    expect(availableQuantity({ onHand: 0.3, reserved: 0.1 })).toBe(0.2);
  });
});

describe('isReservationFeasible', () => {
  it('accepts a reservation that fits available stock', () => {
    expect(isReservationFeasible({ onHand: 10, reserved: 2 }, 8)).toBe(true);
  });

  it('rejects a reservation beyond available stock', () => {
    expect(isReservationFeasible({ onHand: 10, reserved: 2 }, 9)).toBe(false);
  });

  it('rejects non-positive requests', () => {
    expect(() => isReservationFeasible({ onHand: 10, reserved: 0 }, 0)).toThrowError(
      /strictly positive/,
    );
  });
});
