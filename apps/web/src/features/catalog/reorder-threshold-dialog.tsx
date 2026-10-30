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
import { ApiError } from '@/lib/api-client';
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
      setError('Use a non-negative quantity with up to 4 decimals.');
      return;
    }

    try {
      await mutation.mutateAsync({ productId: product.id, input: { reorderThreshold: threshold } });
      onOpenChange(false);
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : 'The reorder threshold could not be saved.',
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Reorder threshold</DialogTitle>
        <DialogDescription>
          {product
            ? `Low-stock alerts appear when ${product.name} (${product.sku}) has less availability than this quantity. Use 0 to disable alerts.`
            : 'Low-stock alerts appear when availability falls below this quantity.'}
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="reorder-threshold" className="block text-sm font-medium text-slate-700">
              Threshold quantity
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
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending || !product}>
              {mutation.isPending ? 'Saving…' : 'Save threshold'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
