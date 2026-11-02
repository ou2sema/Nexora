import type { StockCountSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';

export function OpenCountsPanel({
  counts,
  loading,
  activeCountId,
  onResume,
}: {
  counts: StockCountSummary[];
  loading: boolean;
  activeCountId: string | null;
  onResume: (count: StockCountSummary) => void;
}) {
  const { t, plural, formatDate } = useI18n();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{t('scan.count.openCounts')}</h2>
      {loading ? (
        <p className="mt-2 text-sm text-slate-500">{t('scan.count.loadingOpen')}</p>
      ) : counts.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{t('scan.count.noneOpen')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {counts.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <p dir="ltr" className="font-mono text-xs text-slate-700">
                  {item.warehouseCode} / {item.locationCode}
                </p>
                <p className="text-xs text-slate-500">
                  {t('scan.count.itemSummary', {
                    lines: plural('scan.lines', item.lineCount),
                    date: formatDate(item.createdAt),
                  })}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onResume(item)}
                disabled={item.id === activeCountId}
              >
                {item.id === activeCountId ? t('scan.count.selected') : t('scan.count.resume')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
