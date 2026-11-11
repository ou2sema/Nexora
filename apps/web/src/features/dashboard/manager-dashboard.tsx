import { BellRing, ClipboardCheck, ReceiptText, ScanLine, Truck } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { usePurchaseOrders } from '@/features/operations/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useLowStock } from '@/features/reports/api';
import { useStockCounts } from '@/features/scanning/api';
import { useI18n } from '@/i18n/provider';

const LIST_SIZE = 5;

export function ManagerDashboard() {
  const { t, plural, errorMessage, formatNumber, formatQuantity, formatDate } = useI18n();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;

  const lowStock = useLowStock(organizationId, {
    warehouseId: '',
    categoryId: '',
    page: 1,
    pageSize: LIST_SIZE,
  });
  const openCounts = useStockCounts(organizationId, {
    status: 'open',
    page: 1,
    pageSize: LIST_SIZE,
  });
  const ordered = usePurchaseOrders(organizationId, {
    search: '',
    status: 'ordered',
    supplierId: '',
    page: 1,
    pageSize: LIST_SIZE,
  });
  const partial = usePurchaseOrders(organizationId, {
    search: '',
    status: 'partially_received',
    supplierId: '',
    page: 1,
    pageSize: LIST_SIZE,
  });

  const lowStockItems = lowStock.data?.items ?? [];
  const counts = openCounts.data?.items ?? [];
  const supplierTasks = [...(partial.data?.items ?? []), ...(ordered.data?.items ?? [])];
  const supplierTasksError = partial.isError || ordered.isError;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('nav.dashboard')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t('dashboard.manager.subtitle')}</p>
      </header>

      <section className="rounded-2xl bg-ink-950 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
              {t('dashboard.manager.counter.eyebrow')}
            </p>
            <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
              {t('dashboard.manager.counter.title')}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              {t('dashboard.manager.counter.body')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-11 px-5">
              <Link to="/sale">
                <ReceiptText aria-hidden="true" className="size-4" />
                {t('dashboard.manager.counter.openSale')}
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 px-5">
              <Link to="/scan">
                <ScanLine aria-hidden="true" className="size-4" />
                {t('dashboard.manager.counter.scan')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section
          aria-labelledby="manager-low-stock-heading"
          className="rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2
                id="manager-low-stock-heading"
                className="flex items-center gap-2 text-sm font-semibold text-slate-900"
              >
                <BellRing aria-hidden="true" className="size-4 text-amber-500" />
                {t('dashboard.lowStock.title')}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {lowStock.data
                  ? lowStock.data.total === 0
                    ? t('dashboard.lowStock.none')
                    : t('dashboard.lowStock.summary', {
                        products: plural('common.noun.products', lowStock.data.total),
                      })
                  : t('dashboard.manager.loading')}
              </p>
            </div>
            <Link
              to="/purchasing"
              className="shrink-0 text-sm font-medium text-indigo-700 hover:text-indigo-900"
            >
              {t('dashboard.manager.lowStock.openPurchasing')}
            </Link>
          </div>

          {lowStock.isError ? (
            <p role="alert" className="p-5 text-sm text-rose-700">
              {errorMessage(lowStock.error, 'dashboard.lowStock.error')}
            </p>
          ) : lowStockItems.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              {lowStock.isPending ? t('dashboard.manager.loading') : t('dashboard.lowStock.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStockItems.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-start justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {item.productName}
                    </p>
                    <p dir="ltr" className="mt-0.5 truncate text-xs text-slate-500">
                      {item.sku}
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
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="manager-counts-heading"
          className="rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2
                id="manager-counts-heading"
                className="flex items-center gap-2 text-sm font-semibold text-slate-900"
              >
                <ClipboardCheck aria-hidden="true" className="size-4 text-indigo-500" />
                {t('dashboard.manager.counts.title')}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {t('dashboard.manager.counts.description')}
              </p>
            </div>
            <Link
              to="/scan"
              className="shrink-0 text-sm font-medium text-indigo-700 hover:text-indigo-900"
            >
              {t('dashboard.manager.counts.resume')}
            </Link>
          </div>

          {openCounts.isError ? (
            <p role="alert" className="p-5 text-sm text-rose-700">
              {errorMessage(openCounts.error, 'dashboard.manager.counts.error')}
            </p>
          ) : counts.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              {openCounts.isPending
                ? t('dashboard.manager.loading')
                : t('dashboard.manager.counts.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {counts.map((count) => (
                <li key={count.id} className="px-5 py-3">
                  <p dir="ltr" className="font-mono text-sm text-slate-900">
                    {count.warehouseCode} / {count.locationCode}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t('dashboard.manager.counts.lines', {
                      count: formatNumber(count.lineCount),
                    })}{' '}
                    · {formatDate(count.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="manager-suppliers-heading"
          className="rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2
                id="manager-suppliers-heading"
                className="flex items-center gap-2 text-sm font-semibold text-slate-900"
              >
                <Truck aria-hidden="true" className="size-4 text-emerald-600" />
                {t('dashboard.manager.suppliers.title')}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {t('dashboard.manager.suppliers.description')}
              </p>
            </div>
            <Link
              to="/purchasing"
              className="shrink-0 text-sm font-medium text-indigo-700 hover:text-indigo-900"
            >
              {t('dashboard.manager.suppliers.open')}
            </Link>
          </div>

          {supplierTasksError ? (
            <p role="alert" className="p-5 text-sm text-rose-700">
              {errorMessage(partial.error ?? ordered.error, 'dashboard.manager.suppliers.error')}
            </p>
          ) : supplierTasks.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              {ordered.isPending || partial.isPending
                ? t('dashboard.manager.loading')
                : t('dashboard.manager.suppliers.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {supplierTasks.map((order) => (
                <li key={order.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-900">
                    <span dir="ltr">{order.number}</span> · {order.supplierName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {order.status === 'partially_received'
                      ? t('dashboard.manager.suppliers.partial')
                      : t('dashboard.manager.suppliers.awaiting')}
                    {order.expectedOn
                      ? ` · ${t('dashboard.manager.suppliers.expected', {
                          date: formatDate(order.expectedOn),
                        })}`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
