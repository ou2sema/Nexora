import { useEffect, useState, type FormEvent } from 'react';

import type { ProductSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { useUpdateProduct } from './api';

interface ReorderThresholdDialogProps {
  organizationId: string;
  product: ProductSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseThreshold(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;

  const threshold = Number(normalized);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1_000_000_000) return null;
  if (Math.abs(threshold * 10_000 - Math.round(threshold * 10_000)) > 1e-6) return null;

  return threshold;
}

export function ReorderThresholdDialog({
  organizationId,
  product,
  open,
  onOpenChange,
}: ReorderThresholdDialogProps) {
  const { t, errorMessage } = useI18n();
  const mutation = useUpdateProduct(organizationId);
  const [value, setValue] = useState('0');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && product) {
      setValue(String(product.reorderThreshold));
      setError(null);
      mutation.reset();
    }
  }, [open, product]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product) return;

    const threshold = parseThreshold(value);
    if (threshold === null) {
      setError(t('reorder.invalid'));
      return;
    }

    try {
      await mutation.mutateAsync({ productId: product.id, input: { reorderThreshold: threshold } });
      onOpenChange(false);
    } catch (failure) {
      setError(errorMessage(failure, 'reorder.failed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('reorder.title')}</DialogTitle>
        <DialogDescription>
          {product
            ? t('reorder.descriptionProduct', { name: product.name, sku: product.sku })
            : t('reorder.description')}
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="reorder-threshold" className="block text-sm font-medium text-slate-700">
              {t('reorder.field')}
            </label>
            <input
              id="reorder-threshold"
              type="text"
              inputMode="decimal"
              className={fieldClass}
              value={value}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'reorder-threshold-error' : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
            {error && (
              <p id="reorder-threshold-error" role="alert" className="mt-1 text-xs text-rose-700">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending || !product}>
              {mutation.isPending ? t('common.saving') : t('reorder.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
