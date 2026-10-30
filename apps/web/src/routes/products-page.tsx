import { PackagePlus, Printer, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ProductStatus, ProductSummary } from '@mystock/contracts';
import { formatTnd } from '@mystock/domain';

import { Button } from '@/components/ui/button';
import { useBrands, useCategories, useProducts } from '@/features/catalog/api';
import { LabelDialog, type LabelTarget } from '@/features/scanning/label-dialog';
import { useAssignBarcode } from '@/features/scanning/api';
import { ProductFormDialog } from '@/features/catalog/product-form-dialog';
import { ReorderThresholdDialog } from '@/features/catalog/reorder-threshold-dialog';
import { useOrganization } from '@/features/organizations/organization-provider';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 25;

const statusStyles: Record<ProductStatus, string> = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  inactive: 'bg-slate-100 text-slate-700 ring-slate-200',
  discontinued: 'bg-amber-50 text-amber-800 ring-amber-200',
  archived: 'bg-rose-50 text-rose-800 ring-rose-200',
};

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function ProductsPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [labelTargets, setLabelTargets] = useState<LabelTarget[] | null>(null);
  const [thresholdTarget, setThresholdTarget] = useState<ProductSummary | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const assignBarcode = useAssignBarcode(organizationId ?? '');

  const debouncedSearch = useDebouncedValue(search);
  const products = useProducts(organizationId, {
    search: debouncedSearch,
    status,
    page,
    pageSize: PAGE_SIZE,
  });
  const categories = useCategories(organizationId);
  const brands = useBrands(organizationId);

  const total = products.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-600">
            Catalog of electronics, accessories and components for this organization.
          </p>
        </div>
        <Button disabled={!canWrite} onClick={() => setDialogOpen(true)}>
          <PackagePlus aria-hidden="true" className="size-4" />
          Add product
        </Button>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Your viewer role is read-only. Owners, admins and managers can add products.
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor="product-search" className="sr-only">
              Search products
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="product-search"
              type="search"
              value={search}
              placeholder="Search by name, SKU or barcode"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="product-status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="product-status-filter"
              value={status}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setStatus(event.target.value as ProductStatus | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discontinued">Discontinued</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {products.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-700">
              {products.error instanceof Error
                ? products.error.message
                : 'Products failed to load.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void products.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : products.isPending ? (
          <div className="divide-y divide-slate-100" aria-label="Loading products" role="status">
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
              <PackagePlus aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {search || status ? 'No matching products' : 'No products yet'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {search || status
                ? 'Adjust the search or status filter to see more results.'
                : canWrite
                  ? 'Add your first product to start building the catalog.'
                  : 'The catalog is empty. An owner, admin or manager can add products.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Products in this organization</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Brand
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Sale price
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Tracking
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Reorder at
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Labels
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.data.items.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">{product.sku}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {product.barcode ?? 'No barcode assigned'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.categoryName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{product.brandName ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {product.salePriceMinor === null
                        ? '—'
                        : formatTnd(product.salePriceMinor, 'en-TN')}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {product.isSerialized ? 'Serialized' : 'Quantity'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {product.reorderThreshold > 0 ? product.reorderThreshold : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1',
                          statusStyles[product.status],
                        )}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!product.barcode && canWrite && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={assignBarcode.isPending}
                            onClick={() => {
                              setBarcodeError(null);
                              assignBarcode.mutate(product.id, {
                                onError: (error) =>
                                  setBarcodeError(
                                    error instanceof Error
                                      ? error.message
                                      : 'The barcode could not be assigned.',
                                  ),
                              });
                            }}
                          >
                            Assign barcode
                          </Button>
                        )}
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setThresholdTarget(product)}
                          >
                            Threshold
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setLabelTargets([
                              {
                                kind: 'product',
                                id: product.id,
                                title: `${product.name} (${product.sku})`,
                              },
                            ])
                          }
                        >
                          <Printer aria-hidden="true" className="size-4" />
                          Label
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {barcodeError && (
          <p
            role="alert"
            className="border-t border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {barcodeError}
          </p>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <p>
              {total} product{total === 1 ? '' : 's'} · page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>

      {organizationId && labelTargets && (
        <LabelDialog
          organizationId={organizationId}
          targets={labelTargets}
          open={Boolean(labelTargets)}
          onOpenChange={(open) => {
            if (!open) setLabelTargets(null);
          }}
        />
      )}

      {organizationId && (
        <ProductFormDialog
          organizationId={organizationId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          categories={categories.data ?? []}
          brands={brands.data ?? []}
        />
      )}

      {organizationId && (
        <ReorderThresholdDialog
          organizationId={organizationId}
          product={thresholdTarget}
          open={Boolean(thresholdTarget)}
          onOpenChange={(open) => {
            if (!open) setThresholdTarget(null);
          }}
        />
      )}
    </div>
  );
}
