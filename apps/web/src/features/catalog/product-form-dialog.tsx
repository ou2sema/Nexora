import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type {
  BrandSummary,
  CategorySummary,
  ProductCreateInput,
  ProductStatus,
} from '@mystock/contracts';
import { isValidGtinBarcode, toMinorUnits } from '@mystock/domain';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import { useCreateProduct } from './api';

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500';

function parsePriceInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;

  try {
    return toMinorUnits(amount);
  } catch {
    return null;
  }
}

const priceField = z
  .string()
  .trim()
  .refine((value) => value === '' || parsePriceInput(value) !== null, {
    message: 'Use a positive amount with up to 3 decimals',
  });

const thresholdField = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || (/^\d+(\.\d{1,4})?$/.test(value) && Number(value) <= 1_000_000_000),
    { message: 'Use a non-negative quantity with up to 4 decimals' },
  );

const schema = z.object({
  sku: z.string().trim().min(1, 'Enter a SKU').max(64),
  name: z.string().trim().min(1, 'Enter a product name').max(200),
  categoryId: z.string(),
  brandId: z.string(),
  barcode: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[0-9]{8}$|^[0-9]{12,14}$/.test(value), {
      message: 'Use 8, 12, 13 or 14 digits',
    })
    .refine((value) => value === '' || isValidGtinBarcode(value), {
      message: 'The check digit is invalid',
    }),
  purchasePrice: priceField,
  salePrice: priceField,
  reorderThreshold: thresholdField,
  isSerialized: z.boolean(),
  status: z.enum(['active', 'inactive', 'discontinued']),
});

type Values = z.infer<typeof schema>;

interface ProductFormDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategorySummary[];
  brands: BrandSummary[];
}

export function ProductFormDialog({
  organizationId,
  open,
  onOpenChange,
  categories,
  brands,
}: ProductFormDialogProps) {
  const mutation = useCreateProduct(organizationId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: '',
      name: '',
      categoryId: '',
      brandId: '',
      barcode: '',
      purchasePrice: '',
      salePrice: '',
      reorderThreshold: '',
      isSerialized: false,
      status: 'active',
    },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'The product could not be created.'
        : null;

  const submit = handleSubmit(async (values) => {
    const input: ProductCreateInput = {
      sku: values.sku,
      name: values.name,
      categoryId: values.categoryId || null,
      brandId: values.brandId || null,
      barcode: values.barcode || null,
      purchasePriceMinor: parsePriceInput(values.purchasePrice),
      salePriceMinor: parsePriceInput(values.salePrice),
      reorderThreshold: values.reorderThreshold === '' ? 0 : Number(values.reorderThreshold),
      isSerialized: values.isSerialized,
      status: values.status as ProductStatus,
    };

    try {
      await mutation.mutateAsync(input);
      reset();
      onOpenChange(false);
    } catch {
      // mutation.error renders below the fields.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Add product</DialogTitle>
        <DialogDescription>
          Prices are entered in Tunisian dinars and stored as integer millimes.
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="product-sku" className="block text-sm font-medium text-slate-700">
                SKU
              </label>
              <input
                id="product-sku"
                type="text"
                autoComplete="off"
                className={fieldClass}
                aria-invalid={Boolean(errors.sku)}
                aria-describedby={errors.sku ? 'product-sku-error' : undefined}
                {...register('sku')}
              />
              {errors.sku && (
                <p id="product-sku-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.sku.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="product-barcode" className="block text-sm font-medium text-slate-700">
                Barcode (optional)
              </label>
              <input
                id="product-barcode"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={fieldClass}
                aria-invalid={Boolean(errors.barcode)}
                aria-describedby={errors.barcode ? 'product-barcode-error' : undefined}
                {...register('barcode')}
              />
              {errors.barcode && (
                <p id="product-barcode-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.barcode.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="product-name" className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="product-name"
              type="text"
              className={fieldClass}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'product-name-error' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="product-name-error" role="alert" className="mt-1 text-xs text-rose-700">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="product-category"
                className="block text-sm font-medium text-slate-700"
              >
                Category
              </label>
              <select id="product-category" className={fieldClass} {...register('categoryId')}>
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="product-brand" className="block text-sm font-medium text-slate-700">
                Brand
              </label>
              <select id="product-brand" className={fieldClass} {...register('brandId')}>
                <option value="">No brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="product-purchase-price"
                className="block text-sm font-medium text-slate-700"
              >
                Purchase price (TND)
              </label>
              <input
                id="product-purchase-price"
                type="text"
                inputMode="decimal"
                placeholder="0.000"
                className={fieldClass}
                aria-invalid={Boolean(errors.purchasePrice)}
                aria-describedby={errors.purchasePrice ? 'product-purchase-error' : undefined}
                {...register('purchasePrice')}
              />
              {errors.purchasePrice && (
                <p id="product-purchase-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.purchasePrice.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="product-sale-price"
                className="block text-sm font-medium text-slate-700"
              >
                Sale price (TND)
              </label>
              <input
                id="product-sale-price"
                type="text"
                inputMode="decimal"
                placeholder="0.000"
                className={fieldClass}
                aria-invalid={Boolean(errors.salePrice)}
                aria-describedby={errors.salePrice ? 'product-sale-error' : undefined}
                {...register('salePrice')}
              />
              {errors.salePrice && (
                <p id="product-sale-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.salePrice.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="product-status" className="block text-sm font-medium text-slate-700">
                Status
              </label>
              <select id="product-status" className={fieldClass} {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="product-reorder-threshold"
                className="block text-sm font-medium text-slate-700"
              >
                Reorder threshold
              </label>
              <input
                id="product-reorder-threshold"
                type="text"
                inputMode="decimal"
                placeholder="0"
                className={fieldClass}
                aria-invalid={Boolean(errors.reorderThreshold)}
                aria-describedby={
                  errors.reorderThreshold ? 'product-reorder-threshold-error' : undefined
                }
                {...register('reorderThreshold')}
              />
              {errors.reorderThreshold && (
                <p
                  id="product-reorder-threshold-error"
                  role="alert"
                  className="mt-1 text-xs text-rose-700"
                >
                  {errors.reorderThreshold.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-indigo-600"
                {...register('isSerialized')}
              />
              Track individual serial numbers
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Low-stock alerts use the threshold; 0 disables them.
            </p>
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {errorMessage}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Create product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
