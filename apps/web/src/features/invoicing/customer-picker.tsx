import { ChevronDown, Pencil, Plus, Search, UserRound } from 'lucide-react';
import { useState } from 'react';

import type { CustomerSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useCustomers } from '@/features/invoicing/api';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import { CustomerDialog } from './customer-dialog';

const DIRECTORY_PAGE_SIZE = 8;

/** Who the invoice is addressed to: a directory customer, or a buyer named at the counter. */
export type SaleCustomer =
  | { mode: 'directory'; customer: CustomerSummary }
  | { mode: 'manual'; name: string; email: string; phone: string };

export const emptyManualCustomer: SaleCustomer = { mode: 'manual', name: '', email: '', phone: '' };

interface CustomerPickerProps {
  organizationId: string;
  value: SaleCustomer;
  canWrite: boolean;
  onChange: (value: SaleCustomer) => void;
  /** A customer chosen from the directory, or created from this screen. */
  onSelected: (customer: CustomerSummary) => void;
  /** Shown while the buyer was neither chosen nor named. */
  errorKey?: MessageKey | null;
  /** Inside the checkout panel, where the card and its heading already exist. */
  embedded?: boolean;
}

/** The identification line printed on the invoice: matricule, city, phone. */
function detailsOf(customer: CustomerSummary): string | null {
  const parts = [customer.taxId, customer.city, customer.phone].filter((part): part is string =>
    Boolean(part),
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * A minimal tenant-scoped directory, not a CRM: pick the buyer or name them.
 * The invoice needs one or the other, and nothing beyond the identification
 * fields the printed document carries.
 */
export function CustomerPicker({
  organizationId,
  value,
  canWrite,
  onChange,
  onSelected,
  errorKey = null,
  embedded = false,
}: CustomerPickerProps) {
  const { t, errorMessage } = useI18n();
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<CustomerSummary | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const customers = useCustomers(organizationId, {
    search: debouncedSearch,
    isActive: 'true',
    page: 1,
    pageSize: DIRECTORY_PAGE_SIZE,
  });

  const items = customers.data?.items ?? [];
  const hasResults = debouncedSearch.trim() !== '' && items.length > 0;
  const manual = value.mode === 'manual' ? value : null;

  return (
    <div
      aria-labelledby={embedded ? undefined : 'sale-customer-heading'}
      className={embedded ? 'space-y-3' : 'rounded-xl border border-slate-200 bg-white p-4'}
    >
      <div className="flex items-center justify-between gap-3">
        {embedded ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('sale.customer.chooseExisting')}
          </p>
        ) : (
          <h2 id="sale-customer-heading" className="text-sm font-semibold text-slate-900">
            {t('sale.customer.title')}
          </h2>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canWrite}
          onClick={() => setCreateOpen(true)}
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('sale.customer.new')}
        </Button>
      </div>

      {value.mode === 'directory' ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <UserRound aria-hidden="true" className="size-4 text-slate-500" />
                {value.customer.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {detailsOf(value.customer) ?? t('sale.customer.noContact')}
              </p>
              {value.customer.email && (
                <p dir="ltr" className="mt-0.5 text-xs text-slate-500">
                  {value.customer.email}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canWrite}
                aria-label={t('sale.customer.edit', { name: value.customer.name })}
                onClick={() => setEditTarget(value.customer)}
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(emptyManualCustomer);
                  setSearch('');
                }}
              >
                {t('sale.customer.change')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="relative">
            <label htmlFor="sale-customer-search" className="sr-only">
              {t('sale.customer.searchLabel')}
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="sale-customer-search"
              type="search"
              value={search}
              autoComplete="off"
              placeholder={t('sale.customer.searchPlaceholder')}
              className={`${fieldClass} mt-0 ps-9`}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {customers.isError ? (
            <p role="alert" className="text-sm text-rose-700">
              {errorMessage(customers.error, 'sale.customer.loadFailed')}
            </p>
          ) : hasResults ? (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {items.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-start hover:bg-slate-50"
                    onClick={() => {
                      onSelected(customer);
                      setSearch('');
                    }}
                  >
                    <p className="text-sm font-medium text-slate-900">{customer.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {detailsOf(customer) ?? t('sale.customer.noContact')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : debouncedSearch.trim() !== '' ? (
            <p className="text-xs text-slate-500">{t('sale.customer.searchEmpty')}</p>
          ) : null}

          <div className="space-y-3">
            <div>
              <label
                htmlFor="sale-customer-name"
                className="flex items-baseline justify-between gap-2 text-xs font-medium text-slate-600"
              >
                <span>{t('sale.customer.name')}</span>
                {/* One marker for the requirement rather than an asterisk beside a
                    word that says the same thing. */}
                <span className="text-[11px] text-slate-400">{t('sale.customer.nameHint')}</span>
              </label>
              <input
                id="sale-customer-name"
                type="text"
                value={manual?.name ?? ''}
                maxLength={160}
                aria-required={true}
                aria-invalid={errorKey !== null}
                className={cn(fieldClass, 'mt-1', errorKey !== null && 'border-rose-400')}
                onChange={(event) =>
                  onChange({
                    mode: 'manual',
                    name: event.target.value,
                    email: manual?.email ?? '',
                    phone: manual?.phone ?? '',
                  })
                }
              />
            </div>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-600 marker:hidden">
                <ChevronDown
                  aria-hidden="true"
                  className="size-3.5 rotate-[-90deg] text-slate-400 transition group-open:rotate-0"
                />
                {t('sale.customer.contact')}
                <span className="text-[11px] font-normal text-slate-400">
                  {t('sale.customer.contactOptional')}
                </span>
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="sale-customer-email"
                    className="block text-xs font-medium text-slate-600"
                  >
                    {t('sale.customer.email')}
                  </label>
                  <input
                    id="sale-customer-email"
                    type="email"
                    dir="ltr"
                    value={manual?.email ?? ''}
                    className={cn(fieldClass, 'mt-1')}
                    onChange={(event) =>
                      onChange({
                        mode: 'manual',
                        name: manual?.name ?? '',
                        email: event.target.value,
                        phone: manual?.phone ?? '',
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="sale-customer-phone"
                    className="block text-xs font-medium text-slate-600"
                  >
                    {t('sale.customer.phone')}
                  </label>
                  <input
                    id="sale-customer-phone"
                    type="tel"
                    dir="ltr"
                    value={manual?.phone ?? ''}
                    className={cn(fieldClass, 'mt-1')}
                    onChange={(event) =>
                      onChange({
                        mode: 'manual',
                        name: manual?.name ?? '',
                        email: manual?.email ?? '',
                        phone: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </details>
          </div>

          {errorKey && (
            <p role="alert" className="text-xs text-rose-700">
              {t(errorKey)}
            </p>
          )}
          <p className="text-xs text-slate-500">{t('sale.customer.manualHint')}</p>
        </div>
      )}

      <CustomerDialog
        organizationId={organizationId}
        customer={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={onSelected}
      />
      <CustomerDialog
        organizationId={organizationId}
        customer={null}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(customer) => {
          onSelected(customer);
          setSearch('');
        }}
      />
    </div>
  );
}
