import { ClipboardList, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { PurchaseOrderStatus } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useProducts, useWarehouses } from '@/features/catalog/api';
import { useSuppliers, usePurchaseOrders } from '@/features/operations/api';
import { purchaseOrderStatusLabels, purchaseOrderStatusStyles } from '@/features/operations/labels';
import {
  CreatePurchaseOrderDialog,
  PurchaseOrderDetailDialog,
} from '@/features/operations/purchase-order-dialogs';
import { useOrganization } from '@/features/organizations/organization-provider';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 25;

const dateOnly = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function PurchaseOrdersPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Purchase orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Order from suppliers and receive stock incrementally. Serialized lines register devices
            on receipt.
          </p>
        </div>
        <Button disabled={!canWrite} onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          New purchase order
        </Button>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Your viewer role is read-only. Owners, admins and managers manage purchasing.
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <label htmlFor="po-search" className="sr-only">
              Search purchase orders
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="po-search"
              type="search"
              value={search}
              placeholder="Search by number or supplier reference"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="po-status-filter" className="sr-only">
              Filter by status
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
              <option value="">All statuses</option>
              {(Object.keys(purchaseOrderStatusLabels) as PurchaseOrderStatus[]).map((option) => (
                <option key={option} value={option}>
                  {purchaseOrderStatusLabels[option]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="po-supplier-filter" className="sr-only">
              Filter by supplier
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
              <option value="">All suppliers</option>
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
              {orders.error instanceof Error
                ? orders.error.message
                : 'Purchase orders failed to load.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void orders.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : orders.isPending ? (
          <div
            className="divide-y divide-slate-100"
            role="status"
            aria-label="Loading purchase orders"
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
                ? 'No matching purchase orders'
                : 'No purchase orders yet'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {search || status || supplierId
                ? 'Adjust the filters to see more results.'
                : canWrite
                  ? 'Create the first purchase order to replenish stock from a supplier.'
                  : 'An owner, admin or manager can create the first purchase order.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Purchase orders</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Number
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Supplier
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Lines / qty
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Expected
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.data.items.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-medium text-slate-900">{order.number}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {dateOnly.format(new Date(order.createdAt))}
                      </p>
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
                        {purchaseOrderStatusLabels[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {order.lineCount} / {order.totalQuantity}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{order.expectedOn ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        Open
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
            noun="purchase order"
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
