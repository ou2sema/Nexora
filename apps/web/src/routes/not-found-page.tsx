import { Link } from 'react-router';

import { useI18n } from '@/i18n/provider';

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {t('layout.notFound.title')}
      </h1>
      <p className="mt-2 text-sm text-slate-600">{t('layout.notFound.body')}</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        {t('layout.notFound.back')}
      </Link>
    </div>
  );
}
