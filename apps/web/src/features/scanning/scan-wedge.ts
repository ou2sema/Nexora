import { type RefObject, useEffect, useRef } from 'react';

import { emptyWedgeState, reduceWedgeKey, type WedgeState } from '@mystock/domain';

/**
 * One item entering the basket, whichever way it was captured: a USB or
 * Bluetooth scanner typing into the page, the phone camera, or the keyboard.
 * The decoder behind the code never reaches the sale workflow.
 */
export interface ScanCapture {
  rawValue: string;
  source: 'usb' | 'camera' | 'manual';
  /** The symbology, when the capture layer reports it (native `BarcodeDetector` only). */
  format?: string;
  scannedAt: string;
}

const ENTRY_KEY_TYPES = new Set([
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'number',
  'date',
  'datetime-local',
  'time',
]);

function isTextEntry(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement) {
    return element.type === '' || ENTRY_KEY_TYPES.has(element.type);
  }
  return false;
}

interface ScanWedgeOptions {
  active: boolean;
  /** The designated wedge target. A burst aimed at another field is left alone. */
  targetRef: RefObject<HTMLElement | null>;
  /** Reads the scan field's current value inside the keydown handler, so a code typed by hand is emitted as `manual`. */
  getManualValue: () => string;
  onCapture: (capture: ScanCapture) => void;
}

/**
 * Keyboard-wedge capture. A HID scanner is a keyboard, so there is no browser
 * API for it: the listener accumulates the burst, treats Enter and Tab as the
 * terminator, and owns Enter on the scan field, which is what keeps a scan from
 * being processed twice. Keystrokes too far apart to be a burst fall back to the
 * field's own value, so typing by hand still works, and no key is ever swallowed
 * except the terminator that produced a capture.
 */
export function useScanWedge({ active, targetRef, getManualValue, onCapture }: ScanWedgeOptions) {
  const stateRef = useRef<WedgeState>(emptyWedgeState);
  const captureRef = useRef(onCapture);
  const manualValueRef = useRef(getManualValue);

  useEffect(() => {
    captureRef.current = onCapture;
    manualValueRef.current = getManualValue;
  });

  useEffect(() => {
    if (!active) {
      stateRef.current = emptyWedgeState;
      return;
    }

    const emit = (rawValue: string, source: 'usb' | 'manual', event: KeyboardEvent) => {
      // The burst lands in whatever has focus; clearing the terminator's own key
      // repeat is what stops a Tab from moving focus away from the scan field.
      if (event.key === 'Tab') event.preventDefault();
      stateRef.current = emptyWedgeState;
      captureRef.current({ rawValue, source, scannedAt: new Date().toISOString() });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Alt/Meta belongs to a keyboard shortcut (a browser find bar types
      // Ctrl+f and one character per second), never to a scanner burst.
      if (event.ctrlKey || event.metaKey || event.altKey) {
        stateRef.current = emptyWedgeState;
        return;
      }

      const focused = document.activeElement;
      const target = targetRef.current;
      if (isTextEntry(focused) && focused !== target) {
        stateRef.current = emptyWedgeState;
        return;
      }

      const key = { key: event.key, timeMs: event.timeStamp };
      const outcome = reduceWedgeKey(stateRef.current, key);
      stateRef.current = outcome.state;

      if (outcome.kind !== 'capture') {
        if (event.key === 'Enter' && target) {
          const typed = manualValueRef.current().trim();
          if (typed !== '') emit(typed, 'manual', event);
        }
        return;
      }

      // A laggy reader or a hand-typed code leaves gaps wide enough that the burst
      // window keeps only its tail. The field has seen every character, so when the
      // burst is the end of a longer value, the whole value is the code.
      const typed = manualValueRef.current().trim();
      if (typed.length > outcome.code.length && typed.endsWith(outcome.code)) {
        emit(typed, 'manual', event);
        return;
      }

      emit(outcome.code, 'usb', event);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      stateRef.current = emptyWedgeState;
    };
  }, [active, targetRef]);
}
