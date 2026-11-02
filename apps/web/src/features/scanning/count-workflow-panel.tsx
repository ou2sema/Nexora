import { ClipboardCheck } from 'lucide-react';

import type { ProductSummary, StockCount, WarehouseSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';

import { LocationPicker } from './location-picker';

export type CountMode = 'increment' | 'set';

export function CountWorkflowPanel({
  count,
  product,
  warehouses,
  warehouseId,
  locationId,
  onLocationChange,
  quantity,
  onQuantityChange,
  mode,
  onModeChange,
  canWrite,
  starting,
  recording,
  busy,
  onStart,
  onRecord,
}: {
  count: StockCount | null;
  product: ProductSummary | null;
  warehouses: WarehouseSummary[];
  warehouseId: string;
  locationId: string;
  onLocationChange: (warehouseId: string, locationId: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  mode: CountMode;
  onModeChange: (mode: CountMode) => void;
  canWrite: boolean;
  starting: boolean;
  recording: boolean;
  busy: boolean;
  onStart: () => void;
  onRecord: () => void;
}) {
  const { t } = useI18n();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">
        {count ? t('scan.count.recordTitle') : t('scan.count.startTitle')}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {count ? t('scan.count.recordDescription') : t('scan.count.startDescription')}
      </p>

      {!count ? (
        <>
          <div className="mt-4">
            <LocationPicker
              warehouses={warehouses}
              warehouseId={warehouseId}
              locationId={locationId}
              onChange={onLocationChange}
              disabled={!canWrite}
            />
          </div>
          <Button
            className="mt-4 w-full"
            disabled={!canWrite || !warehouseId || !locationId || busy}
            onClick={onStart}
          >
            <ClipboardCheck aria-hidden="true" className="size-4" />
            {starting ? t('scan.count.starting') : t('scan.count.start')}
          </Button>
        </>
      ) : (
        <>
          {product && !product.isSerialized ? (
            <>
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-medium">{product.name}</span>
                <span dir="ltr" className="font-mono text-xs text-slate-500">
                  {' '}
                  · {product.sku}
                </span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-sm font-medium text-slate-700">
                  {t('common.quantity')}
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={quantity}
                    className={fieldClass}
                    onChange={(event) => onQuantityChange(event.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  {t('scan.count.mode')}
                  <select
                    value={mode}
                    className={fieldClass}
                    onChange={(event) => onModeChange(event.target.value as CountMode)}
                  >
                    <option value="increment">{t('scan.count.addToLine')}</option>
                    <option value="set">{t('scan.count.setExact')}</option>
                  </select>
                </label>
              </div>
              <Button className="mt-3 w-full" disabled={!canWrite || recording} onClick={onRecord}>
                <ClipboardCheck aria-hidden="true" className="size-4" />
                {recording ? t('scan.count.recording') : t('scan.count.record')}
              </Button>
            </>
          ) : product ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t('scan.count.serializedHelp')}
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {t('scan.count.scanQuantityProduct')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
