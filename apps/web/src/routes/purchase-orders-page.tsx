import { ClipboardList, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { PurchaseOrderStatus } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useProducts, useWarehouses } from '@/features/catalog/api';
import { useSuppliers, usePurchaseOrders } from '@/features/operations/api';
import { purchaseOrderStatusKeys, purchaseOrderStatusStyles } from '@/features/operations/labels';
import {
  CreatePurchaseOrderDialog,
  PurchaseOrderDetailDialog,
} from '@/features/operations/purchase-order-dialogs';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 25;

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function PurchaseOrdersPage() {
  const { t, errorMessage, formatDate, formatQuantity } = useI18n();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PurchaseOrderStatus | ''>('');
  const [supplierId, setSupplierId] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const orders = usePurchaseOrders(organizationId, {
    search: debouncedSearch,
    status,
    supplierId,
    page,
    pageSize: PAGE_SIZE,
  });
  const suppliers = useSuppliers(organizationId, {
    search: '',
    isActive: '',
    page: 1,
    pageSize: 100,
  });
  const warehouses = useWarehouses(organizationId);
  const products = useProducts(organizationId, {
    search: '',
    status: 'active',
    page: 1,
    pageSize: 100,
  });

  const total = orders.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('purchasing.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t('purchasing.description')}</p>
        </div>
        <Button disabled={!canWrite} onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          {t('purchasing.newOrder')}
        </Button>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          {t('purchasing.viewerReadOnly')}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <label htmlFor="po-search" className="sr-only">
              {t('purchasing.searchLabel')}
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="po-search"
              type="search"
              value={search}
              placeholder={t('purchasing.searchPlaceholder')}
              className="w-full rounded-lg border border-slate-300 py-2 ps-9 pe-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="po-status-filter" className="sr-only">
              {t('purchasing.filterStatus')}
            </label>
            <select
              id="po-status-filter"
              value={status}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setStatus(event.target.value as PurchaseOrderStatus | '');
                setPage(1);
              }}
            >
              <option value="">{t('purchasing.allStatuses')}</option>
              {(Object.keys(purchaseOrderStatusKeys) as PurchaseOrderStatus[]).map((option) => (
                <option key={option} value={option}>
                  {t(purchaseOrderStatusKeys[option])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="po-supplier-filter" className="sr-only">
              {t('purchasing.filterSupplier')}
            </label>
            <select
              id="po-supplier-filter"
              value={supplierId}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSupplierId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('purchasing.allSuppliers')}</option>
              {(suppliers.data?.items ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {orders.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-700">
              {errorMessage(orders.error, 'purchasing.loadFailed')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void orders.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        ) : orders.isPending ? (
          <div
            className="divide-y divide-slate-100"
            role="status"
            aria-label={t('purchasing.loading')}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/4 rounded bg-slate-200" />
                <div className="h-4 w-1/4 rounded bg-slate-100" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <ClipboardList aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {search || status || supplierId
                ? t('purchasing.emptyFilteredTitle')
                : t('purchasing.emptyTitle')}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {search || status || supplierId
                ? t('purchasing.emptyFilteredBody')
                : canWrite
                  ? t('purchasing.emptyBody')
                  : t('purchasing.emptyBodyReadOnly')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">{t('purchasing.title')}</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('purchasing.columns.number')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.supplier')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.status')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    {t('purchasing.columns.linesQty')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('purchasing.columns.expected')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    {t('purchasing.columns.open')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.data.items.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p dir="ltr" className="font-mono text-sm font-medium text-slate-900">
                        {order.number}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{order.supplierName}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {order.warehouseCode} / {order.locationCode}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                          purchaseOrderStatusStyles[order.status],
                        )}
                      >
                        {t(purchaseOrderStatusKeys[order.status])}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end text-slate-700">
                      {formatQuantity(order.lineCount)} / {formatQuantity(order.totalQuantity)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {order.expectedOn ?? t('common.notAvailable')}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        {t('purchasing.openAction')}
                      </Button>
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
            nounKey="common.noun.purchaseOrders"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>

      {organizationId && (
        <>
          <CreatePurchaseOrderDialog
            organizationId={organizationId}
            suppliers={suppliers.data?.items ?? []}
            warehouses={warehouses.data ?? []}
            products={products.data?.items ?? []}
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
          <PurchaseOrderDetailDialog
            organizationId={organizationId}
            purchaseOrderId={selectedOrderId}
            canWrite={canWrite}
            onOpenChange={(open) => {
              if (!open) setSelectedOrderId(null);
            }}
          />
        </>
      )}
    </div>
  );
}
