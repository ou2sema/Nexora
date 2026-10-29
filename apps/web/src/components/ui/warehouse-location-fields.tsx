import type { UseFormRegisterReturn } from 'react-hook-form';

import type { WarehouseSummary } from '@mystock/contracts';

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
  warehouseLabel = 'Warehouse',
  locationLabel = 'Storage location',
}: WarehouseLocationFieldsProps) {
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId);
  const locations = selectedWarehouse?.locations ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label
          htmlFor={`${idPrefix}-warehouse`}
          className="block text-sm font-medium text-slate-700"
        >
          {warehouseLabel}
        </label>
        <select id={`${idPrefix}-warehouse`} className={fieldClass} {...warehouseField}>
          <option value="">Select a warehouse</option>
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
          {locationLabel}
        </label>
        <select
          id={`${idPrefix}-location`}
          className={fieldClass}
          disabled={!selectedWarehouse}
          {...locationField}
        >
          <option value="">
            {selectedWarehouse ? 'Select a location' : 'Choose a warehouse first'}
          </option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.code} · {location.name}
            </option>
          ))}
        </select>
        {selectedWarehouse && locations.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">
            This warehouse has no storage locations yet.
          </p>
        )}
      </div>
    </div>
  );
}
