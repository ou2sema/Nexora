import { Building2, Pencil, Plus, Power, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { SupplierSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useSetSupplierActive, useSuppliers } from '@/features/operations/api';
import { SupplierDialog } from '@/features/operations/supplier-dialog';
import { useOrganization } from '@/features/organizations/organization-provider';
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

export function SuppliersPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierSummary | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const suppliers = useSuppliers(organizationId, {
    search: debouncedSearch,
    isActive,
    page,
    pageSize: PAGE_SIZE,
  });
  const activation = useSetSupplierActive(organizationId ?? '');

  const total = suppliers.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (supplier: SupplierSummary) => {
    setEditing(supplier);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Vendor directory used by purchase orders. Names are unique per organization.
          </p>
        </div>
        <Button disabled={!canWrite} onClick={openCreate}>
          <Plus aria-hidden="true" className="size-4" />
          New supplier
        </Button>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Your viewer role is read-only. Owners, admins and managers maintain suppliers.
        </p>
      )}

      {activation.error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {activation.error instanceof Error
            ? activation.error.message
            : 'The activation change failed.'}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor="supplier-search" className="sr-only">
              Search suppliers
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="supplier-search"
              type="search"
              value={search}
              placeholder="Search by name, contact or email"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="supplier-active" className="sr-only">
              Filter by active state
            </label>
            <select
              id="supplier-active"
              value={isActive}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setIsActive(event.target.value as '' | 'true' | 'false');
                setPage(1);
              }}
            >
              <option value="">All suppliers</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        {suppliers.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-700">
              {suppliers.error instanceof Error
                ? suppliers.error.message
                : 'Suppliers failed to load.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void suppliers.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : suppliers.isPending ? (
          <div className="divide-y divide-slate-100" role="status" aria-label="Loading suppliers">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-4 w-1/4 rounded bg-slate-100" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <Building2 aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {search || isActive ? 'No matching suppliers' : 'No suppliers yet'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {search || isActive
                ? 'Adjust the search or filter to see more results.'
                : canWrite
                  ? 'Add the first supplier to start raising purchase orders.'
                  : 'An owner, admin or manager can add the first supplier.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Supplier directory</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Supplier
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Contact
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Location
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.data.items.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{supplier.name}</p>
                      {supplier.taxId && (
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          Tax ID {supplier.taxId}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{supplier.contactName ?? '—'}</p>
                      <p className="text-xs text-slate-500">
                        {supplier.email ?? supplier.phone ?? ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {supplier.city ?? '—'}
                      {supplier.countryCode ? `, ${supplier.countryCode}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                          supplier.isActive
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                            : 'bg-slate-100 text-slate-600 ring-slate-200',
                        )}
                      >
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canWrite}
                          onClick={() => openEdit(supplier)}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canWrite || activation.isPending}
                          onClick={() =>
                            activation.mutate({
                              supplierId: supplier.id,
                              isActive: !supplier.isActive,
                            })
                          }
                        >
                          <Power aria-hidden="true" className="size-4" />
                          {supplier.isActive ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </div>
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
            noun="supplier"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>

      {organizationId && (
        <SupplierDialog
          organizationId={organizationId}
          supplier={editing}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
        />
      )}
    </div>
  );
}
