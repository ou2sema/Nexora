import { Camera, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { CameraScanner } from '@/features/scanning/camera-scanner';
import { type ScanCapture, useScanWedge } from '@/features/scanning/scan-wedge';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { cn } from '@/lib/cn';
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
  /** A resolution is in flight; the button waits so two scans cannot interleave. */
  busy?: boolean;
  disabled?: boolean;
  onCapture: (capture: ScanCapture) => void;
}

/**
 * The counter's single scan entry point: a USB or Bluetooth scanner arrives as a
 * keyboard wedge, the phone camera through `CameraScanner`, and a code typed by
 * hand through the same field. All three leave as one `ScanCapture`.
 */
export function ScanBox({ active, busy = false, disabled = false, onCapture }: ScanBoxProps) {
  const { t } = useI18n();
  const beep = useScanBeep();
  const [code, setCode] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCameraRead = useRef<{ value: string; at: number } | null>(null);

  useScanWedge({
    active,
    targetRef: inputRef,
    getManualValue: () => code,
    onCapture: (capture) => {
      beep();
      setCode('');
      onCapture(capture);
    },
  });

  useEffect(() => {
    if (active && !disabled) inputRef.current?.focus();
  }, [active, disabled]);

  const submitTyped = () => {
    const value = code.trim();
    if (!value || busy || disabled) return;

    beep();
    setCode('');
    onCapture({ rawValue: value, source: 'manual', scannedAt: new Date().toISOString() });
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter belongs to the wedge, so a scan can never also trigger a form submit.
    if (event.key === 'Enter') event.preventDefault();
  };

  const handleCameraDetect = (value: string, format?: string) => {
    const now = Date.now();
    const previous = lastCameraRead.current;

    if (previous && previous.value === value && now - previous.at < CAMERA_REPEAT_WINDOW_MS) return;
    lastCameraRead.current = { value, at: now };
    beep();
    onCapture({
      rawValue: value,
      source: 'camera',
      ...(format === undefined ? {} : { format }),
      scannedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="sale-scan-code" className="sr-only">
            {t('scan.codeLabel')}
          </label>
          <input
            id="sale-scan-code"
            ref={inputRef}
            value={code}
            dir="ltr"
            autoComplete="off"
            disabled={disabled}
            placeholder={t('scan.codePlaceholder')}
            className={cn(fieldClass, 'mt-0 font-mono')}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={submitTyped} disabled={disabled || busy || !code.trim()}>
            <ScanLine aria-hidden="true" className="size-4" />
            {t('sale.scan.add')}
          </Button>
          <Button
            type="button"
            variant={cameraOn ? 'secondary' : 'ghost'}
            aria-pressed={cameraOn}
            disabled={disabled}
            onClick={() => setCameraOn((current) => !current)}
          >
            <Camera aria-hidden="true" className="size-4" />
            {t(cameraOn ? 'scan.camera.stop' : 'scan.camera.start')}
          </Button>
        </div>
      </div>

      <p className="hidden text-xs text-slate-500 sm:block">{t('sale.scan.hint')}</p>

      {cameraOn && (
        <div className="rounded-lg border border-slate-200 p-3">
          {/* A held-up label is still in frame while a dialog covers the preview; the
              read that opened the dialog must not open the next one behind it. */}
          <CameraScanner active={active} onDetect={handleCameraDetect} />
        </div>
      )}
    </div>
  );
}
