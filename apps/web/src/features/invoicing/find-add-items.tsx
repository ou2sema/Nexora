import { CheckCircle2, MapPin, Package, Plus, Smartphone, TriangleAlert } from 'lucide-react';

import { useMemo, useState } from 'react';

import type { ProductSummary, StockLevelSummary, WarehouseSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useStockLevels } from '@/features/stock/api';
import type { ScanCapture } from '@/features/scanning/scan-wedge';
import { useI18n } from '@/i18n/provider';

import { ScanBox } from './scan-box';
import { SellingLocationSelect, pairLabel } from './selling-location';

const QUICK_ADD_PAGE_SIZE = 8;

interface FindAddItemsProps {
  organizationId: string;
  /** The active catalogue, already loaded by the counter: it prices a quick add. */
  products: ProductSummary[];
  shelfLoading: boolean;
  warehouses: WarehouseSummary[];
  warehouseId: string;
  locationId: string;
  canWrite: boolean;
  /** A read is being resolved; the field keeps typing but a second capture waits. */
  busy: boolean;
  /** Whether the wedge is listening, which is what the header status reports. */
  scannerReady: boolean;
  notice: string | null;
  scanError: string | null;
  onLocationChange: (warehouseId: string, locationId: string) => void;
  onCapture: (capture: ScanCapture) => void;
  onAddProduct: (product: ProductSummary) => void;
  onPickDevice: (product: ProductSummary) => void;
}

/**
 * The whole "get an item into the basket" half of the counter: where it leaves
 * from, one field that reads codes and searches the shelf at the same time, and
 * the stock of that shelf as buttons.
 */
export function FindAddItems({
  organizationId,
  products,
  shelfLoading,
  warehouses,
  warehouseId,
  locationId,
  canWrite,
  busy,
  scannerReady,
  notice,
  scanError,
  onLocationChange,
  onCapture,
  onAddProduct,
  onPickDevice,
}: FindAddItemsProps) {
  const { t, plural, formatMoney } = useI18n();
  const [query, setQuery] = useState('');
  const [changingShelf, setChangingShelf] = useState(false);

  const levels = useStockLevels(organizationId, {
    search: '',
    warehouseId,
    locationId,
    page: 1,
    pageSize: QUICK_ADD_PAGE_SIZE,
  });

  const locationName = pairLabel(warehouses, warehouseId, locationId);
  const trimmedQuery = query.trim().toLowerCase();

  const quickAdd = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    const entries: { level: StockLevelSummary; product: ProductSummary }[] = [];

    for (const level of levels.data?.items ?? []) {
      const product = byId.get(level.productId);
      if (product) entries.push({ level, product });
    }

    return entries.filter(
      ({ level, product }) =>
        trimmedQuery === '' ||
        product.name.toLowerCase().includes(trimmedQuery) ||
        product.sku.toLowerCase().includes(trimmedQuery) ||
        level.sku.toLowerCase().includes(trimmedQuery),
    );
  }, [levels.data, products, trimmedQuery]);

  return (
    <section
      aria-labelledby="sale-find-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sale-find-heading" className="text-lg font-semibold text-slate-900">
          {t('sale.find.title')}
        </h2>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          {busy ? (
            t('sale.scan.resolving')
          ) : scannerReady ? (
            <>
              <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-600" />
              {t('sale.scan.ready')}
            </>
          ) : (
            <>
              <TriangleAlert aria-hidden="true" className="size-3.5 text-amber-600" />
              {t('sale.scan.paused')}
            </>
          )}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {/* The scan usually settles the shelf, so once it is known the field
            collapses into the one line it proves. `Change shelf` brings the
            select back for the cases the read cannot answer. */}
        {locationName === null || changingShelf ? (
          <SellingLocationSelect
            warehouses={warehouses}
            warehouseId={warehouseId}
            locationId={locationId}
            canWrite={canWrite}
            onChange={(nextWarehouseId, nextLocationId) => {
              setChangingShelf(false);
              onLocationChange(nextWarehouseId, nextLocationId);
            }}
          />
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
              <MapPin aria-hidden="true" className="size-4 shrink-0 text-indigo-500" />
              <span className="truncate">
                {t('sale.location.leavesFrom', { location: locationName })}
              </span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canWrite}
              className="shrink-0 text-indigo-700"
              onClick={() => setChangingShelf(true)}
            >
              {t('sale.location.change')}
            </Button>
          </div>
        )}

        <ScanBox
          active={canWrite && scannerReady}
          disabled={!canWrite}
          value={query}
          onValueChange={setQuery}
          onCapture={onCapture}
        />
      </div>

      {notice && !busy && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {notice}
        </p>
      )}
      {scanError && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {scanError}
        </p>
      )}

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('sale.quickAdd.title')}
          </h3>
          {locationName !== null && (
            <p className="text-xs text-slate-500">
              {plural('common.noun.products', quickAdd.length)}
            </p>
          )}
        </div>

        {!warehouseId || !locationId ? (
          <p className="mt-3 text-sm text-slate-500">{t('sale.quickAdd.pickLocation')}</p>
        ) : levels.isPending || shelfLoading ? (
          <p className="mt-3 text-sm text-slate-500">{t('sale.quickAdd.loading')}</p>
        ) : levels.isError ? (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {t('sale.quickAdd.failed')}
          </p>
        ) : quickAdd.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t('sale.quickAdd.empty')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {quickAdd.map(({ level, product }) => (
              <li key={product.id} className="flex items-center gap-3 py-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
                >
                  {product.isSerialized ? (
                    <Smartphone className="size-5" />
                  ) : (
                    <Package className="size-5" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {/* The shelf is in the heading above, so the row only counts. */}
                    {product.isSerialized
                      ? t('sale.quickAdd.devicesAvailable', {
                          devices: plural('common.noun.devices', level.available),
                        })
                      : t('sale.quickAdd.unitsInStock', {
                          units: plural('common.noun.units', level.onHand),
                        })}
                  </p>
                </div>

                <div className="hidden text-end sm:block">
                  <p className="font-mono text-sm font-semibold text-slate-900">
                    {product.salePriceMinor === null
                      ? t('sale.price.noPrice')
                      : formatMoney(product.salePriceMinor)}
                  </p>
                  <p className="text-[11px] text-slate-500">{t('sale.price.exclTax')}</p>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canWrite}
                  className="shrink-0 text-indigo-700"
                  onClick={() =>
                    product.isSerialized ? onPickDevice(product) : onAddProduct(product)
                  }
                >
                  {product.isSerialized ? (
                    t('sale.quickAdd.chooseDevice')
                  ) : (
                    <>
                      <Plus aria-hidden="true" className="size-4" />
                      {t('sale.quickAdd.add')}
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
