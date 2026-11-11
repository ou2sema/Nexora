import { ScanLine } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import type { ScanResult } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useAccessToken } from '@/features/auth/auth-provider';
import { useOrganization } from '@/features/organizations/organization-provider';
import { scanCode } from '@/features/scanning/api';
import { LabelDialog, type LabelTarget } from '@/features/scanning/label-dialog';
import { ScanResultCard } from '@/features/scanning/scan-result-card';
import { useScanWedge } from '@/features/scanning/scan-wedge';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';

export function CounterLanding() {
  const { t, errorMessage } = useI18n();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const token = useAccessToken();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [labelTargets, setLabelTargets] = useState<LabelTarget[] | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const lookup = async (raw: string) => {
    const value = raw.trim();
    if (!value || !organizationId || busy) return;

    setBusy(true);
    setError(null);
    try {
      setResult(await scanCode(organizationId, token, value));
    } catch (cause) {
      setResult(null);
      setError(errorMessage(cause, 'scan.error.resolveFailed'));
    } finally {
      setBusy(false);
    }
  };

  useScanWedge({
    active: true,
    targetRef: codeRef,
    getManualValue: () => code,
    onCapture: (capture) => {
      setCode('');
      void lookup(capture.rawValue);
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('nav.dashboard')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t('dashboard.counter.subtitle')}</p>
      </header>

      <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
        {t('dashboard.counter.readOnly')}
      </p>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">{t('scan.lookupSection')}</h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="counter-code" className="sr-only">
            {t('scan.codeLabel')}
          </label>
          <input
            id="counter-code"
            ref={codeRef}
            value={code}
            dir="ltr"
            autoFocus
            autoComplete="off"
            placeholder={t('scan.codePlaceholder')}
            className={`${fieldClass} mt-0 flex-1`}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button
            type="button"
            disabled={!code.trim() || busy}
            onClick={() => {
              const value = code.trim();
              setCode('');
              void lookup(value);
            }}
          >
            <ScanLine aria-hidden="true" className="size-4" />
            {busy ? t('dashboard.counter.lookingUp') : t('scan.lookup')}
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
          <Link to="/stock" className="text-indigo-700 hover:text-indigo-900">
            {t('nav.stock')}{' '}
            <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
              →
            </span>
          </Link>
          <Link to="/guide" className="text-indigo-700 hover:text-indigo-900">
            {t('nav.guide')}{' '}
            <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
              →
            </span>
          </Link>
        </div>
      </section>

      {result ? (
        <ScanResultCard result={result} onPrint={(targets) => setLabelTargets(targets)} />
      ) : (
        <section className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
            <ScanLine aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-slate-900">{t('scan.empty.title')}</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">{t('scan.empty.body')}</p>
        </section>
      )}

      {organizationId && labelTargets && (
        <LabelDialog
          organizationId={organizationId}
          targets={labelTargets}
          open={Boolean(labelTargets)}
          onOpenChange={(open) => {
            if (!open) setLabelTargets(null);
          }}
        />
      )}
    </div>
  );
}
