import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpFromLine,
  BellRing,
  Boxes,
  Download,
  LockKeyhole,
  RefreshCw,
  Smartphone,
  Tag,
  Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { useCategories, useProducts, useWarehouses } from '@/features/catalog/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import {
  useExportMovements,
  useExportStockLevels,
  useLowStock,
  useReportOverview,
  useSupplierPerformance,
} from '@/features/reports/api';
import { useStockRealtime } from '@/features/reports/use-stock-realtime';
import { useApiHealth } from '@/features/system/use-api-health';
import { useInvitations, useTeamMembers } from '@/features/team/api';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

const LOW_STOCK_PAGE_SIZE = 8;
const RANGES = [
  { days: 7, label: 'dashboard.range.last7' },
  { days: 30, label: 'dashboard.range.last30' },
  { days: 90, label: 'dashboard.range.last90' },
] as const;

function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function OwnerDashboard() {
  const {
    t,
    plural,
    errorMessage,
    formatNumber,
    formatQuantity,
    formatMoney,
    formatDate,
    formatDateTime,
  } = useI18n();
  const health = useApiHealth();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;

  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [days, setDays] = useState(30);
  const [supplierDays, setSupplierDays] = useState(90);
  const [exporting, setExporting] = useState<'levels' | 'movements' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const organizationIdRef = useRef(organizationId);

  useEffect(() => {
    organizationIdRef.current = organizationId;
    setWarehouseId('');
    setCategoryId('');
    setNotice(null);
  }, [organizationId]);

  const overview = useReportOverview(organizationId, { warehouseId, categoryId, days });
  const lowStock = useLowStock(organizationId, {
    warehouseId,
    categoryId,
    page: 1,
    pageSize: LOW_STOCK_PAGE_SIZE,
  });
  const warehouses = useWarehouses(organizationId);
  const categories = useCategories(organizationId);
  const products = useProducts(organizationId, { search: '', status: '', page: 1, pageSize: 1 });
  const team = useTeamMembers(organizationId);
  const invitations = useInvitations(organizationId, true);
  const supplierPerformance = useSupplierPerformance(organizationId, { days: supplierDays });
  const realtime = useStockRealtime(organizationId);
  const exportLevels = useExportStockLevels(organizationId);
  const exportMovements = useExportMovements(organizationId);
  const location = useLocation();

  useEffect(() => {
    if (location.hash !== '#low-stock') {
      return;
    }

    document.getElementById('low-stock')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, location.key]);

  const data = overview.data;
  const lowStockTotal = lowStock.data?.total ?? 0;
  const lowStockItems = lowStock.data?.items ?? [];
  const series = data?.series ?? [];
  const seriesMax = Math.max(
    1,
    ...series.map((point) => Math.max(point.receivedQuantity, point.issuedQuantity)),
  );

  const apiStatus = health.isPending
    ? { tone: 'pending', label: t('dashboard.health.checking') }
    : health.isError
      ? { tone: 'error', label: t('dashboard.health.unreachable') }
      : { tone: 'ok', label: t('dashboard.health.online') };

  const realtimeStatus = {
    live: { tone: 'ok', label: t('dashboard.realtime.connected') },
    connecting: { tone: 'pending', label: t('dashboard.realtime.connecting') },
    offline: { tone: 'error', label: t('dashboard.realtime.polling') },
  }[realtime];

  const metrics = [
    {
      label: t('dashboard.metric.onHand'),
      icon: Boxes,
      value: data ? formatQuantity(data.totals.onHand) : '—',
      hint: data
        ? plural('common.noun.stockLines', data.totals.locationCount)
        : t('dashboard.metric.onHand.hint'),
    },
    {
      label: t('dashboard.metric.available'),
      icon: ArrowUpFromLine,
      value: data ? formatQuantity(data.totals.available) : '—',
      hint: data
        ? t('dashboard.metric.available.reserved', {
            quantity: formatQuantity(data.totals.reserved),
          })
        : t('dashboard.metric.available.hint'),
    },
    {
      label: t('dashboard.metric.reserved'),
      icon: LockKeyhole,
      value: data ? formatQuantity(data.totals.reserved) : '—',
      hint: t('dashboard.metric.reserved.hint'),
    },
    {
      label: t('dashboard.metric.serialized'),
      icon: Smartphone,
      value: data ? formatQuantity(data.totals.serializedInStock) : '—',
      hint: t('dashboard.metric.serialized.hint'),
    },
    {
      label: t('dashboard.metric.costValue'),
      icon: Wallet,
      value: data ? formatMoney(data.valuation.purchaseValueMinor) : '—',
      hint:
        data && data.valuation.unpricedProductCount > 0
          ? plural('dashboard.metric.unpriced', data.valuation.unpricedProductCount)
          : t('dashboard.metric.costValue.hint'),
    },
    {
      label: t('dashboard.metric.retailValue'),
      icon: Tag,
      value: data ? formatMoney(data.valuation.saleValueMinor) : '—',
      hint: t('dashboard.metric.retailValue.hint'),
    },
  ];

  const runExport = async (kind: 'levels' | 'movements') => {
    const forOrganization = organizationId;
    setExporting(kind);
    setNotice(null);
    try {
      const file =
        kind === 'levels'
          ? await exportLevels({ warehouseId, categoryId })
          : await exportMovements({ warehouseId, categoryId, days });
      if (organizationIdRef.current !== forOrganization) return;
      saveBlob(file.blob, file.filename);
      setNotice({
        tone: 'ok',
        text: t('dashboard.export.downloaded', { filename: file.filename }),
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: errorMessage(error, 'dashboard.export.error'),
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('nav.dashboard')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t('dashboard.subtitle')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  'size-2 rounded-full',
                  apiStatus.tone === 'ok' && 'bg-emerald-500',
                  apiStatus.tone === 'pending' && 'bg-slate-300',
                  apiStatus.tone === 'error' && 'bg-rose-500',
                )}
              />
              {apiStatus.label}
            </span>
            <span className="inline-flex items-center gap-1.5" role="status">
              <span
                aria-hidden="true"
                className={cn(
                  'size-2 rounded-full',
                  realtimeStatus.tone === 'ok' && 'bg-emerald-500',
                  realtimeStatus.tone === 'pending' && 'bg-slate-300',
                  realtimeStatus.tone === 'error' && 'bg-amber-500',
                )}
              />
              {realtimeStatus.label}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting !== null || !organizationId}
            onClick={() => void runExport('levels')}
          >
            <Download aria-hidden="true" className="size-4" />
            {exporting === 'levels'
              ? t('dashboard.export.exporting')
              : t('dashboard.export.stockLevels')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting !== null || !organizationId}
            onClick={() => void runExport('movements')}
          >
            <Download aria-hidden="true" className="size-4" />
            {exporting === 'movements'
              ? t('dashboard.export.exporting')
              : t('dashboard.export.movements')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] });
              void queryClient.invalidateQueries({ queryKey: ['system', 'health'] });
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {t('common.refresh')}
          </Button>
        </div>
      </header>

      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'rounded-lg px-4 py-3 text-sm',
            notice.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800',
          )}
        >
          {notice.text}
        </p>
      )}

      <section aria-labelledby="owner-setup-heading" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 id="owner-setup-heading" className="text-sm font-semibold text-slate-900">
            {t('dashboard.owner.setup.title')}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{t('dashboard.owner.setup.description')}</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Link
              to="/warehouses"
              className="rounded-lg border border-slate-200 p-3 transition-colors hover:border-indigo-300"
            >
              <span className="block text-2xl font-semibold tabular-nums text-slate-900">
                {warehouses.data ? formatNumber(warehouses.data.length) : '—'}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {t('dashboard.owner.setup.warehouses')}
              </span>
            </Link>
            <Link
              to="/catalog"
              className="rounded-lg border border-slate-200 p-3 transition-colors hover:border-indigo-300"
            >
              <span className="block text-2xl font-semibold tabular-nums text-slate-900">
                {categories.data ? formatNumber(categories.data.length) : '—'}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {t('dashboard.owner.setup.categories')}
              </span>
            </Link>
            <Link
              to="/products"
              className="rounded-lg border border-slate-200 p-3 transition-colors hover:border-indigo-300"
            >
              <span className="block text-2xl font-semibold tabular-nums text-slate-900">
                {products.data ? formatNumber(products.data.total) : '—'}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {t('dashboard.owner.setup.products')}
              </span>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            {t('dashboard.owner.team.title')}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{t('dashboard.owner.team.description')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              to="/team"
              className="rounded-lg border border-slate-200 p-3 transition-colors hover:border-indigo-300"
            >
              <span className="block text-2xl font-semibold tabular-nums text-slate-900">
                {team.data ? formatNumber(team.data.items.length) : '—'}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {t('dashboard.owner.team.members')}
              </span>
            </Link>
            <Link
              to="/team"
              className="rounded-lg border border-slate-200 p-3 transition-colors hover:border-indigo-300"
            >
              <span className="block text-2xl font-semibold tabular-nums text-slate-900">
                {invitations.data ? formatNumber(invitations.data.items.length) : '—'}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {t('dashboard.owner.team.invitations')}
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-label={t('dashboard.filters.ariaLabel')}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <div className="flex-1 sm:max-w-xs">
          <label htmlFor="report-warehouse" className="sr-only">
            {t('dashboard.filters.warehouse')}
          </label>
          <select
            id="report-warehouse"
            value={warehouseId}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
            onChange={(event) => setWarehouseId(event.target.value)}
          >
            <option value="">{t('dashboard.filters.allWarehouses')}</option>
            {(warehouses.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} · {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 sm:max-w-xs">
          <label htmlFor="report-category" className="sr-only">
            {t('dashboard.filters.category')}
          </label>
          <select
            id="report-category"
            value={categoryId}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{t('dashboard.filters.allCategories')}</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="report-range" className="sr-only">
            {t('dashboard.filters.window')}
          </label>
          <select
            id="report-range"
            value={days}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {RANGES.map((range) => (
              <option key={range.days} value={range.days}>
                {t(range.label)}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-slate-500 sm:ms-auto">
          {data
            ? t('dashboard.filters.windowSummary', {
                from: formatDate(data.window.from),
                to: formatDate(data.window.to),
                generatedAt: formatDateTime(data.generatedAt),
              })
            : t('dashboard.filters.windowLoading')}
        </p>
      </section>

      {overview.isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p role="alert" className="text-sm text-rose-800">
            {errorMessage(overview.error, 'dashboard.overview.error')}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void overview.refetch()}
          >
            {t('common.retry')}
          </Button>
        </div>
      )}

      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          {t('dashboard.metrics.ariaLabel')}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5">
              <dt className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <metric.icon aria-hidden="true" className="size-4 text-slate-400" />
                {metric.label}
              </dt>
              <dd
                className={cn(
                  'mt-3 text-2xl font-semibold tabular-nums',
                  metric.value === '—' ? 'text-slate-400' : 'text-slate-900',
                )}
              >
                {metric.value}
              </dd>
              <p className="mt-2 text-xs text-slate-500">{metric.hint}</p>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section
          aria-labelledby="movement-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="movement-heading" className="text-sm font-semibold text-slate-900">
                {t('dashboard.ledger.title')}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {data
                  ? t('dashboard.ledger.summary', {
                      movements: plural('common.noun.movements', data.movements.count),
                    })
                  : t('dashboard.ledger.placeholder')}
              </p>
            </div>
            <dl className="flex gap-6 text-end text-xs text-slate-500">
              <div>
                <dt>{t('dashboard.ledger.received')}</dt>
                <dd className="text-base font-semibold tabular-nums text-emerald-700">
                  {data ? formatQuantity(data.movements.receivedQuantity) : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('dashboard.ledger.issued')}</dt>
                <dd className="text-base font-semibold tabular-nums text-rose-700">
                  {data ? formatQuantity(data.movements.issuedQuantity) : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('dashboard.ledger.net')}</dt>
                <dd className="text-base font-semibold tabular-nums text-slate-900">
                  {data ? formatQuantity(data.movements.netQuantity) : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {series.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">{t('dashboard.ledger.empty')}</p>
          ) : (
            <>
              <div
                className="mt-6 flex h-32 items-end gap-1 overflow-x-auto"
                role="img"
                aria-label={t('dashboard.ledger.chartAria', {
                  from: series[0]?.date ?? '',
                  to: series[series.length - 1]?.date ?? '',
                })}
              >
                {series.map((point) => (
                  <div
                    key={point.date}
                    className="flex h-full min-w-2 flex-1 flex-col justify-end gap-0.5"
                    title={t('dashboard.ledger.pointTitle', {
                      date: point.date,
                      received: formatQuantity(point.receivedQuantity),
                      issued: formatQuantity(point.issuedQuantity),
                    })}
                  >
                    <div
                      className="w-full rounded-t bg-emerald-500"
                      style={{ height: `${(point.receivedQuantity / seriesMax) * 100}%` }}
                    />
                    <div
                      className="w-full rounded-t bg-rose-400"
                      style={{ height: `${(point.issuedQuantity / seriesMax) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span dir="ltr">{series[0]?.date}</span>
                <span className="flex gap-4">
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true" className="size-2 rounded-sm bg-emerald-500" />
                    {t('dashboard.ledger.received')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true" className="size-2 rounded-sm bg-rose-400" />
                    {t('dashboard.ledger.issued')}
                  </span>
                </span>
                <span dir="ltr">{series[series.length - 1]?.date}</span>
              </div>
            </>
          )}
        </section>

        <section
          id="low-stock"
          aria-labelledby="low-stock-heading"
          className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2
                id="low-stock-heading"
                className="flex items-center gap-2 text-sm font-semibold text-slate-900"
              >
                <BellRing aria-hidden="true" className="size-4 text-amber-500" />
                {t('dashboard.lowStock.title')}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {lowStockTotal === 0
                  ? t('dashboard.lowStock.none')
                  : t('dashboard.lowStock.summary', {
                      products: plural('common.noun.products', lowStockTotal),
                    })}
              </p>
            </div>
          </div>

          {lowStock.isError ? (
            <p role="alert" className="mt-4 text-sm text-rose-700">
              {errorMessage(lowStock.error, 'dashboard.lowStock.error')}
            </p>
          ) : lowStockTotal === 0 ? (
            <p className="mt-6 text-sm text-slate-500">{t('dashboard.lowStock.empty')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {lowStockItems.map((item) => (
                <li key={item.productId} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.productName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <span dir="ltr">{item.sku}</span>
                        {item.categoryName ? ` · ${item.categoryName}` : ''}
                        {item.isSerialized ? ` · ${t('dashboard.lowStock.serialized')}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-end text-xs text-slate-600">
                      <span
                        dir="ltr"
                        className="block text-sm font-semibold tabular-nums text-rose-700"
                      >
                        {formatQuantity(item.available)} / {formatQuantity(item.reorderThreshold)}
                      </span>
                      {t('dashboard.lowStock.short', {
                        quantity: formatQuantity(item.shortfall),
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        aria-labelledby="supplier-performance-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 id="supplier-performance-heading" className="text-sm font-semibold text-slate-900">
              {t('dashboard.supplierPerformance.title')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t('dashboard.supplierPerformance.description')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="supplier-window" className="sr-only">
              {t('dashboard.supplierPerformance.windowLabel')}
            </label>
            <select
              id="supplier-window"
              value={supplierDays}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => setSupplierDays(Number(event.target.value))}
            >
              <option value={30}>{t('dashboard.range.last30')}</option>
              <option value={90}>{t('dashboard.range.last90')}</option>
              <option value={180}>{t('dashboard.range.last180')}</option>
            </select>
            <Link
              to="/suppliers"
              className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
            >
              {t('nav.suppliers')}{' '}
              <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
                →
              </span>
            </Link>
          </div>
        </div>

        {supplierPerformance.isError ? (
          <div className="p-5">
            <p role="alert" className="text-sm text-rose-700">
              {errorMessage(supplierPerformance.error, 'dashboard.supplierPerformance.error')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void supplierPerformance.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        ) : (supplierPerformance.data?.suppliers ?? []).length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            {supplierPerformance.isPending
              ? t('dashboard.supplierPerformance.loading')
              : t('dashboard.supplierPerformance.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">{t('dashboard.supplierPerformance.caption')}</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    {t('common.supplier')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.supplierPerformance.orders')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.supplierPerformance.onTime')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.supplierPerformance.leadTime')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.supplierPerformance.receivedValue')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.supplierPerformance.returnRate')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierPerformance.data?.suppliers.map((row) => (
                  <tr key={row.supplierId}>
                    <th scope="row" className="px-5 py-3 font-medium text-slate-900">
                      {row.supplierName}
                    </th>
                    <td className="px-5 py-3 text-end tabular-nums text-slate-700">
                      {formatNumber(row.ordersCreated)}
                      <span className="ms-1 text-xs text-slate-500">
                        {t('dashboard.supplierPerformance.received', {
                          count: formatNumber(row.ordersReceived),
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums">
                      <span
                        className={cn(
                          row.onTimeRate === null ? 'text-slate-400' : 'text-slate-900',
                        )}
                      >
                        {formatRate(row.onTimeRate)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {t('dashboard.supplierPerformance.onTimeLate', {
                          onTime: formatNumber(row.onTimeOrders),
                          late: formatNumber(row.lateOrders),
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums text-slate-700">
                      {row.averageLeadTimeDays === null
                        ? '—'
                        : t('dashboard.supplierPerformance.leadTimeDays', {
                            days: formatNumber(row.averageLeadTimeDays, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            }),
                          })}
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums text-slate-700">
                      {formatMoney(row.receivedValueMinor)}
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums">
                      <span
                        className={cn(
                          row.returnRate !== null && row.returnRate > 0
                            ? 'text-rose-700'
                            : 'text-slate-700',
                        )}
                      >
                        {formatRate(row.returnRate)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {t('dashboard.supplierPerformance.returned', {
                          count: formatQuantity(row.returnedQuantity),
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="warehouse-breakdown-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-5">
          <div>
            <h2 id="warehouse-breakdown-heading" className="text-sm font-semibold text-slate-900">
              {t('dashboard.warehouses.title')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t('dashboard.warehouses.description')}</p>
          </div>
          <Link to="/stock" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
            {t('dashboard.warehouses.openStock')}{' '}
            <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
              →
            </span>
          </Link>
        </div>

        {data && data.warehouses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">{t('dashboard.warehouses.caption')}</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    {t('common.warehouse')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.warehouses.onHand')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.warehouses.reserved')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.warehouses.available')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.warehouses.serialized')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.warehouses.costValue')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-end font-semibold">
                    {t('dashboard.warehouses.retailValue')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.warehouses.map((warehouse) => (
                  <tr key={warehouse.warehouseId}>
                    <th scope="row" className="px-5 py-3 font-medium text-slate-900">
                      <span dir="ltr">{warehouse.code}</span> · {warehouse.name}
                    </th>
                    <td className="px-5 py-3 text-end tabular-nums">
                      {formatQuantity(warehouse.onHand)}
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums">
                      {formatQuantity(warehouse.reserved)}
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums">
                      {formatQuantity(warehouse.available)}
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums">
                      {formatQuantity(warehouse.serializedInStock)}
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums">
                      {formatMoney(warehouse.purchaseValueMinor)}
                    </td>
                    <td className="px-5 py-3 text-end tabular-nums">
                      {formatMoney(warehouse.saleValueMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-slate-500">
            {overview.isPending
              ? t('dashboard.warehouses.loading')
              : t('dashboard.warehouses.empty')}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">{t('dashboard.live.title')}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{t('dashboard.live.body')}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
          <Link to="/stock/movements" className="text-indigo-700 hover:text-indigo-900">
            {t('dashboard.live.openMovements')}{' '}
            <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
              →
            </span>
          </Link>
          <Link to="/stock/reconciliation" className="text-indigo-700 hover:text-indigo-900">
            {t('nav.reconciliation')}{' '}
            <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
              →
            </span>
          </Link>
          <Link to="/devices" className="text-indigo-700 hover:text-indigo-900">
            {t('nav.devices')}{' '}
            <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
              →
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
