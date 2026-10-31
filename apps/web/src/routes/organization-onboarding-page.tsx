import { Building2 } from 'lucide-react';

import { useI18n } from '@/i18n/provider';

export function OrganizationOnboardingPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <span className="grid size-12 place-items-center rounded-full bg-indigo-50 text-indigo-600">
          <Building2 aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
          {t('organizations.onboarding.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{t('organizations.onboarding.body')}</p>
        <p className="mt-4 text-sm text-slate-500">{t('organizations.onboarding.note')}</p>
      </div>
    </div>
  );
}
