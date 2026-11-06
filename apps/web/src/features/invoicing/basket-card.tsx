import { CheckCircle2, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { InvoiceLineAmounts } from '@mystock/domain';

import { Button } from '@/components/ui/button';
import { useStockLevels } from '@/features/stock/api';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';
import { parseQuantity } from '@/lib/parse-amount';

import type { BasketLine, BasketLinePatch, BasketProblem, BasketProblemReason } from './basket';
import { effectivePriceMinor, pricePlaceholder } from './basket';

const PROBLEM_KEYS: Record<BasketProblemReason, MessageKey> = {
  quantity: 'sale.line.badQuantity',
  price: 'sale.line.badPrice',
  tax: 'sale.line.badTax',
};

/** The rates a Tunisian depot actually charges; anything else is typed in the line. */
const TAX_PRESETS = ['0', '7', '19'];

function lineProblem(problems: BasketProblem[], key: string): BasketProblemReason | null {
  for (const entry of problems) {
    if (entry.key === key && entry.reason !== 'empty') return entry.reason;
  }
  return null;
}

interface BasketCardProps {
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

interface LineControlsProps {
  line: BasketLine;
  problem: BasketProblemReason | null;
  amounts: InvoiceLineAmounts | undefined;
  canEdit: boolean;
  onPatch: (key: string, patch: BasketLinePatch) => void;
}

function LineTaxSelect({ line, canEdit, onPatch }: LineControlsProps) {
  const { t } = useI18n();
  const options = TAX_PRESETS.includes(line.taxRate) ? TAX_PRESETS : [line.taxRate, ...TAX_PRESETS];

  return (
    <select
      aria-label={t('sale.basket.taxRateLabel', { product: line.productName })}
      value={line.taxRate}
      disabled={!canEdit}
      dir="ltr"
      className={cn(
        'h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-indigo-700',
        !canEdit && 'bg-slate-50 text-slate-400',
      )}
      onChange={(event) => onPatch(line.key, { taxRate: event.target.value })}
    >
      {options.map((rate) => (
        <option key={rate} value={rate}>
          {t('sale.basket.taxOption', { rate })}
        </option>
      ))}
    </select>
  );
}

/**
 * The catalogue price is what the line shows; the operator only sees a field when
 * they mean to change it, which is why the price is a link rather than an input.
 */
function LinePrice({ line, canEdit, onPatch }: LineControlsProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const priceMinor = effectivePriceMinor(line);

  if (!editing) {
    return (
      <button
        type="button"
        disabled={!canEdit}
        className="text-xs font-medium text-indigo-700 hover:underline disabled:text-slate-400 disabled:no-underline"
        onClick={() => setEditing(true)}
      >
        {t(priceMinor === null ? 'sale.basket.priceMissing' : 'sale.basket.adjustPrice')}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        autoFocus
        aria-label={t('sale.basket.unitPriceLabel', { product: line.productName })}
        value={line.unitPrice}
        type="text"
        inputMode="decimal"
        dir="ltr"
        placeholder={pricePlaceholder(line)}
        disabled={!canEdit}
        className={cn(fieldClass, 'h-7 w-24 rounded-lg px-2 py-0 text-xs font-mono')}
        onChange={(event) => onPatch(line.key, { unitPrice: event.target.value })}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') setEditing(false);
        }}
      />
    </span>
  );
}

function LineQuantity({ line, canEdit, onPatch }: LineControlsProps) {
  const { t, formatQuantity } = useI18n();

  if (line.kind === 'device') {
    return <span className="font-mono text-sm text-slate-700">{formatQuantity(1)}</span>;
  }

  const current = parseQuantity(line.quantity) ?? 0;

  const step = (delta: number) => {
    const next = Math.max(0, Math.round((current + delta) * 10_000) / 10_000);
    onPatch(line.key, { quantity: String(next) });
  };

  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
      <button
        type="button"
        aria-label={t('sale.basket.decrease', { product: line.productName })}
        disabled={!canEdit || current <= 1}
        className="rounded-md p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        onClick={() => step(-1)}
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <input
        aria-label={t('sale.basket.quantityLabel', { product: line.productName })}
        value={line.quantity}
        type="text"
        inputMode="decimal"
        dir="ltr"
        disabled={!canEdit}
        className="w-10 border-0 bg-transparent p-0 text-center font-mono text-sm text-slate-900 focus:outline-none"
        onChange={(event) => onPatch(line.key, { quantity: event.target.value })}
      />
      <button
        type="button"
        aria-label={t('sale.basket.increase', { product: line.productName })}
        disabled={!canEdit}
        className="rounded-md p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        onClick={() => step(1)}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </span>
  );
}

function LineIdentity({ line }: { line: BasketLine }) {
  const { t } = useI18n();

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-900">{line.productName}</p>
      {line.kind === 'device' ? (
        <p dir="ltr" className="mt-0.5 font-mono text-xs text-slate-500">
          IMEI {line.serialNumber}
        </p>
      ) : (
        <p dir="ltr" className="mt-0.5 font-mono text-xs text-slate-500">
          {line.sku}
        </p>
      )}
      {line.kind === 'device' && (
        <p className="mt-0.5 text-xs text-slate-500">{t('sale.basket.serializedUnit')}</p>
      )}
    </div>
  );
}

interface LineAvailabilityProps {
  organizationId: string;
  line: BasketLine;
  warehouseId: string;
  locationId: string;
}

/**
 * Availability at the shelf the invoice will issue from, read from the same
 * `stock_levels` view the ledger exposes. It is a warning, not a gate: the
 * reservation inside the sale transaction is what decides. The shelf itself is
 * named once, above, so the line only ever speaks of "this shelf".
 */
function LineAvailability({
  organizationId,
  line,
  warehouseId,
  locationId,
}: LineAvailabilityProps) {
  const { t, formatQuantity } = useI18n();

  const levels = useStockLevels(organizationId, {
    search: '',
    warehouseId,
    locationId,
    productId: line.productId,
    page: 1,
    pageSize: 1,
  });

  if (line.kind === 'device') {
    return (
      <p className="flex items-center justify-end gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 aria-hidden="true" className="size-3.5" />
        {t('sale.basket.deviceVerified')}
      </p>
    );
  }

  if (!warehouseId || !locationId) {
    return <p className="text-xs text-slate-400">{t('sale.basket.pickLocationFirst')}</p>;
  }
  if (levels.isPending) {
    return <p className="text-xs text-slate-400">{t('sale.basket.checking')}</p>;
  }

  const level = levels.data?.items[0];
  if (!level) {
    return <p className="text-xs text-rose-700">{t('sale.basket.noStockLine')}</p>;
  }

  const requested = parseQuantity(line.quantity) ?? 0;
  const short = requested > level.available;

  return (
    <p
      className={cn(
        'flex items-center justify-end gap-1.5 text-xs',
        short ? 'font-semibold text-rose-700' : 'text-emerald-700',
      )}
    >
      <CheckCircle2 aria-hidden="true" className="size-3.5" />
      {t('sale.basket.ofAvailable', {
        requested: formatQuantity(requested),
        available: formatQuantity(level.available),
      })}
    </p>
  );
}

interface BasketRowProps extends LineControlsProps {
  organizationId: string;
  warehouseId: string;
  locationId: string;
  onRemove: (key: string) => void;
}

function BasketRow({
  line,
  problem,
  amounts,
  canEdit,
  onPatch,
  onRemove,
  organizationId,
  warehouseId,
  locationId,
}: BasketRowProps) {
  const { t, formatMoney } = useI18n();
  const linePriceMinor = effectivePriceMinor(line);

  return (
    <div className="grid gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0">
          <LineIdentity line={line} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LineTaxSelect
              line={line}
              problem={problem}
              amounts={amounts}
              canEdit={canEdit}
              onPatch={onPatch}
            />
            <LinePrice
              line={line}
              problem={problem}
              amounts={amounts}
              canEdit={canEdit}
              onPatch={onPatch}
            />
          </div>
          {problem && (
            <p role="alert" className="mt-1 text-xs text-rose-700">
              {t(PROBLEM_KEYS[problem])}
            </p>
          )}
        </div>
      </div>

      <div className="sm:w-32">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400 sm:hidden">
          {t('sale.basket.columns.quantity')}
        </p>
        <LineQuantity
          line={line}
          problem={problem}
          amounts={amounts}
          canEdit={canEdit}
          onPatch={onPatch}
        />
      </div>

      <div className="sm:w-28 sm:text-end">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400 sm:hidden">
          {t('sale.basket.columns.unitPrice')}
        </p>
        <p className="font-mono text-sm text-slate-900">
          {linePriceMinor === null ? t('sale.basket.priceMissing') : formatMoney(linePriceMinor)}
        </p>
      </div>

      <div className="flex items-start justify-between gap-2 sm:w-32 sm:flex-col sm:items-end">
        <div className="sm:text-end">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400 sm:hidden">
            {t('sale.basket.columns.total')}
          </p>
          {amounts ? (
            <p className="font-mono text-sm font-semibold text-slate-900">
              {formatMoney(amounts.totalMinor)}
            </p>
          ) : (
            <p className="text-xs text-slate-400">{t('sale.basket.notComputed')}</p>
          )}
          <LineAvailability
            organizationId={organizationId}
            line={line}
            warehouseId={warehouseId}
            locationId={locationId}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('sale.basket.remove', { product: line.productName })}
          disabled={!canEdit}
          className="text-slate-400 hover:text-rose-700"
          onClick={() => onRemove(line.key)}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * The working basket: what was scanned, at what price, taxed how, leaving which
 * depot. One row per line, laid out as a table on a desk and as stacked cards on
 * a phone, but the same controls either way.
 */
export function BasketCard({
  organizationId,
  lines,
  warehouseId,
  locationId,
  canEdit,
  totals,
  problems,
  onPatch,
  onRemove,
}: BasketCardProps) {
  const { t, plural } = useI18n();

  const units = lines.reduce((sum, line) => {
    const quantity = line.kind === 'device' ? 1 : (parseQuantity(line.quantity) ?? 0);
    return sum + quantity;
  }, 0);

  return (
    <section
      aria-labelledby="sale-basket-heading"
      className="rounded-2xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <h2 id="sale-basket-heading" className="text-lg font-semibold text-slate-900">
            {t('sale.basket.title')}
          </h2>
          <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {t('sale.basket.count', {
              lines: plural('common.noun.lines', lines.length),
              units: plural('common.noun.units', Math.round(units * 10_000) / 10_000),
            })}
          </p>
        </div>
        <p className="text-xs text-slate-500">{t('sale.basket.pricesExcludeTax')}</p>
      </div>

      {lines.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">{t('sale.basket.empty')}</p>
      ) : (
        <div>
          {lines.map((line) => (
            <BasketRow
              key={line.key}
              line={line}
              problem={lineProblem(problems, line.key)}
              amounts={totals[line.key]}
              canEdit={canEdit}
              onPatch={onPatch}
              onRemove={onRemove}
              organizationId={organizationId}
              warehouseId={warehouseId}
              locationId={locationId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
