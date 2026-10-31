import {
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  LockKeyhole,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useProducts, useWarehouses } from '@/features/catalog/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useStockLevels, useStockSummary } from '@/features/stock/api';
import {
  ReservationDialog,
  StockPostingDialog,
  StockTransferDialog,
} from '@/features/stock/stock-dialogs';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 25;

type PostingMode = 'receipt' | 'issue' | 'adjustment';

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function StockLevelsPage() {
  const { t, formatQuantity, errorMessage } = useI18n();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [page, setPage] = useState(1);
  const [postingMode, setPostingMode] = useState<PostingMode | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const levels = useStockLevels(organizationId, {
    search: debouncedSearch,
    warehouseId,
    page,
    pageSize: PAGE_SIZE,
  });
  const summary = useStockSummary(organizationId);
  const warehouses = useWarehouses(organizationId);
  const products = useProducts(organizationId, {
    search: '',
    status: 'active',
    page: 1,
    pageSize: 100,
  });

  const total = levels.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const metrics = [
    { label: t('stock.metrics.onHand'), value: summary.data?.onHand ?? null, icon: Boxes },
    {
      label: t('stock.metrics.reserved'),
      value: summary.data?.reserved ?? null,
      icon: LockKeyhole,
    },
    {
      label: t('stock.metrics.available'),
      value: summary.data?.available ?? null,
      icon: ArrowUpFromLine,
    },
    {
      label: t('stock.metrics.productCount'),
      value: summary.data?.productCount ?? null,
      icon: ClipboardList,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('stock.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t('stock.description')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!canWrite} onClick={() => setPostingMode('receipt')}>
            <Boxes aria-hidden="true" className="size-4" />
            {t('stock.actions.receive')}
          </Button>
          <Button variant="secondary" disabled={!canWrite} onClick={() => setPostingMode('issue')}>
            <ArrowUpFromLine aria-hidden="true" className="size-4" />
            {t('stock.actions.issue')}
          </Button>
          <Button
            variant="secondary"
            disabled={!canWrite}
            onClick={() => setPostingMode('adjustment')}
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            {t('stock.actions.adjust')}
          </Button>
          <Button variant="secondary" disabled={!canWrite} onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            {t('stock.actions.transfer')}
          </Button>
          <Button variant="secondary" disabled={!canWrite} onClick={() => setReserveOpen(true)}>
            <LockKeyhole aria-hidden="true" className="size-4" />
            {t('stock.actions.reserve')}
          </Button>
        </div>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          {t('stock.readOnly')}
        </p>
      )}

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <dt className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <metric.icon aria-hidden="true" className="size-4 text-slate-400" />
              {metric.label}
            </dt>
            <dd
              className={cn(
                'mt-2 text-2xl font-semibold tabular-nums',
                metric.value === null ? 'text-slate-400' : 'text-slate-900',
              )}
            >
              {metric.value === null ? t('common.notAvailable') : formatQuantity(metric.value)}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="stock-search" className="sr-only">
              {t('stock.searchLabel')}
            </label>
            <input
              id="stock-search"
              type="search"
              value={search}
              placeholder={t('stock.searchPlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="stock-warehouse-filter" className="sr-only">
              {t('stock.warehouseFilterLabel')}
            </label>
            <select
              id="stock-warehouse-filter"
              value={warehouseId}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setWarehouseId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('stock.allWarehouses')}</option>
              {(warehouses.data ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {levels.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-700">
              {levels.error ? errorMessage(levels.error, 'stock.loadError') : t('stock.loadError')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void levels.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        ) : levels.isPending ? (
          <div className="divide-y divide-slate-100" role="status" aria-label={t('stock.loading')}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <Boxes aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {search || warehouseId ? t('stock.emptyFilteredTitle') : t('stock.emptyTitle')}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {search || warehouseId
                ? t('stock.emptyFilteredBody')
                : canWrite
                  ? t('stock.emptyCanWriteBody')
                  : t('stock.emptyReadOnlyBody')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">{t('stock.tableCaption')}</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.product')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.location')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    {t('stock.columns.onHand')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    {t('stock.columns.reserved')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    {t('stock.columns.available')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {levels.data.items.map((level) => (
                  <tr
                    key={`${level.productId}-${level.warehouseId}-${level.locationId}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{level.productName}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        <span dir="ltr">{level.sku}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{level.warehouseName}</p>
                      <p className="font-mono text-xs text-slate-500">
                        <span dir="ltr">
                          {level.warehouseCode} / {level.locationCode}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-900">
                      {formatQuantity(level.onHand)}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-600">
                      {formatQuantity(level.reserved)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-end font-medium tabular-nums',
                        level.available <= 0 ? 'text-rose-700' : 'text-emerald-700',
                      )}
                    >
                      {formatQuantity(level.available)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <PaginationFooter
            total={total}
            page={page}
            pageCount={pageCount}
            nounKey="common.noun.stockLines"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>

      {organizationId && (
        <>
          {postingMode && (
            <StockPostingDialog
              organizationId={organizationId}
              warehouses={warehouses.data ?? []}
              products={products.data?.items ?? []}
              mode={postingMode}
              open
              onOpenChange={(open) => {
                if (!open) setPostingMode(null);
              }}
            />
          )}
          <StockTransferDialog
            organizationId={organizationId}
            warehouses={warehouses.data ?? []}
            products={products.data?.items ?? []}
            open={transferOpen}
            onOpenChange={setTransferOpen}
          />
          <ReservationDialog
            organizationId={organizationId}
            warehouses={warehouses.data ?? []}
            products={products.data?.items ?? []}
            open={reserveOpen}
            onOpenChange={setReserveOpen}
          />
        </>
      )}
    </div>
  );
}
