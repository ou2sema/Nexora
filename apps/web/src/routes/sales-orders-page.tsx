import { Plus, Search, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { SalesOrderStatus } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useProducts, useWarehouses } from '@/features/catalog/api';
import { useSalesOrders } from '@/features/operations/api';
import { salesOrderStatusLabels, salesOrderStatusStyles } from '@/features/operations/labels';
import {
  CreateSalesOrderDialog,
  SalesOrderDetailDialog,
} from '@/features/operations/sales-order-dialogs';
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

export function SalesOrdersPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SalesOrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const orders = useSalesOrders(organizationId, {
    search: debouncedSearch,
    status,
    page,
    pageSize: PAGE_SIZE,
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Outgoing orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Customer orders reserve stock when confirmed and issue it on fulfilment.
          </p>
        </div>
        <Button disabled={!canWrite} onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          New outgoing order
        </Button>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Your viewer role is read-only. Owners, admins and managers manage outgoing orders.
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor="so-search" className="sr-only">
              Search outgoing orders
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="so-search"
              type="search"
              value={search}
              placeholder="Search by number or customer"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="so-status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="so-status-filter"
              value={status}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setStatus(event.target.value as SalesOrderStatus | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {(Object.keys(salesOrderStatusLabels) as SalesOrderStatus[]).map((option) => (
                <option key={option} value={option}>
                  {salesOrderStatusLabels[option]}
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
                : 'Outgoing orders failed to load.'}
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
            aria-label="Loading outgoing orders"
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
              <Send aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {search || status ? 'No matching outgoing orders' : 'No outgoing orders yet'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {search || status
                ? 'Adjust the search or status filter to see more results.'
                : canWrite
                  ? 'Create the first outgoing order to reserve and issue stock to a customer.'
                  : 'An owner, admin or manager can create the first outgoing order.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Outgoing orders</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Number
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Lines / qty
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Created
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
                        {order.warehouseCode} / {order.locationCode}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{order.customerName}</p>
                      {order.customerEmail && (
                        <p className="text-xs text-slate-500">{order.customerEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                          salesOrderStatusStyles[order.status],
                        )}
                      >
                        {salesOrderStatusLabels[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {order.lineCount} / {order.totalQuantity}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {dateOnly.format(new Date(order.createdAt))}
                    </td>
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
            noun="outgoing order"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>

      {organizationId && (
        <>
          <CreateSalesOrderDialog
            organizationId={organizationId}
            warehouses={warehouses.data ?? []}
            products={products.data?.items ?? []}
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
          <SalesOrderDetailDialog
            organizationId={organizationId}
            salesOrderId={selectedOrderId}
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
