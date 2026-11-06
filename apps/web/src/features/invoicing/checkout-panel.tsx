import { ChevronDown, Loader2, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { CustomerSummary, PaymentMethod } from '@mystock/contracts';
import type { InvoiceLineAmounts, InvoiceTotals } from '@mystock/domain';

import { Button } from '@/components/ui/button';
import { fieldClass } from '@/lib/form-field';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { parseQuantity } from '@/lib/parse-amount';

import { type BasketLine, effectivePriceMinor } from './basket';
import { CustomerPicker, emptyManualCustomer, type SaleCustomer } from './customer-picker';
import { paymentMethodKeys } from './labels';

/** How much of the gross total changes hands at the counter. */
export type PaymentCoverage = 'full' | 'partial';

const METHODS = Object.keys(paymentMethodKeys) as PaymentMethod[];

/** The amount that actually travels to the RPC for a given coverage. */
export function paidAmountMinor(
  coverage: PaymentCoverage,
  totalMinor: number,
  amountMinor: number | null,
): number {
  return coverage === 'full' ? totalMinor : (amountMinor ?? 0);
}

interface DetailsProps {
  action: ReactNode;
  children: ReactNode;
}

/** A disclosure, rather than a second screen, so the counter never loses the basket. */
function Details({ action, children }: DetailsProps) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-700 marker:hidden">
        <span className="flex items-center gap-2">
          <ChevronDown
            aria-hidden="true"
            className="size-4 rotate-[-90deg] text-slate-400 transition group-open:rotate-0"
          />
          {action}
        </span>
      </summary>
      <div className="border-t border-slate-100 px-4 py-4">{children}</div>
    </details>
  );
}

interface CustomerBlockProps {
  organizationId: string;
  value: SaleCustomer;
  canWrite: boolean;
  errorKey: MessageKey | null;
  onChange: (customer: SaleCustomer) => void;
  onSelected: (customer: CustomerSummary) => void;
}

/**
 * The buyer, condensed to what the invoice prints. The desk rail has no room for
 * a directory search, so the full picker lives inside this disclosure.
 *
 * The disclosure is controlled because the missing-buyer reason has to be said once:
 * while the picker is closed, this line is the only place it can appear; while it is
 * open, the alert sits under the name field the operator is looking at.
 */
function CustomerBlock({
  organizationId,
  value,
  canWrite,
  errorKey,
  onChange,
  onSelected,
}: CustomerBlockProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const directory = value.mode === 'directory' ? value.customer : null;
  const manualName = value.mode === 'manual' ? value.name.trim() : '';
  const contact = directory ? [directory.email, directory.phone].filter(Boolean).join(' · ') : '';
  const named = directory !== null || manualName !== '';

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t('sale.customer.title')}
        </p>
        {named ? (
          <div className="mt-2 flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <UserRound aria-hidden="true" className="size-4 text-slate-500" />
                {directory?.name ?? manualName}
              </p>
              <p dir="ltr" className="mt-0.5 truncate text-xs text-slate-500">
                {contact || t('sale.customer.noContact')}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canWrite}
              className="shrink-0 text-indigo-700"
              onClick={() => {
                // Collapsing back to the picker is the only way to change the buyer:
                // the summary above is an invoice line, not an editable field.
                onChange(emptyManualCustomer);
              }}
            >
              {t('sale.customer.change')}
            </Button>
          </div>
        ) : editing ? null : (
          <p className={cn('mt-2 text-sm', errorKey ? 'text-rose-700' : 'text-slate-500')}>
            {errorKey ? t(errorKey) : t('sale.customer.walkIn')}
          </p>
        )}
      </div>

      <details
        className="group rounded-xl border border-slate-200 bg-white"
        open={editing}
        onToggle={(event) => setEditing(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-700 marker:hidden">
          <span className="flex items-center gap-2">
            <ChevronDown
              aria-hidden="true"
              className="size-4 rotate-[-90deg] text-slate-400 transition group-open:rotate-0"
            />
            {t('sale.customer.editAction')}
          </span>
        </summary>
        <div className="border-t border-slate-100 px-4 py-4">
          <CustomerPicker
            organizationId={organizationId}
            value={value}
            canWrite={canWrite}
            onChange={onChange}
            onSelected={onSelected}
            errorKey={editing ? errorKey : null}
            embedded
          />
        </div>
      </details>
    </div>
  );
}

interface BasketSummaryProps {
  lines: BasketLine[];
  lineAmounts: Record<string, InvoiceLineAmounts>;
}

/** What leaves the depot, priced the way the preview priced it. */
function BasketSummary({ lines, lineAmounts }: BasketSummaryProps) {
  const { t, formatMoney, formatQuantity } = useI18n();

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {t('sale.summary.title')}
      </h3>
      <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {lines.map((line) => {
          const amounts = lineAmounts[line.key];
          const quantity = line.kind === 'device' ? 1 : (parseQuantity(line.quantity) ?? 0);
          const unitPriceMinor = effectivePriceMinor(line);
          const taxRate = line.taxRate.trim() === '' ? '0' : line.taxRate.trim();

          return (
            <li key={line.key} className="flex items-baseline justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{line.productName}</p>
                <p dir="ltr" className="mt-0.5 text-xs text-slate-500">
                  {amounts && unitPriceMinor !== null
                    ? `${formatQuantity(quantity)} × ${formatMoney(unitPriceMinor)} · ${t(
                        'sale.summary.taxRate',
                        { rate: taxRate },
                      )}`
                    : t('sale.basket.notComputed')}
                </p>
              </div>
              <p dir="ltr" className="shrink-0 font-mono text-sm text-slate-900">
                {amounts ? formatMoney(amounts.totalMinor) : '—'}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface TotalsProps {
  totals: InvoiceTotals;
}

export function Totals({ totals }: TotalsProps) {
  const { t, formatMoney } = useI18n();

  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-slate-500">{t('sale.totals.subtotal')}</dt>
        <dd dir="ltr" className="font-mono text-slate-900">
          {formatMoney(totals.netMinor)}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-slate-500">{t('sale.totals.taxPerItem')}</dt>
        <dd dir="ltr" className="font-mono text-slate-900">
          {formatMoney(totals.taxMinor)}
        </dd>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2">
        <dt className="text-base font-semibold text-slate-900">{t('sale.totals.total')}</dt>
        <dd dir="ltr" className="font-mono text-xl font-semibold text-slate-900">
          {formatMoney(totals.totalMinor)}
        </dd>
      </div>
    </dl>
  );
}

interface PaymentProps {
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  coverage: PaymentCoverage;
  onCoverageChange: (coverage: PaymentCoverage) => void;
  amountValue: string;
  onAmountChange: (value: string) => void;
  amountError: string | null;
  totalMinor: number;
  receivedMinor: number;
  canWrite: boolean;
}

/**
 * The only money decision a counter makes: how the sale is settled, and whether
 * the buyer hands over the whole total. A tendered amount above the total is
 * change, never a larger payment — the invoice records the total, and the cash
 * drawer keeps the rest.
 */
export function Payment({
  method,
  onMethodChange,
  coverage,
  onCoverageChange,
  amountValue,
  onAmountChange,
  amountError,
  totalMinor,
  receivedMinor,
  canWrite,
}: PaymentProps) {
  const { t, formatMoney } = useI18n();
  const isCash = method === 'cash';
  const changeMinor = coverage === 'full' && isCash ? Math.max(0, receivedMinor - totalMinor) : 0;
  const remainingMinor = Math.max(
    0,
    totalMinor - (coverage === 'full' ? totalMinor : receivedMinor),
  );

  return (
    <div className="space-y-4">
      <fieldset disabled={!canWrite} className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t('sale.payment.method')}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((entry) => (
            <label
              key={entry}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm',
                method === entry
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                !canWrite && 'cursor-default opacity-60',
              )}
            >
              <input
                type="radio"
                name="sale-payment-method"
                value={entry}
                checked={method === entry}
                onChange={() => onMethodChange(entry)}
                className="size-4 accent-indigo-600"
              />
              {t(paymentMethodKeys[entry])}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(['full', 'partial'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            disabled={!canWrite}
            aria-pressed={coverage === entry}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium',
              coverage === entry
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900',
            )}
            onClick={() => onCoverageChange(entry)}
          >
            {t(entry === 'full' ? 'sale.coverage.full' : 'sale.coverage.partial')}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="sale-payment-amount" className="block text-xs font-medium text-slate-600">
          {t(coverage === 'full' ? 'sale.payment.tendered' : 'sale.payment.received')}
        </label>
        <div className="relative mt-1">
          <input
            id="sale-payment-amount"
            type="text"
            inputMode="decimal"
            dir="ltr"
            placeholder={coverage === 'full' ? '' : '0.000'}
            disabled={!canWrite}
            value={amountValue}
            aria-invalid={Boolean(amountError)}
            className={cn(fieldClass, 'mt-0 pe-12 font-mono', amountError && 'border-rose-400')}
            onChange={(event) => onAmountChange(event.target.value)}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
          >
            TND
          </span>
        </div>
        {amountError && (
          <p role="alert" className="mt-1 text-xs text-rose-700">
            {amountError}
          </p>
        )}
      </div>

      {coverage === 'full' && isCash && changeMinor > 0 && (
        <p className="flex items-baseline justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-medium">{t('sale.payment.changeToReturn')}</span>
          <span dir="ltr" className="font-mono font-semibold">
            {formatMoney(changeMinor)}
          </span>
        </p>
      )}

      {/* Paying in full leaves nothing to say about the balance that the total line
          below does not say better, so these two rows only appear once the counter
          takes less than the invoice is worth. */}
      {coverage === 'partial' && (
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{t('sale.payment.recorded')}</dt>
            <dd dir="ltr" className="font-mono text-slate-900">
              {formatMoney(Math.min(receivedMinor, totalMinor))}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{t('sale.payment.remaining')}</dt>
            <dd dir="ltr" className="font-mono text-slate-900">
              {formatMoney(remainingMinor)}
            </dd>
          </div>
        </dl>
      )}

      {/* Cash handed over above the total is change, and the row above says it in
          numbers, so the hint only has to say what the invoice becomes. */}
      <p className="text-xs text-slate-500">
        {t(coverage === 'full' ? 'sale.payment.hintFull' : 'sale.payment.hintPartial')}
      </p>
    </div>
  );
}

interface SaleDetailsProps {
  taxRateValue: string;
  onTaxRateChange: (value: string) => void;
  referenceValue: string;
  onReferenceChange: (value: string) => void;
  notesValue: string;
  onNotesChange: (value: string) => void;
  canWrite: boolean;
}

/** The three fields a counter rarely touches, kept out of the working flow. */
export function SaleDetails({
  taxRateValue,
  onTaxRateChange,
  referenceValue,
  onReferenceChange,
  notesValue,
  onNotesChange,
  canWrite,
}: SaleDetailsProps) {
  const { t } = useI18n();

  return (
    <Details
      action={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span>{t('sale.details.title')}</span>
          <span className="text-xs font-normal text-slate-500">{t('sale.details.hint')}</span>
        </span>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="sale-default-tax" className="block text-xs font-medium text-slate-600">
            {t('sale.defaultTax.label')}
          </label>
          <input
            id="sale-default-tax"
            type="text"
            inputMode="decimal"
            dir="ltr"
            placeholder="0"
            disabled={!canWrite}
            value={taxRateValue}
            className={cn(fieldClass, 'mt-1 w-24 font-mono')}
            onChange={(event) => onTaxRateChange(event.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">{t('sale.defaultTax.hint')}</p>
        </div>

        <div>
          <label htmlFor="sale-reference" className="block text-xs font-medium text-slate-600">
            {t('sale.checkout.reference')}
          </label>
          <input
            id="sale-reference"
            type="text"
            dir="ltr"
            disabled={!canWrite}
            value={referenceValue}
            className={cn(fieldClass, 'mt-1')}
            onChange={(event) => onReferenceChange(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="sale-notes" className="block text-xs font-medium text-slate-600">
            {t('sale.checkout.notes')}
          </label>
          <textarea
            id="sale-notes"
            rows={2}
            disabled={!canWrite}
            value={notesValue}
            className={cn(fieldClass, 'mt-1')}
            onChange={(event) => onNotesChange(event.target.value)}
          />
        </div>
      </div>
    </Details>
  );
}

interface ConfirmActionProps {
  canSubmit: boolean;
  pending: boolean;
  hint: string | null;
}

/**
 * The single action that writes to the ledger. The amount it books is not repeated
 * here: the total line directly above is the one place the screen states it.
 */
export function ConfirmAction({ canSubmit, pending, hint }: ConfirmActionProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      <Button type="submit" className="w-full text-base" disabled={!canSubmit || pending}>
        {pending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <span aria-hidden="true">✓</span>
        )}
        <span>{t('sale.post.action')}</span>
      </Button>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

interface CheckoutPanelProps {
  organizationId: string;
  canWrite: boolean;
  customer: SaleCustomer;
  customerError: MessageKey | null;
  onCustomerChange: (customer: SaleCustomer) => void;
  onCustomerSelected: (customer: CustomerSummary) => void;
  lines: BasketLine[];
  lineAmounts: Record<string, InvoiceLineAmounts>;
  totals: InvoiceTotals;
  /** `Tunis · Main store`, or null while the counter has not settled the shelf. */
  locationName: string | null;
  /** The phone review step lists the lines; the desk rail already shows them above. */
  showLines: boolean;
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  coverage: PaymentCoverage;
  onCoverageChange: (coverage: PaymentCoverage) => void;
  amountValue: string;
  /** What the typed amount reads as in millimes, or `null` when it is not a number. */
  amountMinor: number | null;
  onAmountChange: (value: string) => void;
  amountError: string | null;
  taxRateValue: string;
  onTaxRateChange: (value: string) => void;
  referenceValue: string;
  onReferenceChange: (value: string) => void;
  notesValue: string;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  canSubmit: boolean;
  hint: string | null;
  error: string | null;
}

/**
 * Everything that turns a basket into an invoice: the buyer, what it costs, how
 * it is settled, and the one action that posts it. The desk renders it as a rail
 * beside the basket and the phone renders it as the second step of the wizard,
 * which is why the line summary here is optional.
 */
export function CheckoutPanel({
  organizationId,
  canWrite,
  customer,
  customerError,
  onCustomerChange,
  onCustomerSelected,
  lines,
  lineAmounts,
  totals,
  locationName,
  showLines,
  method,
  onMethodChange,
  coverage,
  onCoverageChange,
  amountValue,
  amountMinor,
  onAmountChange,
  amountError,
  taxRateValue,
  onTaxRateChange,
  referenceValue,
  onReferenceChange,
  notesValue,
  onNotesChange,
  onSubmit,
  pending,
  canSubmit,
  hint,
  error,
}: CheckoutPanelProps) {
  const { t } = useI18n();

  return (
    <form
      noValidate
      className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
      onSubmit={(event) => {
        // The confirm button is a submit so Enter in any field posts the sale,
        // which makes the browser's own submission the one thing that must not
        // happen: it would reload the counter and lose the basket.
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{t('sale.checkout.title')}</h2>
        {/* The count belongs to the basket card and the total to the lines below, so
            this header carries only the shelf the scan settled on. */}
        {locationName !== null && (
          <p className="truncate text-xs text-slate-500">
            {t('sale.location.leavesFrom', { location: locationName })}
          </p>
        )}
      </div>

      <CustomerBlock
        organizationId={organizationId}
        value={customer}
        canWrite={canWrite}
        errorKey={customerError}
        onChange={onCustomerChange}
        onSelected={onCustomerSelected}
      />

      {showLines && lines.length > 0 && <BasketSummary lines={lines} lineAmounts={lineAmounts} />}

      <div className="rounded-xl bg-white p-4">
        <Payment
          method={method}
          onMethodChange={onMethodChange}
          coverage={coverage}
          onCoverageChange={onCoverageChange}
          amountValue={amountValue}
          onAmountChange={onAmountChange}
          amountError={amountError}
          totalMinor={totals.totalMinor}
          receivedMinor={amountMinor ?? 0}
          canWrite={canWrite}
        />
      </div>

      <SaleDetails
        taxRateValue={taxRateValue}
        onTaxRateChange={onTaxRateChange}
        referenceValue={referenceValue}
        onReferenceChange={onReferenceChange}
        notesValue={notesValue}
        onNotesChange={onNotesChange}
        canWrite={canWrite}
      />

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <Totals totals={totals} />

      <ConfirmAction canSubmit={canSubmit} pending={pending} hint={hint} />
    </form>
  );
}
