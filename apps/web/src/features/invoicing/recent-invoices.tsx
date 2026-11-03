import { Search } from 'lucide-react';
import { useState } from 'react';

import type { PaymentStatus } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import { useSalesInvoices } from './api';
import { paymentStatusKeys, paymentStatusStyles } from './labels';

const PAGE_SIZE = 10;

interface RecentInvoicesProps {
  organizationId: string;
  canWrite: boolean;
  onOpenInvoice: (invoiceId: string) => void;
}

/**
 * The counter's memory: the invoices just posted, with what is still owed on
 * them. A sale is immutable, so the only action here is to open one and record
 * the next payment against a balance.
 */
export function RecentInvoices({ organizationId, canWrite, onOpenInvoice }: RecentInvoicesProps) {
  const { t, errorMessage, formatMoney, formatDateTime } = useI18n();
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);
  const invoices = useSalesInvoices(organizationId, {
    search: debouncedSearch,
    paymentStatus,
    page,
    pageSize: PAGE_SIZE,
  });

  const total = invoices.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section
      aria-labelledby="sale-recent-heading"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="sale-recent-heading" className="text-sm font-semibold text-slate-900">
          {t('sale.recent.title')}
        </h2>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <label htmlFor="sale-recent-search" className="sr-only">
              {t('sale.recent.searchLabel')}
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="sale-recent-search"
              type="search"
              value={search}
              placeholder={t('sale.recent.searchPlaceholder')}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 py-2 ps-9 pe-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="sale-recent-status" className="sr-only">
              {t('sale.recent.filterStatus')}
            </label>
            <select
              id="sale-recent-status"
              value={paymentStatus}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setPaymentStatus(event.target.value as PaymentStatus | '');
                setPage(1);
              }}
            >
              <option value="">{t('sale.recent.allStatuses')}</option>
              {(Object.keys(paymentStatusKeys) as PaymentStatus[]).map((status) => (
                <option key={status} value={status}>
                  {t(paymentStatusKeys[status])}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {invoices.isError ? (
        <div className="p-6">
          <p role="alert" className="text-sm text-rose-700">
            {errorMessage(invoices.error, 'sale.recent.loadFailed')}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void invoices.refetch()}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : invoices.isPending ? (
        <p role="status" className="px-4 py-6 text-sm text-slate-500">
          {t('sale.recent.loading')}
        </p>
      ) : total === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-600">
          {debouncedSearch || paymentStatus
            ? t('sale.recent.emptyFiltered')
            : canWrite
              ? t('sale.recent.emptyNone')
              : t('sale.recent.emptyReadOnly')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <caption className="sr-only">{t('sale.recent.title')}</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t('sale.recent.columns.number')}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t('invoice.detail.customer')}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t('sale.recent.columns.issued')}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-semibold">
                  {t('sale.totals.total')}
                </th>
                <th scope="col" className="px-4 py-3 text-end font-semibold">
                  {t('invoice.detail.remaining')}
                </th>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  {t('common.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.data.items.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p dir="ltr" className="font-mono text-sm font-medium text-slate-900">
                          {invoice.number}
                        </p>
                        <p className="text-xs text-slate-500">
                          {invoice.warehouseCode} / {invoice.locationCode}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenInvoice(invoice.id)}
                      >
                        {t('sale.recent.open')}
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{invoice.customerName}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(invoice.issuedAt)}</td>
                  <td className="px-4 py-3 text-end font-mono text-slate-900">
                    {formatMoney(invoice.totalAmountMinor)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-end font-mono',
                      invoice.remainingAmountMinor > 0 ? 'text-rose-700' : 'text-slate-500',
                    )}
                  >
                    {formatMoney(invoice.remainingAmountMinor)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                        paymentStatusStyles[invoice.paymentStatus],
                      )}
                    >
                      {t(paymentStatusKeys[invoice.paymentStatus])}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <PaginationFooter
          total={total}
          page={page}
          pageCount={pageCount}
          nounKey="common.noun.invoices"
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      )}
    </section>
  );
}
