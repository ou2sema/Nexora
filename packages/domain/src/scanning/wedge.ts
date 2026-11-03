/**
 * A USB or Bluetooth barcode scanner is an HID keyboard: one keystroke per
 * character, far faster than any human, terminated by Enter or Tab. Only that
 * burst shape matters here — the decoder behind the code never reaches the
 * sale workflow, which resolves the raw value through the scan endpoint.
 */

/** Longest gap between two keystrokes that still counts as one scanner burst. */
export const WEDGE_BURST_MS = 60;

/** A burst shorter than this is a person typing, not a scanner. */
export const WEDGE_MIN_CHARS = 3;

export interface WedgeState {
  chars: string;
  lastKeyAt: number | null;
}

export const emptyWedgeState: WedgeState = { chars: '', lastKeyAt: null };

export interface WedgeKey {
  key: string;
  timeMs: number;
}

export interface WedgeOptions {
  burstMs?: number;
  minChars?: number;
}

export type WedgeOutcome =
  | { kind: 'typing'; state: WedgeState }
  | { kind: 'idle'; state: WedgeState }
  | { kind: 'capture'; code: string; state: WedgeState };

const TERMINATORS = new Set(['Enter', 'Tab']);

function discard(): WedgeState {
  return { chars: '', lastKeyAt: null };
}

export function reduceWedgeKey(
  state: WedgeState,
  { key, timeMs }: WedgeKey,
  options: WedgeOptions = {},
): WedgeOutcome {
  const burstMs = options.burstMs ?? WEDGE_BURST_MS;
  const minChars = options.minChars ?? WEDGE_MIN_CHARS;

  if (TERMINATORS.has(key)) {
    const code = state.chars.trim();
    if (code.length >= minChars) {
      return { kind: 'capture', code, state: discard() };
    }
    return { kind: 'idle', state: discard() };
  }

  // Backspace, Escape, arrows and modifier chords belong to the person in front
  // of the screen; a scanner only ever sends printable characters then Enter.
  if (key.length !== 1) {
    return { kind: 'idle', state: discard() };
  }

  const sinceLast = state.lastKeyAt === null ? Number.POSITIVE_INFINITY : timeMs - state.lastKeyAt;
  if (sinceLast > burstMs) {
    return { kind: 'typing', state: { chars: key, lastKeyAt: timeMs } };
  }

  return { kind: 'typing', state: { chars: state.chars + key, lastKeyAt: timeMs } };
}
