import { Send } from 'lucide-react';

import type { StockCount, StockCountStatus } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

const countStatusKeys: Record<StockCountStatus, MessageKey> = {
  open: 'scan.count.status.open',
  posted: 'scan.count.status.posted',
  cancelled: 'scan.count.status.cancelled',
};

export interface CountTotals {
  lines: number;
  variance: number;
  negative: number;
}

export function CountLinesSection({
  count,
  totals,
  canWrite,
  busy,
  posting,
  confirmPost,
  onAskConfirm,
  onCancelConfirm,
  onPost,
  onDiscard,
}: {
  count: StockCount;
  totals: CountTotals;
  canWrite: boolean;
  busy: boolean;
  posting: boolean;
  confirmPost: boolean;
  onAskConfirm: () => void;
  onCancelConfirm: () => void;
  onPost: () => void;
  onDiscard: () => void;
}) {
  const { t, plural, formatQuantity } = useI18n();

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t('scan.count.title')}</h2>
          <p className="font-mono text-xs text-slate-500">
            {t('scan.count.lineSummary', {
              location: `${count.warehouseCode} / ${count.locationCode}`,
              lines: plural('scan.lines', count.lineCount),
              variance: formatQuantity(totals.variance),
            })}
          </p>
        </div>
        <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-indigo-800 ring-1 ring-indigo-200">
          {t(countStatusKeys[count.status])}
        </span>
      </header>

      {count.lines.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-600">{t('scan.count.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <caption className="sr-only">{t('scan.count.caption')}</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th scope="col" className="px-5 py-3 font-semibold">
                  {t('common.product')}
                </th>
                <th scope="col" className="px-5 py-3 text-end font-semibold">
                  {t('scan.count.onHand')}
                </th>
                <th scope="col" className="px-5 py-3 text-end font-semibold">
                  {t('scan.count.counted')}
                </th>
                <th scope="col" className="px-5 py-3 text-end font-semibold">
                  {t('scan.count.varianceColumn')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {count.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{line.productName}</p>
                    <p dir="ltr" className="font-mono text-xs text-slate-500">
                      {line.productSku}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-end tabular-nums text-slate-600">
                    {formatQuantity(line.onHand)}
                  </td>
                  <td className="px-5 py-3 text-end tabular-nums text-slate-900">
                    {formatQuantity(line.countedQuantity)}
                  </td>
                  <td
                    className={cn(
                      'px-5 py-3 text-end font-medium tabular-nums',
                      line.variance === 0
                        ? 'text-slate-500'
                        : line.variance > 0
                          ? 'text-emerald-700'
                          : 'text-rose-700',
                    )}
                  >
                    {line.variance > 0 ? '+' : ''}
                    {formatQuantity(line.variance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="space-y-3 border-t border-slate-200 px-5 py-4">
        {confirmPost ? (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              {t('scan.count.confirm', {
                adjustments: plural('scan.adjustments', totals.negative),
                quantity: formatQuantity(totals.variance),
              })}
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={posting} onClick={onPost}>
                <Send aria-hidden="true" className="size-4" />
                {posting ? t('scan.count.posting') : t('scan.count.confirmPost')}
              </Button>
              <Button variant="secondary" size="sm" onClick={onCancelConfirm} disabled={posting}>
                {t('scan.count.keepCounting')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button disabled={!canWrite || count.lineCount === 0 || busy} onClick={onAskConfirm}>
              <Send aria-hidden="true" className="size-4" />
              {t('scan.count.post')}
            </Button>
            <Button variant="secondary" disabled={!canWrite || busy} onClick={onDiscard}>
              {t('scan.count.discard')}
            </Button>
          </div>
        )}
      </footer>
    </section>
  );
}
