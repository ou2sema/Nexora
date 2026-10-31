import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import type { StockMovementType } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useWarehouses } from '@/features/catalog/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useStockMovements } from '@/features/stock/api';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 25;

const movementLabelKeys: Record<StockMovementType, MessageKey> = {
  receipt: 'movements.type.receipt',
  issue: 'movements.type.issue',
  adjustment: 'movements.type.adjustment',
  transfer_out: 'movements.type.transferOut',
  transfer_in: 'movements.type.transferIn',
};

const movementStyles: Record<StockMovementType, string> = {
  receipt: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  issue: 'bg-rose-50 text-rose-800 ring-rose-200',
  adjustment: 'bg-amber-50 text-amber-800 ring-amber-200',
  transfer_out: 'bg-sky-50 text-sky-800 ring-sky-200',
  transfer_in: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
};

export function StockMovementsPage() {
  const { t, formatQuantity, formatDateTime, errorMessage } = useI18n();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const [movementType, setMovementType] = useState<StockMovementType | ''>('');
  const [warehouseId, setWarehouseId] = useState('');
  const [page, setPage] = useState(1);

  const warehouses = useWarehouses(organizationId);
  const movements = useStockMovements(organizationId, {
    movementType,
    warehouseId,
    page,
    pageSize: PAGE_SIZE,
  });

  const total = movements.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('movements.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t('movements.description')}</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div>
            <label htmlFor="movement-type-filter" className="sr-only">
              {t('movements.typeFilterLabel')}
            </label>
            <select
              id="movement-type-filter"
              value={movementType}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setMovementType(event.target.value as StockMovementType | '');
                setPage(1);
              }}
            >
              <option value="">{t('movements.allTypes')}</option>
              {(Object.keys(movementLabelKeys) as StockMovementType[]).map((type) => (
                <option key={type} value={type}>
                  {t(movementLabelKeys[type])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="movement-warehouse-filter" className="sr-only">
              {t('movements.warehouseFilterLabel')}
            </label>
            <select
              id="movement-warehouse-filter"
              value={warehouseId}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setWarehouseId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('movements.allWarehouses')}</option>
              {(warehouses.data ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {movements.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-700">
              {movements.error
                ? errorMessage(movements.error, 'movements.loadError')
                : t('movements.loadError')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void movements.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        ) : movements.isPending ? (
          <div
            className="divide-y divide-slate-100"
            role="status"
            aria-label={t('movements.loading')}
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/4 rounded bg-slate-200" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <ScrollText aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {t('movements.emptyTitle')}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">{t('movements.emptyBody')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">{t('movements.tableCaption')}</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('movements.columns.when')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.product')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('movements.columns.type')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.location')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    {t('movements.columns.change')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    {t('movements.columns.onHandAfter')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.reason')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.data.items.map((movement) => (
                  <tr key={movement.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDateTime(movement.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{movement.productName}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        <span dir="ltr">{movement.productSku}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                          movementStyles[movement.movementType],
                        )}
                      >
                        {t(movementLabelKeys[movement.movementType])}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-mono text-xs">
                        <span dir="ltr">
                          {movement.warehouseCode} / {movement.locationCode}
                        </span>
                      </p>
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-end font-medium tabular-nums',
                        movement.quantityDelta > 0 ? 'text-emerald-700' : 'text-rose-700',
                      )}
                    >
                      <span dir="ltr">
                        {movement.quantityDelta > 0 ? '+' : ''}
                        {formatQuantity(movement.quantityDelta)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-slate-700">
                      {formatQuantity(movement.onHandAfter)}
                    </td>
                    <td className="max-w-[16rem] px-4 py-3 text-slate-600">
                      {movement.reason ?? t('common.notAvailable')}
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
            nounKey="common.noun.movements"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>
    </div>
  );
}
