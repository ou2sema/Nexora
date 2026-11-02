import { Send } from 'lucide-react';
import { Link } from 'react-router';

import type { ProductSummary, WarehouseSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';

import { LocationPicker } from './location-picker';

export function ReceivePanel({
  warehouses,
  warehouseId,
  locationId,
  onLocationChange,
  quantity,
  onQuantityChange,
  product,
  canWrite,
  posting,
  busy,
  onSubmit,
}: {
  warehouses: WarehouseSummary[];
  warehouseId: string;
  locationId: string;
  onLocationChange: (warehouseId: string, locationId: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  product: ProductSummary | null;
  canWrite: boolean;
  posting: boolean;
  busy: boolean;
  onSubmit: () => void;
}) {
  const { t } = useI18n();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{t('scan.receive.title')}</h2>
      <p className="mt-1 text-sm text-slate-600">{t('scan.receive.description')}</p>

      <div className="mt-4">
        <LocationPicker
          warehouses={warehouses}
          warehouseId={warehouseId}
          locationId={locationId}
          onChange={onLocationChange}
          disabled={!canWrite}
        />
      </div>

      <label className="mt-3 block text-sm font-medium text-slate-700">
        {t('common.quantity')}
        <input
          type="number"
          min={0}
          step="0.0001"
          value={quantity}
          disabled={!canWrite}
          className={fieldClass}
          onChange={(event) => onQuantityChange(event.target.value)}
        />
      </label>

      <Button
        className="mt-4 w-full"
        disabled={!canWrite || !product || product.isSerialized || busy}
        onClick={onSubmit}
      >
        <Send aria-hidden="true" className="size-4" />
        {posting ? t('scan.receive.posting') : t('scan.receive.post')}
      </Button>

      {product?.isSerialized && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {t('scan.receive.serializedBefore')}
          <Link className="font-semibold text-indigo-700" to="/devices">
            {t('nav.devices')}
          </Link>
          {t('scan.receive.serializedAfter')}
        </p>
      )}
    </section>
  );
}
