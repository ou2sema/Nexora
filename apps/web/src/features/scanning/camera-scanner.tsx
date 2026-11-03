import { useEffect, useRef, useState } from 'react';

import type { IScannerControls } from '@zxing/browser';

import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'itf', 'code_128'];

function nativeDetectorConstructor(): BarcodeDetectorConstructor | null {
  const candidate = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
  return typeof candidate === 'function' ? candidate : null;
}

interface CameraScannerProps {
  active: boolean;
  /** `format` is only known to the native detector; ZXing reports the value alone. */
  onDetect: (code: string, format?: string) => void;
}

/**
 * Camera capture prefers the native BarcodeDetector (Chrome, Edge, Android)
 * and falls back to ZXing's WASM-free decoder elsewhere, including Safari and
 * Firefox. The engine actually in use is shown so operators can tell why a
 * symbology failed to read.
 */
export function CameraScanner({ active, onDetect }: CameraScannerProps) {
  const { t, errorMessage } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const errorMessageRef = useRef(errorMessage);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [engine, setEngine] = useState<'native' | 'zxing' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    errorMessageRef.current = errorMessage;
  }, [errorMessage]);

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      setEngine(null);
      setError(null);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let controls: IScannerControls | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stopStream = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      video.srcObject = null;
    };

    const startZxing = async () => {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (cancelled) return;
      const reader = new BrowserMultiFormatReader();
      controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
        if (result) onDetectRef.current(result.getText());
      });
      if (cancelled) {
        controls.stop();
        return;
      }
      setEngine('zxing');
      setStatus('scanning');
    };

    const start = async () => {
      setStatus('starting');
      setError(null);

      const Detector = nativeDetectorConstructor();
      if (!Detector) {
        try {
          await startZxing();
        } catch (cause) {
          if (!cancelled) {
            setStatus('error');
            setError(errorMessageRef.current(cause, 'scan.camera.error'));
          }
        }
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stopStream();
          return;
        }

        video.srcObject = stream;
        await video.play();

        let detector: BarcodeDetectorLike;
        try {
          detector = new Detector({ formats: NATIVE_FORMATS });
        } catch {
          detector = new Detector();
        }

        setEngine('native');
        setStatus('scanning');

        const tick = async () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              const first = codes[0];
              if (first?.rawValue) onDetectRef.current(first.rawValue, first.format);
            } catch {
              // A single failed frame should not stop continuous scanning.
            }
          }
          timer = setTimeout(() => void tick(), 200);
        };
        void tick();
      } catch (cause) {
        if (cancelled) return;
        stopStream();
        try {
          await startZxing();
        } catch {
          setStatus('error');
          setError(errorMessageRef.current(cause, 'scan.camera.error'));
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controls?.stop();
      stopStream();
    };
  }, [active]);

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label={t('scan.camera.preview')}
        className={cn(
          'w-full rounded-lg bg-slate-900 object-cover',
          active ? 'aspect-video' : 'hidden',
        )}
      />
      <p role="status" className="text-xs text-slate-500">
        {!active && t('scan.camera.off')}
        {active && status === 'starting' && t('scan.camera.starting')}
        {active &&
          status === 'scanning' &&
          t(engine === 'zxing' ? 'scan.camera.scanningZxing' : 'scan.camera.scanningNative')}
        {active && status === 'error' && (error ?? t('scan.camera.error'))}
      </p>
    </div>
  );
}
