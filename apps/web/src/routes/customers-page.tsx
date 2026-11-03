import { Pencil, Plus, Power, Search, UserRound } from 'lucide-react';
import { useState } from 'react';

import type { CustomerSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useCustomers, useSetCustomerActive } from '@/features/invoicing/api';
import { CustomerDialog } from '@/features/invoicing/customer-dialog';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const PAGE_SIZE = 25;

/**
 * The invoice directory: who bought, and the identification the printed invoice
 * carries. Deliberately not a CRM — no balances, no history, no merge.
 */
export function CustomersPage() {
  const { organization } = useOrganization();
  const { t, errorMessage, formatDate } = useI18n();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerSummary | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const customers = useCustomers(organizationId, {
    search: debouncedSearch,
    isActive,
    page,
    pageSize: PAGE_SIZE,
  });
  const activation = useSetCustomerActive(organizationId ?? '');

  const total = customers.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (customer: CustomerSummary) => {
    setEditing(customer);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('customers.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t('customers.description')}</p>
        </div>
        <Button disabled={!canWrite} onClick={openCreate}>
          <Plus aria-hidden="true" className="size-4" />
          {t('customers.newCustomer')}
        </Button>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          {t('customers.viewerReadOnly')}
        </p>
      )}

      {activation.error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage(activation.error, 'customers.activationFailed')}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor="customer-search" className="sr-only">
              {t('customers.searchLabel')}
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="customer-search"
              type="search"
              value={search}
              placeholder={t('customers.searchPlaceholder')}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 py-2 ps-9 pe-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="customer-active" className="sr-only">
              {t('customers.filterLabel')}
            </label>
            <select
              id="customer-active"
              value={isActive}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setIsActive(event.target.value as '' | 'true' | 'false');
                setPage(1);
              }}
            >
              <option value="">{t('customers.allCustomers')}</option>
              <option value="true">{t('customers.active')}</option>
              <option value="false">{t('customers.inactive')}</option>
            </select>
          </div>
        </div>

        {customers.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-700">
              {errorMessage(customers.error, 'customers.loadFailed')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void customers.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        ) : customers.isPending ? (
          <div
            className="divide-y divide-slate-100"
            role="status"
            aria-label={t('customers.loading')}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-4 w-1/4 rounded bg-slate-100" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <UserRound aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {search || isActive ? t('customers.emptyMatching') : t('customers.emptyNone')}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {search || isActive
                ? t('customers.emptyMatchingDescription')
                : canWrite
                  ? t('customers.emptyCreateDescription')
                  : t('customers.emptyViewerDescription')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">{t('customers.tableCaption')}</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('customers.columns.customer')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('customers.columns.contact')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.location')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.status')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('customers.columns.since')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.data.items.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{customer.name}</p>
                      {customer.taxId && (
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          {t('customers.taxId')} <span dir="ltr">{customer.taxId}</span>
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p dir="ltr">{customer.email ?? t('common.notAvailable')}</p>
                      <p dir="ltr" className="text-xs text-slate-500">
                        {customer.phone ?? ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {customer.addressLine && (
                        <p className="text-xs text-slate-500">{customer.addressLine}</p>
                      )}
                      {customer.city ?? t('common.notAvailable')}
                      {customer.countryCode ? (
                        <>
                          {', '}
                          <span dir="ltr">{customer.countryCode}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                          customer.isActive
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                            : 'bg-slate-100 text-slate-600 ring-slate-200',
                        )}
                      >
                        {customer.isActive ? t('customers.active') : t('customers.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(customer.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canWrite}
                          onClick={() => openEdit(customer)}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          {t('common.edit')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canWrite || activation.isPending}
                          onClick={() =>
                            activation.mutate({
                              customerId: customer.id,
                              isActive: !customer.isActive,
                            })
                          }
                        >
                          <Power aria-hidden="true" className="size-4" />
                          {customer.isActive
                            ? t('customers.deactivate')
                            : t('customers.reactivate')}
                        </Button>
                      </div>
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
            nounKey="common.noun.customers"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>

      {organizationId && (
        <CustomerDialog
          organizationId={organizationId}
          customer={editing}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
        />
      )}
    </div>
  );
}
