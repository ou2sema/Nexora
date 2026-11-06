import { Loader2 } from 'lucide-react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { BaseSyntheticEvent } from 'react';

import type { CustomerSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';

import type { BasketLine, BasketPreview } from './basket';
import type { SaleCustomer } from './customer-picker';
import { CustomerPicker } from './customer-picker';
import { paymentMethodKeys } from './labels';
import type { SaleValues } from './sale-form';

interface SaleReviewDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  lines: BasketLine[];
  preview: BasketPreview;
  /** Where the units leave from, read back so the operator sees it beside the buyer. */
  locationLabel: string;
  customer: SaleCustomer;
  customerErrorKey: MessageKey | null;
  onCustomerChange: (value: SaleCustomer) => void;
  onCustomerSelected: (customer: CustomerSummary) => void;
  register: UseFormRegister<SaleValues>;
  errors: FieldErrors<SaleValues>;
  isPending: boolean;
  postError: string | null;
  onSubmit: (event: BaseSyntheticEvent) => void;
}

/**
 * The last look before the ledger moves. Everything that was scattered across the
 * right-hand column — buyer, depot, totals, the money taken — is checked here and
 * posted with one action, so the counter page itself stays short enough to work
 * from on a phone.
 */
export function SaleReviewDialog({
  organizationId,
  open,
  onOpenChange,
  canWrite,
  lines,
  preview,
  locationLabel,
  customer,
  customerErrorKey,
  onCustomerChange,
  onCustomerSelected,
  register,
  errors,
  isPending,
  postError,
  onSubmit,
}: SaleReviewDialogProps) {
  const { t, plural, formatMoney } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t('sale.review.title')}</DialogTitle>
        <DialogDescription>{t('sale.review.hint')}</DialogDescription>

        <form noValidate onSubmit={onSubmit} className="mt-4 space-y-5">
          <CustomerPicker
            organizationId={organizationId}
            value={customer}
            canWrite={canWrite}
            onChange={onCustomerChange}
            onSelected={onCustomerSelected}
            errorKey={customerErrorKey}
          />

          <section aria-labelledby="sale-review-lines-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="sale-review-lines-heading" className="text-xs font-semibold text-slate-600">
                {t('sale.review.items')}
              </h3>
              <p className="text-xs text-slate-500">
                {plural('common.noun.units', preview.totalQuantity)}
              </p>
            </div>
            <ul className="mt-1 divide-y divide-slate-100">
              {lines.map((line) => {
                const amounts = preview.lineAmounts[line.key];
                return (
                  <li key={line.key} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-900">
                        <span dir="ltr" className="me-1.5 font-mono text-slate-500">
                          {line.kind === 'device' ? '1' : line.quantity}
                        </span>
                        {line.productName}
                      </p>
                      <p dir="ltr" className="mt-0.5 truncate text-xs text-slate-500">
                        {line.kind === 'device' ? line.serialNumber : line.sku}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm text-slate-900">
                      {amounts ? formatMoney(amounts.totalMinor) : t('sale.basket.notComputed')}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              {t('sale.review.depot')} · <span dir="ltr">{locationLabel}</span>
            </p>
          </section>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-sm">
            <dt className="text-slate-500">{t('sale.totals.net')}</dt>
            <dd className="text-end font-mono text-slate-900">
              {formatMoney(preview.totals.netMinor)}
            </dd>
            <dt className="text-slate-500">{t('sale.totals.tax')}</dt>
            <dd className="text-end font-mono text-slate-900">
              {formatMoney(preview.totals.taxMinor)}
            </dd>
            <dt className="font-semibold text-slate-700">{t('sale.totals.total')}</dt>
            <dd className="text-end font-mono font-semibold text-slate-900">
              {formatMoney(preview.totals.totalMinor)}
            </dd>
          </dl>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sale-payment-amount"
                className="block text-xs font-medium text-slate-600"
              >
                {t('sale.payment.amount')}
              </label>
              <input
                id="sale-payment-amount"
                type="text"
                inputMode="decimal"
                dir="ltr"
                placeholder="0.000"
                className={`${fieldClass} mt-0 font-mono`}
                aria-invalid={Boolean(errors.paymentAmount)}
                {...register('paymentAmount')}
              />
              {errors.paymentAmount && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.paymentAmount.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="sale-payment-method"
                className="block text-xs font-medium text-slate-600"
              >
                {t('sale.payment.method')}
              </label>
              <select
                id="sale-payment-method"
                className={fieldClass}
                {...register('paymentMethod')}
              >
                {(Object.keys(paymentMethodKeys) as (keyof typeof paymentMethodKeys)[]).map(
                  (method) => (
                    <option key={method} value={method}>
                      {t(paymentMethodKeys[method])}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">{t('sale.payment.hint')}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sale-reference" className="block text-xs font-medium text-slate-600">
                {t('sale.checkout.reference')}
              </label>
              <input
                id="sale-reference"
                type="text"
                dir="ltr"
                className={fieldClass}
                {...register('reference')}
              />
            </div>
            <div>
              <label htmlFor="sale-notes" className="block text-xs font-medium text-slate-600">
                {t('sale.checkout.notes')}
              </label>
              <input id="sale-notes" type="text" className={fieldClass} {...register('notes')} />
            </div>
          </div>

          {postError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {postError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!canWrite || isPending}>
              {isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {t('sale.review.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
