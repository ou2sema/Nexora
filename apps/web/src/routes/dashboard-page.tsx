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
import { useState } from 'react';
import { Link } from 'react-router';

import { formatTnd } from '@mystock/domain';

import { Button } from '@/components/ui/button';
import { useCategories, useWarehouses } from '@/features/catalog/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import {
  useExportMovements,
  useExportStockLevels,
  useLowStock,
  useReportOverview,
} from '@/features/reports/api';
import { useStockRealtime } from '@/features/reports/use-stock-realtime';
import { useApiHealth } from '@/features/system/use-api-health';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';

const LOW_STOCK_PAGE_SIZE = 8;
const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
] as const;

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-TN', { maximumFractionDigits: 4 }).format(value);
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function DashboardPage() {
  const health = useApiHealth();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;

  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [days, setDays] = useState(30);
  const [exporting, setExporting] = useState<'levels' | 'movements' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const overview = useReportOverview(organizationId, { warehouseId, categoryId, days });
  const lowStock = useLowStock(organizationId, {
    warehouseId,
    categoryId,
    page: 1,
    pageSize: LOW_STOCK_PAGE_SIZE,
  });
  const warehouses = useWarehouses(organizationId);
  const categories = useCategories(organizationId);
  const realtime = useStockRealtime(organizationId);
  const exportLevels = useExportStockLevels(organizationId);
  const exportMovements = useExportMovements(organizationId);

  const data = overview.data;
  const lowStockTotal = lowStock.data?.total ?? 0;
  const lowStockItems = lowStock.data?.items ?? [];
  const series = data?.series ?? [];
  const seriesMax = Math.max(
    1,
    ...series.map((point) => Math.max(point.receivedQuantity, point.issuedQuantity)),
  );

  const apiStatus = health.isPending
    ? { tone: 'pending', label: 'Checking API…' }
    : health.isError
      ? { tone: 'error', label: 'API unreachable' }
      : { tone: 'ok', label: 'API online' };

  const realtimeStatus = {
    live: { tone: 'ok', label: 'Realtime connected' },
    connecting: { tone: 'pending', label: 'Connecting…' },
    offline: { tone: 'error', label: 'Polling fallback' },
  }[realtime];

  const metrics = [
    {
      label: 'Units on hand',
      icon: Boxes,
      value: data ? formatQuantity(data.totals.onHand) : '—',
      hint: data ? `${data.totals.locationCount} stock lines` : 'Ledger quantities',
    },
    {
      label: 'Available',
      icon: ArrowUpFromLine,
      value: data ? formatQuantity(data.totals.available) : '—',
      hint: data ? `${formatQuantity(data.totals.reserved)} reserved` : 'On hand minus holds',
    },
    {
      label: 'Reserved',
      icon: LockKeyhole,
      value: data ? formatQuantity(data.totals.reserved) : '—',
      hint: 'Active reservations',
    },
    {
      label: 'Serialized in stock',
      icon: Smartphone,
      value: data ? formatQuantity(data.totals.serializedInStock) : '—',
      hint: 'Devices with status in stock',
    },
    {
      label: 'Stock value at cost',
      icon: Wallet,
      value: data ? formatTnd(data.valuation.purchaseValueMinor, 'en-TN') : '—',
      hint:
        data && data.valuation.unpricedProductCount > 0
          ? `${data.valuation.unpricedProductCount} priced incompletely`
          : 'Purchase prices, TND',
    },
    {
      label: 'Stock value at retail',
      icon: Tag,
      value: data ? formatTnd(data.valuation.saleValueMinor, 'en-TN') : '—',
      hint: 'Sale prices, TND',
    },
  ];

  const runExport = async (kind: 'levels' | 'movements') => {
    setExporting(kind);
    setNotice(null);
    try {
      const file =
        kind === 'levels'
          ? await exportLevels({ warehouseId, categoryId })
          : await exportMovements({ warehouseId, categoryId, days });
      saveBlob(file.blob, file.filename);
      setNotice({ tone: 'ok', text: `Downloaded ${file.filename}` });
    } catch (error) {
      setNotice({
        tone: 'error',
        text:
          error instanceof ApiError
            ? error.message
            : 'The export could not be generated. Try again.',
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Inventory totals computed from the stock ledger, reservations and serialized devices.
          </p>
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
            {exporting === 'levels' ? 'Exporting…' : 'Stock levels CSV'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting !== null || !organizationId}
            onClick={() => void runExport('movements')}
          >
            <Download aria-hidden="true" className="size-4" />
            {exporting === 'movements' ? 'Exporting…' : 'Movements CSV'}
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
            Refresh
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

      <section
        aria-label="Report filters"
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <div className="flex-1 sm:max-w-xs">
          <label htmlFor="report-warehouse" className="sr-only">
            Filter by warehouse
          </label>
          <select
            id="report-warehouse"
            value={warehouseId}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
            onChange={(event) => setWarehouseId(event.target.value)}
          >
            <option value="">All warehouses</option>
            {(warehouses.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} · {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 sm:max-w-xs">
          <label htmlFor="report-category" className="sr-only">
            Filter by category
          </label>
          <select
            id="report-category"
            value={categoryId}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="report-range" className="sr-only">
            Movement window
          </label>
          <select
            id="report-range"
            value={days}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {RANGES.map((range) => (
              <option key={range.days} value={range.days}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-slate-500 sm:ml-auto">
          {data
            ? `Window ${new Date(data.window.from).toLocaleDateString('en-TN')} – ${new Date(
                data.window.to,
              ).toLocaleDateString('en-TN')} · generated ${new Date(
                data.generatedAt,
              ).toLocaleTimeString('en-TN')}`
            : 'Loading report window…'}
        </p>
      </section>

      {overview.isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p role="alert" className="text-sm text-rose-800">
            {overview.error instanceof Error
              ? overview.error.message
              : 'The inventory report failed to load.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void overview.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          Inventory metrics
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
                Ledger activity
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {data
                  ? `${data.movements.count} movements in the window`
                  : 'Movements in the selected window'}
              </p>
            </div>
            <dl className="flex gap-6 text-right text-xs text-slate-500">
              <div>
                <dt>Received</dt>
                <dd className="text-base font-semibold tabular-nums text-emerald-700">
                  {data ? formatQuantity(data.movements.receivedQuantity) : '—'}
                </dd>
              </div>
              <div>
                <dt>Issued</dt>
                <dd className="text-base font-semibold tabular-nums text-rose-700">
                  {data ? formatQuantity(data.movements.issuedQuantity) : '—'}
                </dd>
              </div>
              <div>
                <dt>Net</dt>
                <dd className="text-base font-semibold tabular-nums text-slate-900">
                  {data ? formatQuantity(data.movements.netQuantity) : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {series.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No movement history for this window.</p>
          ) : (
            <>
              <div
                className="mt-6 flex h-32 items-end gap-1 overflow-x-auto"
                role="img"
                aria-label={`Daily received and issued quantities from ${series[0]?.date} to ${
                  series[series.length - 1]?.date
                }`}
              >
                {series.map((point) => (
                  <div
                    key={point.date}
                    className="flex h-full min-w-2 flex-1 flex-col justify-end gap-0.5"
                    title={`${point.date}: received ${formatQuantity(
                      point.receivedQuantity,
                    )}, issued ${formatQuantity(point.issuedQuantity)}`}
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
                <span>{series[0]?.date}</span>
                <span className="flex gap-4">
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true" className="size-2 rounded-sm bg-emerald-500" />
                    Received
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true" className="size-2 rounded-sm bg-rose-400" />
                    Issued
                  </span>
                </span>
                <span>{series[series.length - 1]?.date}</span>
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
                Low stock
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {lowStockTotal === 0
                  ? 'Nothing below its reorder threshold'
                  : `${lowStockTotal} product${lowStockTotal === 1 ? '' : 's'} at or below their threshold`}
              </p>
            </div>
          </div>

          {lowStock.isError ? (
            <p role="alert" className="mt-4 text-sm text-rose-700">
              Low stock alerts failed to load.
            </p>
          ) : lowStockTotal === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              Set reorder thresholds on products to receive alerts here and in the top bar.
            </p>
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
                        {item.sku}
                        {item.categoryName ? ` · ${item.categoryName}` : ''}
                        {item.isSerialized ? ' · serialized' : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-xs text-slate-600">
                      <span className="block text-sm font-semibold tabular-nums text-rose-700">
                        {formatQuantity(item.available)} / {formatQuantity(item.reorderThreshold)}
                      </span>
                      short {formatQuantity(item.shortfall)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        aria-labelledby="warehouse-breakdown-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-5">
          <div>
            <h2 id="warehouse-breakdown-heading" className="text-sm font-semibold text-slate-900">
              Warehouse breakdown
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Ledger quantities, serialized units and valuation per warehouse.
            </p>
          </div>
          <Link to="/stock" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
            Open stock levels →
          </Link>
        </div>

        {data && data.warehouses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Stock totals by warehouse</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Warehouse
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    On hand
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Reserved
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Available
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Serialized
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Cost value
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Retail value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.warehouses.map((warehouse) => (
                  <tr key={warehouse.warehouseId}>
                    <th scope="row" className="px-5 py-3 font-medium text-slate-900">
                      {warehouse.code} · {warehouse.name}
                    </th>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatQuantity(warehouse.onHand)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatQuantity(warehouse.reserved)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatQuantity(warehouse.available)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatQuantity(warehouse.serializedInStock)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatTnd(warehouse.purchaseValueMinor, 'en-TN')}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatTnd(warehouse.saleValueMinor, 'en-TN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-5 text-sm text-slate-500">
            {overview.isPending
              ? 'Loading warehouse totals…'
              : 'No warehouse totals for the current filters.'}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Stock ledger is live</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Reports read the same immutable ledger and balance projection as the rest of the app.
          Realtime updates refresh these numbers after a committed change; when the socket is
          unavailable the dashboard polls instead.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
          <Link to="/stock/movements" className="text-indigo-700 hover:text-indigo-900">
            View movements →
          </Link>
          <Link to="/stock/reconciliation" className="text-indigo-700 hover:text-indigo-900">
            Reconciliation →
          </Link>
          <Link to="/devices" className="text-indigo-700 hover:text-indigo-900">
            Devices →
          </Link>
        </div>
      </section>
    </div>
  );
}
