import { MapPin } from 'lucide-react';

import type { WarehouseSummary } from '@mystock/contracts';

import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';

/** The pair the counter issues from, encoded in the one field the operator sees. */
export const pairValue = (warehouseId: string, locationId: string) =>
  `${warehouseId}|${locationId}`;

export function splitPair(value: string): { warehouseId: string; locationId: string } {
  const [warehouseId = '', locationId = ''] = value.split('|');
  return { warehouseId, locationId };
}

/** `Tunis · Main store`, or the depot code when a name is missing. */
export function pairLabel(
  warehouses: WarehouseSummary[],
  warehouseId: string,
  locationId: string,
): string | null {
  const warehouse = warehouses.find((entry) => entry.id === warehouseId);
  const location = warehouse?.locations.find((entry) => entry.id === locationId);
  if (!warehouse || !location) return null;

  return `${warehouse.name || warehouse.code} · ${location.name || location.code}`;
}

interface SellingLocationSelectProps {
  warehouses: WarehouseSummary[];
  warehouseId: string;
  locationId: string;
  canWrite: boolean;
  invalid?: boolean;
  onChange: (warehouseId: string, locationId: string) => void;
}

/**
 * One field instead of a depot select beside a location select: at a counter the
 * pair is decided together, and the shelf the sale leaves from is the fact the
 * operator cares about.
 */
export function SellingLocationSelect({
  warehouses,
  warehouseId,
  locationId,
  canWrite,
  invalid = false,
  onChange,
}: SellingLocationSelectProps) {
  const { t } = useI18n();

  const options: { value: string; label: string }[] = [];
  for (const warehouse of warehouses) {
    if (!warehouse.isActive) continue;
    for (const location of warehouse.locations) {
      if (!location.isActive) continue;
      options.push({
        value: pairValue(warehouse.id, location.id),
        label: `${warehouse.name || warehouse.code} · ${location.name || location.code}`,
      });
    }
  }

  const selected = pairValue(warehouseId, locationId);

  return (
    <div>
      <label htmlFor="sale-selling-location" className="block text-xs font-medium text-slate-600">
        {t('sale.location.label')}
      </label>
      <div className="relative">
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-indigo-500"
        />
        <select
          id="sale-selling-location"
          value={options.some((option) => option.value === selected) ? selected : ''}
          disabled={!canWrite}
          aria-invalid={invalid}
          className={cn(fieldClass, 'ps-9', invalid && 'border-rose-400')}
          onChange={(event) => {
            const next = splitPair(event.target.value);
            onChange(next.warehouseId, next.locationId);
          }}
        >
          <option value="" disabled>
            {t('sale.location.placeholder')}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
