import { Languages } from 'lucide-react';

import { isLocale, LOCALE_OPTIONS } from '@/i18n/locales';
import { useI18n } from '@/i18n/provider';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-700 shadow-sm">
      <Languages aria-hidden="true" className="size-4 text-slate-500" />
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
        className="cursor-pointer appearance-none bg-transparent pe-1 text-sm font-medium text-slate-800 focus:outline-none"
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} lang={option.tag}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
