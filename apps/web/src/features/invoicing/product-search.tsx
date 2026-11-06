import { PackageSearch } from 'lucide-react';
import { useState } from 'react';

import type { ProductSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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

/** The search itself, without card chrome: the dialog owns the heading and the hint. */
function ProductSearch({
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
    <div>
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
        <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto">
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
    </div>
  );
}

interface ProductSearchDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the counter just did with the item, said where the operator is looking. */
  notice?: string | null;
  onAddProduct: (product: ProductSummary) => void;
  onPickDevice: (product: ProductSummary) => void;
}

/**
 * The fallback for a code that is on the shelf but not on the label, kept out of
 * the page so the counter shows only what the operator is working on. Adding an
 * item leaves the dialog open — a counter sells several things at once — while a
 * serialized model hands over to the unit picker.
 */
export function ProductSearchDialog({
  organizationId,
  open,
  onOpenChange,
  notice = null,
  onAddProduct,
  onPickDevice,
}: ProductSearchDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t('sale.search.title')}</DialogTitle>
        <DialogDescription>{t('sale.search.hint')}</DialogDescription>

        <div className="mt-4">
          <ProductSearch
            organizationId={organizationId}
            onAddProduct={onAddProduct}
            onPickDevice={(product) => {
              onOpenChange(false);
              onPickDevice(product);
            }}
          />
        </div>

        {notice && (
          <p role="status" className="mt-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
