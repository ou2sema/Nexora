import type { UseFormRegisterReturn } from 'react-hook-form';

import type { WarehouseSummary } from '@mystock/contracts';

import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';

interface WarehouseLocationFieldsProps {
  idPrefix: string;
  warehouses: WarehouseSummary[];
  warehouseField: UseFormRegisterReturn;
  locationField: UseFormRegisterReturn;
  selectedWarehouseId: string;
  warehouseLabel?: string;
  locationLabel?: string;
}

export function WarehouseLocationFields({
  idPrefix,
  warehouses,
  warehouseField,
  locationField,
  selectedWarehouseId,
  warehouseLabel,
  locationLabel,
}: WarehouseLocationFieldsProps) {
  const { t } = useI18n();
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId);
  const locations = selectedWarehouse?.locations ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label
          htmlFor={`${idPrefix}-warehouse`}
          className="block text-sm font-medium text-slate-700"
        >
          {warehouseLabel ?? t('common.warehouse')}
        </label>
        <select id={`${idPrefix}-warehouse`} className={fieldClass} {...warehouseField}>
          <option value="">{t('common.selectWarehouse')}</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} · {warehouse.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-location`}
          className="block text-sm font-medium text-slate-700"
        >
          {locationLabel ?? t('common.storageLocation')}
        </label>
        <select
          id={`${idPrefix}-location`}
          className={fieldClass}
          disabled={!selectedWarehouse}
          {...locationField}
        >
          <option value="">
            {selectedWarehouse ? t('common.selectLocation') : t('common.chooseWarehouseFirst')}
          </option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.code} · {location.name}
            </option>
          ))}
        </select>
        {selectedWarehouse && locations.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">{t('common.noLocations')}</p>
        )}
      </div>
    </div>
  );
}
