import { useEffect, useRef, useState } from 'react';

import type { ProductSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { parseQuantity } from '@/lib/parse-amount';

import type { BasketOrigin } from './basket';

/** A code the counter resolved to a product, held until the operator accepts it. */
export interface PendingScan {
  product: ProductSummary;
  /** Whatever the label carried: a barcode, a SKU or an internal code. */
  code: string;
  origin: BasketOrigin;
  /** The price the basket line will use: an existing override, else the catalogue. */
  unitPriceMinor: number | null;
  /** What this product already holds in the basket. */
  alreadyInBasket: number;
}

interface ScanConfirmDialogProps {
  scan: PendingScan | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scan: PendingScan, quantity: number) => void;
}

/**
 * A scan is not a click: the camera re-reads a label that stays in frame and a
 * wedge fires the moment its trigger is squeezed, so the counter shows what the
 * code resolved to and asks before the basket moves. The quantity arrives focused
 * and selected, which keeps a depot rhythm of scan, Enter, scan, Enter.
 */
export function ScanConfirmDialog({ scan, onOpenChange, onConfirm }: ScanConfirmDialogProps) {
  const { t, plural, formatMoney } = useI18n();
  const [quantity, setQuantity] = useState('1');
  const quantityRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuantity('1');
  }, [scan]);

  const parsed = parseQuantity(quantity);

  const submit = () => {
    if (!scan || parsed === null) return;
    onConfirm(scan, parsed);
  };

  return (
    <Dialog open={scan !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          quantityRef.current?.focus();
          quantityRef.current?.select();
        }}
      >
        <DialogTitle>{t('sale.confirm.title', { product: scan?.product.name ?? '' })}</DialogTitle>
        <DialogDescription>{t('sale.confirm.hint')}</DialogDescription>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">{t('sale.confirm.code')}</dt>
            <dd dir="ltr" className="break-all text-end font-mono text-slate-900">
              {scan?.code ?? ''}
            </dd>
            <dt className="text-slate-500">{t('sale.confirm.unitPrice')}</dt>
            <dd className="text-end font-mono text-slate-900">
              {scan?.unitPriceMinor === null || scan?.unitPriceMinor === undefined
                ? t('sale.search.noPrice')
                : formatMoney(scan.unitPriceMinor)}
            </dd>
            {(scan?.alreadyInBasket ?? 0) > 0 && (
              <>
                <dt className="text-slate-500">{t('sale.confirm.inBasket')}</dt>
                <dd className="text-end font-mono text-slate-900">
                  {plural('common.noun.units', scan?.alreadyInBasket ?? 0)}
                </dd>
              </>
            )}
          </dl>

          <div className="mt-4">
            <label
              htmlFor="sale-scan-quantity"
              className="block text-xs font-medium text-slate-600"
            >
              {t('sale.confirm.quantity')}
            </label>
            <input
              id="sale-scan-quantity"
              ref={quantityRef}
              value={quantity}
              type="text"
              inputMode="decimal"
              dir="ltr"
              className={`${fieldClass} mt-0 font-mono`}
              aria-invalid={parsed === null}
              onChange={(event) => setQuantity(event.target.value)}
            />
            {parsed === null && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                {t('sale.line.badQuantity')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={parsed === null}>
              {t('sale.confirm.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
