import { useEffect } from 'react';

type AudioContextConstructor = new () => AudioContext;

/** Crisp and short: the operator needs to hear that the code counted, not a melody. */
const BEEP_HZ = 1050;
const BEEP_SECONDS = 0.09;
const BEEP_LEVEL = 0.06;

let context: AudioContext | null = null;

function audioContextConstructor(): AudioContextConstructor | null {
  const candidate =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return typeof candidate === 'function' ? candidate : null;
}

function ensureContext(): AudioContext | null {
  if (!context) {
    const Constructor = audioContextConstructor();
    if (!Constructor) return null;
    context = new Constructor();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** One confirmation tone, mixed down low enough to sit under a busy depot. */
export function playScanBeep(): void {
  const audio = ensureContext();
  if (!audio) return;

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const startsAt = audio.currentTime;
  const endsAt = startsAt + BEEP_SECONDS;

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(BEEP_HZ, startsAt);
  gain.gain.setValueAtTime(0, startsAt);
  gain.gain.linearRampToValueAtTime(BEEP_LEVEL, startsAt + 0.003);
  gain.gain.setValueAtTime(BEEP_LEVEL, endsAt - 0.025);
  gain.gain.linearRampToValueAtTime(0, endsAt);

  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(startsAt);
  oscillator.stop(endsAt);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

/**
 * The beep answers a read, not a click, so the context has to be open before one
 * arrives: Chromium keeps a fresh AudioContext suspended until the first gesture.
 */
export function useScanBeep(): () => void {
  useEffect(() => {
    const unlock = () => {
      ensureContext();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return playScanBeep;
}
