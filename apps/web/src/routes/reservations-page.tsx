import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';

import type { ReservationStatus } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useReleaseReservation, useStockReservations } from '@/features/stock/api';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 25;

const statusStyles: Record<ReservationStatus, string> = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  released: 'bg-slate-100 text-slate-700 ring-slate-200',
  fulfilled: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  expired: 'bg-amber-50 text-amber-800 ring-amber-200',
};

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-TN', { maximumFractionDigits: 4 }).format(value);
}

export function ReservationsPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const [status, setStatus] = useState<ReservationStatus | ''>('');
  const [page, setPage] = useState(1);

  const reservations = useStockReservations(organizationId, {
    status,
    page,
    pageSize: PAGE_SIZE,
  });
  const release = useReleaseReservation(organizationId ?? '');

  const total = reservations.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const releaseError = release.error instanceof Error ? release.error.message : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reservations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Held quantities reduce availability without touching physical on-hand stock.
          </p>
        </div>
        <div>
          <label htmlFor="reservation-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="reservation-status-filter"
            value={status}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
            onChange={(event) => {
              setStatus(event.target.value as ReservationStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="released">Released</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </header>

      {releaseError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {releaseError}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        {reservations.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-700">
              {reservations.error instanceof Error
                ? reservations.error.message
                : 'Reservations failed to load.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void reservations.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : reservations.isPending ? (
          <div
            className="divide-y divide-slate-100"
            role="status"
            aria-label="Loading reservations"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <LockKeyhole aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {status ? 'No reservations with this status' : 'No reservations yet'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Reservations are created from the stock levels page and can be released or fulfilled
              later.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Stock reservations</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Location
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Quantity
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Expires
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Created
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.data.items.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{reservation.productName}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {reservation.productSku}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-mono text-xs">
                        {reservation.warehouseCode} / {reservation.locationCode}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {formatQuantity(reservation.quantity)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1',
                          statusStyles[reservation.status],
                        )}
                      >
                        {reservation.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {reservation.expiresAt
                        ? dateTime.format(new Date(reservation.expiresAt))
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {dateTime.format(new Date(reservation.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {reservation.status === 'active' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canWrite || release.isPending}
                          onClick={() => release.mutate(reservation.id)}
                        >
                          Release
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
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
            noun="reservation"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>
    </div>
  );
}
