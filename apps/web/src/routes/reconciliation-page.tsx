import { RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useRepairStockBalances, useStockReconciliation } from '@/features/stock/api';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

export function ReconciliationPage() {
  const { t, plural, formatNumber, formatQuantity, errorMessage } = useI18n();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const reconciliation = useStockReconciliation(organizationId, canWrite);
  const repair = useRepairStockBalances(organizationId ?? '');
  const [confirmApply, setConfirmApply] = useState(false);

  const rows = reconciliation.data ?? [];
  const drift = rows.filter((row) => row.difference !== 0);

  const repairError = repair.error ? errorMessage(repair.error) : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('reconciliation.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t('reconciliation.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!canWrite || reconciliation.isFetching}
            onClick={() => void reconciliation.refetch()}
          >
            <RefreshCw
              aria-hidden="true"
              className={cn('size-4', reconciliation.isFetching && 'animate-spin')}
            />
            {t('reconciliation.runCheck')}
          </Button>
          <Button
            variant="secondary"
            disabled={!canWrite || repair.isPending}
            onClick={() => void repair.mutateAsync(true).catch(() => undefined)}
          >
            <ShieldCheck aria-hidden="true" className="size-4" />
            {t('reconciliation.dryRun')}
          </Button>
          <Button
            disabled={!canWrite || repair.isPending || drift.length === 0}
            onClick={() => setConfirmApply(true)}
          >
            <Wrench aria-hidden="true" className="size-4" />
            {t('reconciliation.applyRepair')}
          </Button>
        </div>
      </header>

      {!canWrite ? (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          {t('reconciliation.readOnly')}
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              {reconciliation.isPending
                ? t('reconciliation.checking')
                : drift.length === 0
                  ? t('reconciliation.agree')
                  : t('reconciliation.outOfBalance', {
                      lines: plural('common.noun.stockLines', drift.length),
                    })}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('reconciliation.explainer')}</p>
          </section>

          {repairError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {repairError}
            </p>
          )}

          {reconciliation.isError ? (
            <section className="rounded-xl border border-rose-200 bg-white p-6">
              <p role="alert" className="text-sm text-rose-700">
                {reconciliation.error
                  ? errorMessage(reconciliation.error, 'reconciliation.loadError')
                  : t('reconciliation.loadError')}
              </p>
            </section>
          ) : reconciliation.isPending ? (
            <div
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
              role="status"
              aria-label={t('reconciliation.loading')}
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-4 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-6">
              <p className="text-sm text-slate-600">{t('reconciliation.empty')}</p>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <caption className="sr-only">{t('reconciliation.tableCaption')}</caption>
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="px-4 py-3 font-semibold">
                        {t('common.product')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        {t('common.location')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-end font-semibold">
                        {t('reconciliation.columns.balance')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-end font-semibold">
                        {t('reconciliation.columns.ledger')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-end font-semibold">
                        {t('reconciliation.columns.difference')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-end font-semibold">
                        {t('reconciliation.columns.movements')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr
                        key={`${row.productId}-${row.warehouseId}-${row.locationId}`}
                        className={cn(
                          'hover:bg-slate-50',
                          row.difference !== 0 && 'bg-amber-50/60',
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{row.productName}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-500">
                            <span dir="ltr">{row.productSku}</span>
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          <span dir="ltr">
                            {row.warehouseCode} / {row.locationCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums text-slate-700">
                          {formatQuantity(row.balanceOnHand)}
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums text-slate-700">
                          {formatQuantity(row.ledgerOnHand)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-end font-medium tabular-nums',
                            row.difference === 0 ? 'text-emerald-700' : 'text-rose-700',
                          )}
                        >
                          <span dir="ltr">
                            {row.difference > 0 ? '+' : ''}
                            {formatQuantity(row.difference)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums text-slate-600">
                          {formatNumber(row.movementCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {repair.data && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  {t('reconciliation.repairResult', {
                    status: t(
                      repair.data.some((row) => row.repaired)
                        ? 'reconciliation.repairStatus.applied'
                        : 'reconciliation.repairStatus.dryRun',
                    ),
                  })}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {repair.data.length === 0
                    ? t('reconciliation.repairEmpty')
                    : t('reconciliation.repairApplied')}
                </p>
              </div>
              {repair.data.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-sm">
                    <caption className="sr-only">{t('reconciliation.repairTableCaption')}</caption>
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {t('common.product')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {t('common.location')}
                        </th>
                        <th scope="col" className="px-4 py-3 text-end font-semibold">
                          {t('reconciliation.columns.previous')}
                        </th>
                        <th scope="col" className="px-4 py-3 text-end font-semibold">
                          {t('reconciliation.columns.ledger')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {t('reconciliation.columns.applied')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {repair.data.map((row) => (
                        <tr key={`${row.productId}-${row.warehouseId}-${row.locationId}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{row.productName}</p>
                            <p className="mt-0.5 font-mono text-xs text-slate-500">
                              <span dir="ltr">{row.productSku}</span>
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">
                            <span dir="ltr">
                              {row.warehouseCode} / {row.locationCode}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-end tabular-nums text-slate-700">
                            {formatQuantity(row.previousOnHand)}
                          </td>
                          <td className="px-4 py-3 text-end tabular-nums text-slate-700">
                            {formatQuantity(row.ledgerOnHand)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                                row.repaired
                                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                                  : 'bg-slate-100 text-slate-700 ring-slate-200',
                              )}
                            >
                              {row.repaired
                                ? t('reconciliation.badge.repaired')
                                : t('reconciliation.badge.dryRun')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <Dialog open={confirmApply} onOpenChange={setConfirmApply}>
        <DialogContent>
          <DialogTitle>{t('reconciliation.confirm.title')}</DialogTitle>
          <DialogDescription>
            {t('reconciliation.confirm.description', {
              projections: plural('reconciliation.projections', drift.length),
            })}
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={repair.isPending}
              onClick={async () => {
                try {
                  await repair.mutateAsync(false);
                  setConfirmApply(false);
                } catch {
                  // repair.error renders on the page.
                }
              }}
            >
              {repair.isPending ? t('reconciliation.repairing') : t('reconciliation.applyRepair')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
