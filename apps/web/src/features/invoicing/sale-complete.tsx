import { CheckCircle2 } from 'lucide-react';

import type { SalesInvoiceCreateResult } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

import { InvoicePdfButtons } from './invoice-pdf-buttons';
import { paymentMethodKeys, paymentStatusKeys, paymentStatusStyles } from './labels';

const TITLE_KEYS: Record<SalesInvoiceCreateResult['paymentStatus'], MessageKey> = {
  paid: 'sale.done.title.paid',
  partial: 'sale.done.title.partial',
  unpaid: 'sale.done.title.unpaid',
};

interface SaleCompleteProps {
  organizationId: string;
  result: SalesInvoiceCreateResult;
  /** Whom the invoice was addressed to, as the operator named them. */
  buyerName: string | null;
  locationName: string | null;
  /** Cash handed over at the counter; only the total of that is booked as payment. */
  tenderedMinor: number | null;
  onNewSale: () => void;
  onOpenInvoice: (invoiceId: string) => void;
}

/**
 * The close of the counter: what the server booked, not what the screen
 * previewed. The amounts, the number and the payment status all come back from
 * `app.create_sales_invoice`, so this page cannot disagree with the invoice.
 */
export function SaleComplete({
  organizationId,
  result,
  buyerName,
  locationName,
  tenderedMinor,
  onNewSale,
  onOpenInvoice,
}: SaleCompleteProps) {
  const { t, plural, formatMoney, formatDateTime } = useI18n();
  const changeMinor =
    tenderedMinor !== null ? Math.max(0, tenderedMinor - result.totalAmountMinor) : 0;

  return (
    <section aria-labelledby="sale-done-heading" className="space-y-4">
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
        >
          <CheckCircle2 className="size-7" />
        </span>
        <h2 id="sale-done-heading" className="mt-4 text-xl font-semibold text-slate-900">
          {t(TITLE_KEYS[result.paymentStatus])}
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-600">
          {t('sale.done.summary', {
            buyer: buyerName ?? t('sale.done.walkIn'),
            units: plural('common.noun.units', result.totalQuantity),
            location: locationName ?? t('sale.noDepotSelected'),
          })}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p dir="ltr" className="font-mono text-sm font-semibold text-slate-900">
            {result.number}
          </p>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium ring-1',
              paymentStatusStyles[result.paymentStatus],
            )}
          >
            {t(paymentStatusKeys[result.paymentStatus])}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {formatDateTime(result.issuedAt)}
          {result.paymentMethod && ` · ${t(paymentMethodKeys[result.paymentMethod])}`}
        </p>

        <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
          <Row label={t('sale.totals.total')} value={formatMoney(result.totalAmountMinor)} strong />
          <Row label={t('sale.done.recorded')} value={formatMoney(result.paidAmountMinor)} />
          <Row
            label={t('sale.payment.remaining')}
            value={formatMoney(result.remainingAmountMinor)}
          />
          {result.paymentMethod === 'cash' && tenderedMinor !== null && (
            <Row label={t('sale.payment.tendered')} value={formatMoney(tenderedMinor)} />
          )}
          {changeMinor > 0 && (
            <Row label={t('sale.done.returnChange')} value={formatMoney(changeMinor)} success />
          )}
        </dl>

        <p className="mt-3 text-xs text-slate-500">
          {t(result.orderId ? 'sale.posted.issued' : 'sale.posted.devicesOnly')}
        </p>
        {result.duplicate && (
          <p className="mt-1 text-xs text-amber-800">{t('sale.posted.replayed')}</p>
        )}
      </div>

      <div className="space-y-3">
        <Button type="button" className="w-full text-base" onClick={onNewSale}>
          {t('sale.done.newSale')}
        </Button>
        <InvoicePdfButtons organizationId={organizationId} invoiceId={result.invoiceId} />
        <Button
          type="button"
          variant="ghost"
          className="w-full text-indigo-700"
          onClick={() => onOpenInvoice(result.invoiceId)}
        >
          {t('sale.done.view')}
        </Button>
      </div>

      <p className="text-center text-xs text-slate-500">{t('sale.done.footer')}</p>
    </section>
  );
}

interface RowProps {
  label: string;
  value: string;
  strong?: boolean;
  success?: boolean;
}

function Row({ label, value, strong = false, success = false }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn('text-slate-500', strong && 'font-semibold text-slate-900')}>{label}</dt>
      <dd
        dir="ltr"
        className={cn(
          'font-mono text-slate-900',
          strong && 'text-base font-semibold',
          success && 'font-semibold text-emerald-700',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
