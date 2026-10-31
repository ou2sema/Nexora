import { formatTnd } from '@mystock/domain';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ApiError } from '@/lib/api-client';

import { codeMessageKey, EXPORT_TOO_LARGE, textMessageKey } from './errors';
import {
  applyDocumentLocale,
  detectLocale,
  localeDirection,
  localeTag,
  persistLocale,
  type Locale,
} from './locales';
import {
  catalogs,
  enMessages,
  type MessageKey,
  type MessageValues,
  type PluralBase,
} from './messages';
import { interpolate } from './translate';

interface I18nContextValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  tag: string;
  setLocale(locale: Locale): void;
  t(key: MessageKey, values?: MessageValues): string;
  plural(base: PluralBase, count: number, values?: MessageValues): string;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatQuantity(value: number | string): string;
  formatMoney(minor: number): string;
  formatDate(value: string | Date): string;
  formatDateTime(value: string | Date): string;
  errorMessage(error: unknown, fallbackKey?: MessageKey): string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const formatters = useMemo(() => {
    const tag = localeTag(locale);
    return {
      tag,
      number: new Intl.NumberFormat(tag),
      quantity: new Intl.NumberFormat(tag, { maximumFractionDigits: 4 }),
      date: new Intl.DateTimeFormat(tag, { dateStyle: 'medium' }),
      dateTime: new Intl.DateTimeFormat(tag, {
        dateStyle: 'medium',
        timeStyle: 'short',
        // CLDR's fr-TN defaults to a 12-hour clock with an English "PM"; French
        // administrative UI reads 24-hour times.
        hourCycle: locale === 'fr' ? 'h23' : undefined,
      }),
      plural: new Intl.PluralRules(tag),
    };
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, values?: MessageValues): string => {
      const template = catalogs[locale][key] ?? enMessages[key] ?? key;
      return interpolate(template, values);
    },
    [locale],
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions): string =>
      new Intl.NumberFormat(formatters.tag, options).format(value),
    [formatters.tag],
  );

  const plural = useCallback(
    (base: PluralBase, count: number, values?: MessageValues): string => {
      const category = formatters.plural.select(count);
      const key = `${base}.${category}` as MessageKey;
      const template =
        catalogs[locale][key] ?? catalogs[locale][`${base}.other` as MessageKey] ?? String(count);
      return interpolate(template, { count: formatters.number.format(count), ...values });
    },
    [formatters, locale],
  );

  const formatQuantity = useCallback(
    (value: number | string): string => {
      const numeric = typeof value === 'string' ? Number(value) : value;
      return Number.isFinite(numeric) ? formatters.quantity.format(numeric) : String(value);
    },
    [formatters.quantity],
  );

  const formatMoney = useCallback(
    (minor: number): string => formatTnd(minor, formatters.tag),
    [formatters.tag],
  );

  const formatDate = useCallback(
    (value: string | Date): string => formatters.date.format(toDate(value)),
    [formatters.date],
  );

  const formatDateTime = useCallback(
    (value: string | Date): string => formatters.dateTime.format(toDate(value)),
    [formatters.dateTime],
  );

  const errorMessage = useCallback(
    (error: unknown, fallbackKey?: MessageKey): string => {
      if (error instanceof ApiError) {
        if (error.code === 'export_too_large') {
          const match = EXPORT_TOO_LARGE.exec(error.message);
          if (match) {
            return t('errors.code.export_too_large', {
              limit: formatters.number.format(Number(match[1])),
            });
          }
        }
        const key = textMessageKey(error.message) ?? codeMessageKey(error.code);
        if (key) return t(key);
        if (fallbackKey) return t(fallbackKey);
        return error.message;
      }

      if (error instanceof Error) {
        if (error.message === 'Failed to fetch' || error.message === 'Load failed') {
          return t('errors.network');
        }
        const key = textMessageKey(error.message);
        if (key) return t(key);
        if (fallbackKey) return t(fallbackKey);
        return error.message;
      }

      return fallbackKey ? t(fallbackKey) : t('errors.generic');
    },
    [formatters.number, t],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: localeDirection(locale),
      tag: formatters.tag,
      setLocale,
      t,
      plural,
      formatNumber,
      formatQuantity,
      formatMoney,
      formatDate,
      formatDateTime,
      errorMessage,
    }),
    [
      locale,
      formatters.tag,
      setLocale,
      t,
      plural,
      formatNumber,
      formatQuantity,
      formatMoney,
      formatDate,
      formatDateTime,
      errorMessage,
    ],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
