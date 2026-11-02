import type { WarehouseSummary } from '@mystock/contracts';

import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';

export function LocationPicker({
  warehouses,
  warehouseId,
  locationId,
  onChange,
  disabled,
}: {
  warehouses: WarehouseSummary[];
  warehouseId: string;
  locationId: string;
  onChange: (warehouseId: string, locationId: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const warehouse = warehouses.find((item) => item.id === warehouseId);
  const locations = warehouse?.locations ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium text-slate-700">
        {t('common.warehouse')}
        <select
          value={warehouseId}
          disabled={disabled}
          className={fieldClass}
          onChange={(event) => onChange(event.target.value, '')}
        >
          <option value="">{t('common.selectWarehouseShort')}</option>
          {warehouses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        {t('common.storageLocation')}
        <select
          value={locationId}
          disabled={disabled || !warehouseId}
          className={fieldClass}
          onChange={(event) => onChange(warehouseId, event.target.value)}
        >
          <option value="">{t('common.selectLocationShort')}</option>
          {locations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
