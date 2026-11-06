import { Camera, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CameraScanner } from '@/features/scanning/camera-scanner';
import { type ScanCapture, useScanWedge } from '@/features/scanning/scan-wedge';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';
import { useScanBeep } from '@/lib/use-scan-beep';

/**
 * A camera reads the same label on every frame until it is moved. One capture
 * per code inside this window is what keeps a held-up barcode from turning into
 * twenty basket units; hardware scans and typed codes are never suppressed.
 */
const CAMERA_REPEAT_WINDOW_MS = 1_200;

interface ScanBoxProps {
  /** The wedge listens and the field takes focus only while the counter is open. */
  active: boolean;
  disabled?: boolean;
  /** Owned by the caller: the same text both names a code and filters the quick-add list. */
  value: string;
  onValueChange: (value: string) => void;
  onCapture: (capture: ScanCapture) => void;
}

/**
 * The counter's single entry point. A USB or Bluetooth scanner arrives as a
 * keyboard wedge, the phone camera through `CameraScanner`, and a code typed by
 * hand through Enter on this same field — which is also what filters the
 * products on the shelf, so one box answers both "what is this code" and
 * "do you have a cable".
 */
export function ScanBox({
  active,
  disabled = false,
  value,
  onValueChange,
  onCapture,
}: ScanBoxProps) {
  const { t } = useI18n();
  const beep = useScanBeep();
  const [cameraOn, setCameraOn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCameraRead = useRef<{ value: string; at: number } | null>(null);

  useScanWedge({
    active,
    targetRef: inputRef,
    getManualValue: () => value,
    onCapture: (capture) => {
      beep();
      onValueChange('');
      onCapture(capture);
    },
  });

  useEffect(() => {
    if (active && !disabled) inputRef.current?.focus();
  }, [active, disabled]);

  // The desk has one hand on the scanner and one on the keyboard: `/` puts the
  // cursor in the read field the way it does in a browser find bar.
  useEffect(() => {
    if (!active || disabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const focused = document.activeElement;
      const isTextEntry =
        focused instanceof HTMLInputElement ||
        focused instanceof HTMLTextAreaElement ||
        focused instanceof HTMLSelectElement ||
        (focused instanceof HTMLElement && focused.isContentEditable);
      if (isTextEntry) return;

      event.preventDefault();
      inputRef.current?.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, disabled]);

  const handleCameraDetect = (detected: string, format?: string) => {
    const now = Date.now();
    const previous = lastCameraRead.current;

    if (previous && previous.value === detected && now - previous.at < CAMERA_REPEAT_WINDOW_MS) {
      return;
    }
    lastCameraRead.current = { value: detected, at: now };
    beep();
    onValueChange('');
    onCapture({
      rawValue: detected,
      source: 'camera',
      ...(format === undefined ? {} : { format }),
      scannedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <label htmlFor="sale-scan-code" className="sr-only">
            {t('scan.codeLabel')}
          </label>
          <input
            id="sale-scan-code"
            ref={inputRef}
            value={value}
            dir="ltr"
            autoComplete="off"
            disabled={disabled}
            placeholder={t('sale.scan.placeholder')}
            className={cn(fieldClass, 'mt-0 ps-9 pe-16 font-mono')}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              // Enter belongs to the wedge, so a scan can never also submit the payment form.
              if (event.key === 'Enter') event.preventDefault();
            }}
          />
          {value.trim() === '' ? (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] text-slate-400 sm:block"
            >
              /
            </kbd>
          ) : (
            <button
              type="button"
              aria-label={t('sale.scan.clear')}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={() => {
                onValueChange('');
                inputRef.current?.focus();
              }}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        <Button
          type="button"
          variant={cameraOn ? 'secondary' : 'ghost'}
          aria-pressed={cameraOn}
          disabled={disabled}
          className={cn(
            'shrink-0 ring-1 ring-slate-200',
            !cameraOn && 'bg-white text-indigo-600 hover:bg-indigo-50',
          )}
          onClick={() => setCameraOn((current) => !current)}
        >
          <Camera aria-hidden="true" className="size-4" />
          {t(cameraOn ? 'scan.camera.stop' : 'sale.scan.camera')}
        </Button>
      </div>

      {cameraOn && (
        <div className="rounded-xl border border-slate-200 p-3">
          {/* A held-up label is still in frame while a dialog covers the preview; the
              read that opened the dialog must not open the next one behind it. */}
          <CameraScanner active={active} onDetect={handleCameraDetect} />
        </div>
      )}
    </div>
  );
}
