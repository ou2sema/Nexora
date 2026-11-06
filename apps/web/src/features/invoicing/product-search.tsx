import { PackageSearch } from 'lucide-react';
import { useState } from 'react';

import type { ProductSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useProducts } from '@/features/catalog/api';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const RESULT_PAGE_SIZE = 20;

interface ProductSearchProps {
  organizationId: string;
  disabled?: boolean;
  onAddProduct: (product: ProductSummary) => void;
  /** A serialized model is sold unit by unit, so the picker chooses the device first. */
  onPickDevice: (product: ProductSummary) => void;
}

/**
 * The fallback for a code that is on the shelf but not on the label: the same
 * product search the catalog page uses, wired straight into the basket.
 */
export function ProductSearch({
  organizationId,
  disabled = false,
  onAddProduct,
  onPickDevice,
}: ProductSearchProps) {
  const { t, errorMessage, formatMoney } = useI18n();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const products = useProducts(organizationId, {
    search: debouncedSearch,
    status: 'active',
    page: 1,
    pageSize: RESULT_PAGE_SIZE,
  });

  const items = products.data?.items ?? [];

  return (
    <section
      aria-labelledby="sale-search-heading"
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 id="sale-search-heading" className="text-sm font-semibold text-slate-900">
        {t('sale.search.title')}
      </h2>
      <p className="mt-1 text-xs text-slate-500">{t('sale.search.hint')}</p>

      <div className="mt-3">
        <label htmlFor="sale-product-search" className="sr-only">
          {t('sale.search.label')}
        </label>
        <input
          id="sale-product-search"
          type="search"
          value={search}
          disabled={disabled}
          placeholder={t('sale.search.placeholder')}
          autoComplete="off"
          className={`${fieldClass} mt-0`}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {products.isError ? (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {errorMessage(products.error, 'sale.search.failed')}
        </p>
      ) : products.isPending ? (
        <p role="status" className="mt-3 text-sm text-slate-500">
          {t('sale.search.loading')}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <PackageSearch aria-hidden="true" className="size-4" />
          {t('sale.search.empty')}
        </p>
      ) : (
        <ul className="mt-3 max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {items.map((product) => (
            <li key={product.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <span dir="ltr" className="font-mono">
                    {product.sku}
                  </span>
                  {' · '}
                  {product.isSerialized
                    ? t('sale.search.serialized')
                    : product.salePriceMinor === null
                      ? t('sale.search.noPrice')
                      : formatMoney(product.salePriceMinor)}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  product.isSerialized ? onPickDevice(product) : onAddProduct(product)
                }
              >
                {t(product.isSerialized ? 'sale.search.pickDevice' : 'sale.search.add')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
