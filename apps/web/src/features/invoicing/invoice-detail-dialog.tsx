import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { PaymentMethod, SalesInvoiceDetail } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';
import { parseAmountToMinor } from '@/lib/parse-amount';

import { useRecordInvoicePayment, useRetrySafeIdempotencyKey, useSalesInvoice } from './api';
import { InvoicePdfButtons } from './invoice-pdf-buttons';
import { paymentMethodKeys, paymentStatusKeys, paymentStatusStyles } from './labels';

interface InvoiceDetailDialogProps {
  organizationId: string;
  invoiceId: string | null;
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The invoice as the database wrote it. Every amount on this screen is read back
 * from `app.create_sales_invoice` — the only place that recomputes them — so the
 * operator can settle a balance without trusting the counter's preview.
 */
export function InvoiceDetailDialog({
  organizationId,
  invoiceId,
  canWrite,
  onOpenChange,
}: InvoiceDetailDialogProps) {
  const { t, errorMessage, formatMoney, formatDateTime } = useI18n();
  const invoice = useSalesInvoice(organizationId, invoiceId);
  const recordPayment = useRecordInvoicePayment(organizationId);
  const { key: idempotencyKey, rotate } = useRetrySafeIdempotencyKey();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setAmount('');
    setNote('');
    setFormError(null);
    setNotice(null);
  }, [invoiceId]);

  const data = invoice.data;
  const paymentError = recordPayment.error
    ? errorMessage(recordPayment.error, 'invoice.detail.payment.failed')
    : null;

  const settled = useMemo(() => {
    const parsed = parseAmountToMinor(amount);
    return parsed !== null && data !== undefined && parsed === data.remainingAmountMinor;
  }, [amount, data]);

  const submitPayment = async () => {
    if (!data) return;

    setFormError(null);
    setNotice(null);

    const amountMinor = parseAmountToMinor(amount);
    if (amountMinor === null || amountMinor <= 0) {
      setFormError(t('invoice.detail.payment.invalid'));
      return;
    }
    if (amountMinor > data.remainingAmountMinor) {
      setFormError(t('invoice.detail.payment.exceedsRemaining'));
      return;
    }

    try {
      const result = await recordPayment.mutateAsync({
        invoiceId: data.id,
        input: { amountMinor, method, note: note.trim() || null },
        idempotencyKey,
      });
      // Spent: the next payment on this invoice needs a fresh key.
      rotate();
      setAmount('');
      setNote('');
      setNotice(
        t(
          result.paymentStatus === 'paid'
            ? 'invoice.detail.payment.fullyPaid'
            : 'invoice.detail.payment.recorded',
          {
            number: result.number,
            remaining: formatMoney(result.remainingAmountMinor),
          },
        ),
      );
    } catch {
      // recordPayment.error renders below the form.
    }
  };

  return (
    <Dialog open={Boolean(invoiceId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>
          {data ? (
            <>
              <span dir="ltr">{data.number}</span> · {data.customerName}
            </>
          ) : (
            t('invoice.detail.title')
          )}
        </DialogTitle>
        <DialogDescription>
          {data
            ? t('invoice.detail.issuedOn', { when: formatDateTime(data.issuedAt) })
            : t('invoice.detail.subtitle')}
        </DialogDescription>

        {invoice.isError ? (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errorMessage(invoice.error, 'invoice.detail.loadFailed')}
          </p>
        ) : data ? (
          <div className="mt-5 space-y-6">
            <InvoiceSummary data={data} />

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <InvoiceLines data={data} />
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
              <TotalItem label={t('invoice.detail.net')} value={formatMoney(data.netAmountMinor)} />
              <TotalItem label={t('invoice.detail.tax')} value={formatMoney(data.taxAmountMinor)} />
              <TotalItem
                label={t('invoice.detail.total')}
                value={formatMoney(data.totalAmountMinor)}
                strong
              />
              <TotalItem
                label={t('invoice.detail.paid')}
                value={formatMoney(data.paidAmountMinor)}
              />
              <TotalItem
                label={t('invoice.detail.remaining')}
                value={formatMoney(data.remainingAmountMinor)}
                strong
              />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('invoice.detail.status')}
                </dt>
                <dd className="mt-1">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                      paymentStatusStyles[data.paymentStatus],
                    )}
                  >
                    {t(paymentStatusKeys[data.paymentStatus])}
                  </span>
                </dd>
              </div>
            </dl>

            {data.notes && (
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{t('common.notes')}:</span> {data.notes}
              </p>
            )}

            <PaymentsSection data={data} />

            {notice && (
              <p
                role="status"
                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                {notice}
              </p>
            )}

            {canWrite && data.remainingAmountMinor > 0 && (
              <section
                aria-labelledby="invoice-payment-heading"
                className="rounded-lg border border-slate-200 p-4"
              >
                <h3 id="invoice-payment-heading" className="text-sm font-semibold text-slate-900">
                  {t('invoice.detail.payment.heading')}
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  {t('invoice.detail.payment.dueNow', {
                    remaining: formatMoney(data.remainingAmountMinor),
                  })}
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_12rem_1fr]">
                  <div>
                    <label
                      htmlFor="invoice-payment-amount"
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t('invoice.detail.payment.amount')}
                    </label>
                    <input
                      id="invoice-payment-amount"
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={amount}
                      placeholder="0.000"
                      className={`${fieldClass} mt-0 font-mono`}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="invoice-payment-method"
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t('invoice.detail.payment.method')}
                    </label>
                    <select
                      id="invoice-payment-method"
                      value={method}
                      className={fieldClass}
                      onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                    >
                      {(Object.keys(paymentMethodKeys) as PaymentMethod[]).map((option) => (
                        <option key={option} value={option}>
                          {t(paymentMethodKeys[option])}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="invoice-payment-note"
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t('invoice.detail.payment.note')}
                    </label>
                    <input
                      id="invoice-payment-note"
                      type="text"
                      maxLength={500}
                      value={note}
                      className={fieldClass}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>
                </div>

                {(formError || paymentError) && (
                  <p role="alert" className="mt-2 text-xs text-rose-700">
                    {formError ?? paymentError}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={recordPayment.isPending || amount.trim() === ''}
                    onClick={() => void submitPayment()}
                  >
                    {recordPayment.isPending && (
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    )}
                    {t('invoice.detail.payment.submit')}
                  </Button>
                  {settled && (
                    <span className="text-xs text-emerald-700">
                      {t('invoice.detail.payment.settlesInvoice')}
                    </span>
                  )}
                </div>
              </section>
            )}

            {!canWrite && (
              <p className="text-xs text-slate-500">{t('invoice.detail.viewerReadOnly')}</p>
            )}

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">{t('invoice.detail.docs')}</h3>
              <p className="mt-1 text-xs text-slate-500">{t('invoice.detail.docsHint')}</p>
              <div className="mt-3">
                <InvoicePdfButtons organizationId={organizationId} invoiceId={data.id} />
              </div>
            </div>
          </div>
        ) : (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t('invoice.detail.loading')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TotalItem({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn('mt-1 font-mono text-slate-800', strong && 'font-semibold text-slate-900')}>
        {value}
      </dd>
    </div>
  );
}

function InvoiceSummary({ data }: { data: SalesInvoiceDetail }) {
  const { t, formatDate, formatDateTime, formatQuantity } = useI18n();

  return (
    <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('invoice.detail.customer')}
        </dt>
        <dd className="mt-1 text-slate-800">{data.customerName}</dd>
        <dd className="text-xs text-slate-500">{data.customerEmail ?? data.customerPhone ?? ''}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('invoice.detail.depot')}
        </dt>
        <dd className="mt-1 text-slate-800">
          {data.warehouseCode} / {data.locationCode}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('invoice.detail.issued')}
        </dt>
        <dd className="mt-1 text-slate-800">{formatDateTime(data.issuedAt)}</dd>
        <dd className="text-xs text-slate-500">
          {data.createdByEmail ?? t('common.notAvailable')} · {formatDate(data.createdAt)}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('invoice.detail.volume')}
        </dt>
        <dd className="mt-1 text-slate-800">
          {t('invoice.detail.lineQuantity', {
            lines: data.lineCount,
            quantity: formatQuantity(data.totalQuantity),
          })}
        </dd>
        {data.salesOrderNumber && (
          <dd dir="ltr" className="font-mono text-xs text-slate-500">
            {data.salesOrderNumber}
          </dd>
        )}
      </div>
    </dl>
  );
}

function InvoiceLines({ data }: { data: SalesInvoiceDetail }) {
  const { t, formatMoney, formatQuantity } = useI18n();

  return (
    <table className="w-full text-start text-sm">
      <caption className="sr-only">{t('invoice.detail.linesCaption')}</caption>
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th scope="col" className="px-3 py-2 text-start font-semibold">
            {t('invoice.detail.columns.item')}
          </th>
          <th scope="col" className="px-3 py-2 text-end font-semibold">
            {t('common.quantity')}
          </th>
          <th scope="col" className="px-3 py-2 text-end font-semibold">
            {t('invoice.detail.columns.unitPrice')}
          </th>
          <th scope="col" className="px-3 py-2 text-end font-semibold">
            {t('invoice.detail.columns.taxRate')}
          </th>
          <th scope="col" className="px-3 py-2 text-end font-semibold">
            {t('invoice.detail.columns.total')}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.lines.map((line) => (
          <tr key={line.id}>
            <td className="px-3 py-2">
              <p className="text-slate-800">{line.productName}</p>
              <p dir="ltr" className="font-mono text-xs text-slate-500">
                {line.serialNumber ?? line.productSku}
              </p>
            </td>
            <td className="px-3 py-2 text-end text-slate-700">{formatQuantity(line.quantity)}</td>
            <td className="px-3 py-2 text-end text-slate-700">
              {formatMoney(line.unitPriceMinor)}
            </td>
            <td dir="ltr" className="px-3 py-2 text-end text-slate-700">
              {formatQuantity(line.taxRatePercent)}%
            </td>
            <td className="px-3 py-2 text-end">
              <p className="font-mono text-slate-900">
                {formatMoney(line.netAmountMinor + line.taxAmountMinor)}
              </p>
              <p className="font-mono text-xs text-slate-500">
                {formatMoney(line.netAmountMinor)} + {formatMoney(line.taxAmountMinor)}
              </p>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PaymentsSection({ data }: { data: SalesInvoiceDetail }) {
  const { t, formatMoney, formatDateTime } = useI18n();

  if (data.payments.length === 0) {
    return <p className="text-sm text-slate-500">{t('invoice.detail.payments.empty')}</p>;
  }

  return (
    <section aria-labelledby="invoice-payments-heading" className="space-y-2">
      <h3 id="invoice-payments-heading" className="text-sm font-semibold text-slate-900">
        {t('invoice.detail.payments.title')}
      </h3>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {data.payments.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-baseline gap-2 px-3 py-2 text-sm">
            <span className="font-mono font-semibold text-slate-900">
              {formatMoney(payment.amountMinor)}
            </span>
            <span className="text-slate-700">{t(paymentMethodKeys[payment.method])}</span>
            <span className="text-xs text-slate-500">{formatDateTime(payment.recordedAt)}</span>
            {payment.recordedByEmail && (
              <span dir="ltr" className="text-xs text-slate-400">
                {payment.recordedByEmail}
              </span>
            )}
            {payment.note && <span className="w-full text-xs text-slate-500">{payment.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
