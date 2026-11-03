import { describe, expect, it } from 'vitest';

import {
  emptyWedgeState,
  reduceWedgeKey,
  WEDGE_BURST_MS,
  WEDGE_MIN_CHARS,
  type WedgeState,
} from '../src/index';

interface ScanOptions {
  gapMs?: number;
  burstMs?: number;
  terminator?: string;
}

function scan(code: string, { gapMs = 5, burstMs, terminator = 'Enter' }: ScanOptions = {}) {
  let state: WedgeState = emptyWedgeState;
  for (const [index, key] of [...code].entries()) {
    state = reduceWedgeKey(state, { key, timeMs: index * gapMs }, { burstMs }).state;
  }

  return reduceWedgeKey(state, { key: terminator, timeMs: code.length * gapMs }, { burstMs });
}

describe('keyboard-wedge reducer', () => {
  it('captures a fast burst terminated by Enter', () => {
    expect(scan('3512345678901234')).toMatchObject({
      kind: 'capture',
      code: '3512345678901234',
      state: emptyWedgeState,
    });
  });

  it('captures a burst terminated by Tab', () => {
    expect(scan('ABC', { terminator: 'Tab' })).toMatchObject({ kind: 'capture', code: 'ABC' });
  });

  it('never captures a code typed by hand at human speed', () => {
    const outcome = scan('abc', { gapMs: WEDGE_BURST_MS + 40 });

    expect(outcome.kind).toBe('idle');
    expect(outcome).not.toHaveProperty('code');
  });

  it('restarts the burst when a keystroke falls out of the window', () => {
    let state = reduceWedgeKey(emptyWedgeState, { key: '1', timeMs: 0 }).state;
    state = reduceWedgeKey(state, { key: '2', timeMs: 5_000 }).state;

    expect(state.chars).toBe('2');
    expect(reduceWedgeKey(state, { key: 'Enter', timeMs: 5_010 }).kind).toBe('idle');
  });

  it('discards the buffer when the seller edits with Backspace', () => {
    let state: WedgeState = { chars: '12345678901234', lastKeyAt: 100 };
    state = reduceWedgeKey(state, { key: 'Backspace', timeMs: 110 }).state;

    expect(state).toEqual(emptyWedgeState);
    expect(reduceWedgeKey(state, { key: 'Enter', timeMs: 120 }).kind).toBe('idle');
  });

  it('ignores navigation keys', () => {
    const state = reduceWedgeKey(
      { chars: '1234567', lastKeyAt: 0 },
      { key: 'ArrowLeft', timeMs: 5 },
    ).state;

    expect(state).toEqual(emptyWedgeState);
  });

  it('trims a trailing pad character', () => {
    expect(scan('AB1 ')).toMatchObject({ kind: 'capture', code: 'AB1' });
  });

  it('keeps bursts shorter than the minimum out of the basket', () => {
    expect(WEDGE_MIN_CHARS).toBeGreaterThan(1);
    expect(scan('A1').kind).toBe('idle');
  });

  it('accepts a slower burst when the window is widened', () => {
    expect(scan('A1B', { gapMs: 200 }).kind).toBe('idle');
    expect(scan('A1B', { gapMs: 200, burstMs: 400 })).toMatchObject({
      kind: 'capture',
      code: 'A1B',
    });
  });
});
