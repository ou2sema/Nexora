export const SUPPORTED_LOCALES = ['en', 'fr', 'ar'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

const STORAGE_KEY = 'mystock.locale';

export interface LocaleOption {
  value: Locale;
  label: string;
  tag: string;
}

export const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { value: 'en', label: 'English', tag: 'en-TN' },
  { value: 'fr', label: 'Français', tag: 'fr-TN' },
  { value: 'ar', label: 'العربية', tag: 'ar-TN-u-nu-latn' },
];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function localeTag(locale: Locale): string {
  return LOCALE_OPTIONS.find((option) => option.value === locale)?.tag ?? 'en-TN';
}

export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

function storedLocale(): Locale | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function detectLocale(): Locale {
  const stored = storedLocale();
  if (stored) return stored;

  const languages =
    typeof navigator === 'undefined'
      ? []
      : [...(navigator.languages ?? []), navigator.language].filter(Boolean);

  for (const language of languages) {
    const prefix = language.toLowerCase().slice(0, 2);
    if (isLocale(prefix)) return prefix;
  }

  return DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable in private modes; the session still works.
  }
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDirection(locale);
}
