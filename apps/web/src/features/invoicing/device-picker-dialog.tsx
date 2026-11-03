import { useEffect, useState } from 'react';

import type { DeviceSummary, ProductSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useDevices } from '@/features/devices/api';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const DEVICE_PAGE_SIZE = 25;

interface DevicePickerDialogProps {
  organizationId: string;
  product: ProductSummary | null;
  warehouseId: string;
  locationId: string;
  locationLabel: string;
  onOpenChange: (open: boolean) => void;
  onPick: (device: DeviceSummary) => void;
}

/**
 * Serialized stock is sold one unit at a time, so the counter asks which unit
 * before anything enters the basket. Only units that are in stock at the depot
 * the invoice will issue from are offered — the choice is pre-filtered, but the
 * database still owns the decision.
 */
export function DevicePickerDialog({
  organizationId,
  product,
  warehouseId,
  locationId,
  locationLabel,
  onOpenChange,
  onPick,
}: DevicePickerDialogProps) {
  const { t, plural, errorMessage, formatDate } = useI18n();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    setSearch('');
  }, [product?.id]);

  const devices = useDevices(organizationId, {
    search: debouncedSearch,
    status: 'in_stock',
    productId: product?.id,
    warehouseId,
    page: 1,
    pageSize: DEVICE_PAGE_SIZE,
  });

  const here = (devices.data?.items ?? []).filter((device) => device.locationId === locationId);
  const open = Boolean(product);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>
          {product
            ? t('sale.device.pickTitle', { product: product.name })
            : t('sale.device.picking')}
        </DialogTitle>
        <DialogDescription>
          {product
            ? plural('sale.device.inStock', here.length, { location: locationLabel })
            : t('sale.device.pickDescriptionEmpty')}
        </DialogDescription>

        {!warehouseId || !locationId ? (
          <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t('sale.device.locationRequired')}
          </p>
        ) : (
          <>
            <div className="mt-4">
              <label htmlFor="sale-device-search" className="sr-only">
                {t('sale.device.searchLabel')}
              </label>
              <input
                id="sale-device-search"
                type="search"
                value={search}
                placeholder={t('sale.device.searchPlaceholder')}
                autoComplete="off"
                className={`${fieldClass} mt-0`}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {devices.isError ? (
              <p role="alert" className="mt-3 text-sm text-rose-700">
                {errorMessage(devices.error, 'sale.device.loadFailed')}
              </p>
            ) : devices.isPending ? (
              <p role="status" className="mt-3 text-sm text-slate-500">
                {t('sale.device.loading')}
              </p>
            ) : here.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">{t('sale.device.empty')}</p>
            ) : (
              <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {here.map((device) => (
                  <li key={device.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p
                        dir="ltr"
                        className="break-all font-mono text-sm font-medium text-slate-900"
                      >
                        {device.serialNumber}
                      </p>
                      <p className="mt-0.5 break-all text-xs text-slate-500">
                        {device.locationCode}
                        {device.imei && (
                          <>
                            {' · '}
                            <span dir="ltr">{device.imei}</span>
                          </>
                        )}
                        {' · '}
                        {formatDate(device.receivedAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        onPick(device);
                        onOpenChange(false);
                      }}
                    >
                      {t('sale.device.choose')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
