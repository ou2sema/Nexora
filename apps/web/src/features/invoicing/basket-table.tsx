import { Trash2 } from 'lucide-react';

import type { InvoiceLineAmounts } from '@mystock/domain';

import { Button } from '@/components/ui/button';
import { useStockLevels } from '@/features/stock/api';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';

import type { BasketLine, BasketLinePatch, BasketProblem, BasketProblemReason } from './basket';
import { pricePlaceholder } from './basket';

const PROBLEM_KEYS: Record<BasketProblemReason, MessageKey> = {
  quantity: 'sale.line.badQuantity',
  price: 'sale.line.badPrice',
  tax: 'sale.line.badTax',
};

function lineProblem(problems: BasketProblem[], key: string): BasketProblemReason | null {
  for (const entry of problems) {
    if (entry.key === key && entry.reason !== 'empty') return entry.reason;
  }
  return null;
}

interface BasketTableProps {
  organizationId: string;
  lines: BasketLine[];
  warehouseId: string;
  locationId: string;
  canEdit: boolean;
  totals: Record<string, InvoiceLineAmounts>;
  problems: BasketProblem[];
  onPatch: (key: string, patch: BasketLinePatch) => void;
  onRemove: (key: string) => void;
}

/** The working basket: what was scanned, at what price, taxed how, leaving which depot. */
export function BasketTable({
  organizationId,
  lines,
  warehouseId,
  locationId,
  canEdit,
  totals,
  problems,
  onPatch,
  onRemove,
}: BasketTableProps) {
  const { t, formatMoney, formatQuantity } = useI18n();

  if (lines.length === 0) {
    return (
      <p className="rounded-lg bg-slate-100 px-4 py-6 text-center text-sm text-slate-600">
        {t('sale.basket.empty')}
      </p>
    );
  }

  return (
    // contain-paint, not just overflow-x-auto: on a phone the layout viewport widens to
    // this table's min-content (the fixed-width inputs cannot shrink), which pushes every
    // fixed-position dialog off centre. The sale grid columns carry min-w-0 so that this
    // box is bounded and the table scrolls inside it.
    <div className="contain-paint overflow-x-auto">
      <table className="w-full text-start text-sm">
        <caption className="sr-only">{t('sale.basket.caption')}</caption>
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th scope="col" className="px-3 py-2 text-start font-semibold">
              {t('sale.basket.columns.item')}
            </th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">
              {t('sale.basket.columns.available')}
            </th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">
              {t('common.quantity')}
            </th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">
              {t('sale.basket.columns.unitPrice')}
            </th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">
              {t('sale.basket.columns.taxRate')}
            </th>
            <th scope="col" className="px-3 py-2 text-end font-semibold">
              {t('sale.basket.columns.total')}
            </th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">{t('sale.basket.columns.remove')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 align-top">
          {lines.map((line) => {
            const problem = lineProblem(problems, line.key);
            const amounts = totals[line.key];

            return (
              <tr key={line.key}>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-900">{line.productName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <span dir="ltr" className="font-mono">
                      {line.kind === 'device' ? line.serialNumber : line.sku}
                    </span>
                    {line.kind === 'device' && (
                      <>
                        {' · '}
                        <span dir="ltr" className="font-mono">
                          {line.sku}
                        </span>
                        {' · '}
                        {t('sale.basket.serializedUnit')}
                      </>
                    )}
                  </p>
                  {problem && (
                    <p role="alert" className="mt-1 text-xs text-rose-700">
                      {t(PROBLEM_KEYS[problem])}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {line.kind === 'product' ? (
                    <LocationAvailability
                      organizationId={organizationId}
                      warehouseId={warehouseId}
                      locationId={locationId}
                      productId={line.productId}
                      quantity={line.quantity}
                    />
                  ) : (
                    <span className="text-xs text-slate-500">{t('sale.basket.unitReserved')}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {line.kind === 'product' ? (
                    <input
                      aria-label={t('sale.basket.quantityLabel', { product: line.productName })}
                      value={line.quantity}
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      disabled={!canEdit}
                      className={cn(fieldClass, 'mt-0 w-20 font-mono')}
                      onChange={(event) => onPatch(line.key, { quantity: event.target.value })}
                    />
                  ) : (
                    <span className="font-mono text-sm text-slate-700">{formatQuantity(1)}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <input
                    aria-label={t('sale.basket.unitPriceLabel', { product: line.productName })}
                    value={line.unitPrice}
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    placeholder={pricePlaceholder(line)}
                    disabled={!canEdit}
                    className={cn(fieldClass, 'mt-0 w-28 font-mono')}
                    onChange={(event) => onPatch(line.key, { unitPrice: event.target.value })}
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    aria-label={t('sale.basket.taxRateLabel', { product: line.productName })}
                    value={line.taxRate}
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    placeholder="0"
                    disabled={!canEdit}
                    className={cn(fieldClass, 'mt-0 w-20 font-mono')}
                    onChange={(event) => onPatch(line.key, { taxRate: event.target.value })}
                  />
                </td>
                <td className="px-3 py-3 text-end">
                  {amounts ? (
                    <>
                      <p className="font-semibold text-slate-900">
                        {formatMoney(amounts.totalMinor)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatMoney(amounts.netMinor)} + {formatMoney(amounts.taxMinor)}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">{t('sale.basket.notComputed')}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('sale.basket.remove', { product: line.productName })}
                    disabled={!canEdit}
                    onClick={() => onRemove(line.key)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface LocationAvailabilityProps {
  organizationId: string;
  warehouseId: string;
  locationId: string;
  productId: string;
  quantity: string;
}

/**
 * Availability at the depot the invoice will issue from, read from the same
 * `stock_levels` view the ledger exposes. It is a warning, not a gate: the
 * reservation inside the sale transaction is what decides.
 */
function LocationAvailability({
  organizationId,
  warehouseId,
  locationId,
  productId,
  quantity,
}: LocationAvailabilityProps) {
  const { t, formatQuantity } = useI18n();

  const levels = useStockLevels(organizationId, {
    search: '',
    warehouseId,
    locationId,
    productId,
    page: 1,
    pageSize: 1,
  });

  const level = levels.data?.items[0];
  if (!warehouseId || !locationId) {
    return <span className="text-xs text-slate-400">{t('sale.basket.pickLocationFirst')}</span>;
  }
  if (levels.isPending) {
    return <span className="text-xs text-slate-400">{t('sale.basket.checking')}</span>;
  }
  if (!level) {
    return <span className="text-xs text-rose-700">{t('sale.basket.noStockLine')}</span>;
  }

  const requested = Number(quantity);
  const short = Number.isFinite(requested) && requested > level.available;

  return (
    <span
      className={cn('font-mono text-xs', short ? 'font-semibold text-rose-700' : 'text-slate-600')}
    >
      {formatQuantity(level.available)}
      {short && <span className="ms-1 font-sans">{t('sale.basket.short')}</span>}
    </span>
  );
}
