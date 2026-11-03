import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type {
  DeviceSummary,
  PaymentMethod,
  ProductSummary,
  SalesInvoiceCreateResult,
  WarehouseSummary,
} from '@mystock/contracts';
import { paymentMethodSchema } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { WarehouseLocationFields } from '@/components/ui/warehouse-location-fields';
import { useAccessToken } from '@/features/auth/auth-provider';
import { useProducts } from '@/features/catalog/api';
import { scanCode } from '@/features/scanning/api';
import type { ScanCapture } from '@/features/scanning/scan-wedge';
import type { MessageKey, MessageValues } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { parseAmountToMinor } from '@/lib/parse-amount';

import { usePostSale, useRetrySafeIdempotencyKey } from './api';
import { BasketTable } from './basket-table';
import {
  addDevice,
  addProduct,
  type BasketLine,
  type BasketOrigin,
  previewBasket,
  removeLine,
  toInvoiceLines,
  updateLine,
} from './basket';
import { CustomerPicker, emptyManualCustomer, type SaleCustomer } from './customer-picker';
import { DevicePickerDialog } from './device-picker-dialog';
import { InvoicePdfButtons } from './invoice-pdf-buttons';
import { paymentMethodKeys, paymentStatusKeys } from './labels';
import { ProductSearch } from './product-search';
import { ScanBox } from './scan-box';

type Translator = (key: MessageKey, values?: MessageValues) => string;

function buildSaleSchema(t: Translator) {
  return z.object({
    warehouseId: z.string().min(1, t('common.selectWarehouse')),
    locationId: z.string().min(1, t('common.selectLocation')),
    paymentAmount: z
      .string()
      .trim()
      .refine((value) => value === '' || parseAmountToMinor(value) !== null, {
        message: t('sale.payment.invalid'),
      }),
    paymentMethod: paymentMethodSchema,
    reference: z.string().trim().max(120),
    notes: z.string().trim().max(2000),
  });
}

type SaleValues = z.infer<ReturnType<typeof buildSaleSchema>>;

const emptySale: SaleValues = {
  warehouseId: '',
  locationId: '',
  paymentAmount: '',
  paymentMethod: 'cash',
  reference: '',
  notes: '',
};

interface CounterSaleProps {
  organizationId: string;
  warehouses: WarehouseSummary[];
  canWrite: boolean;
  onOpenInvoice: (invoiceId: string) => void;
}

/**
 * The depot counter. Everything the operator enters is an identifier or an
 * intention — a code, a device, a customer, a quantity, a price override, a tax
 * rate. The invoice number, the amounts, the availability and the stock movement
 * itself belong to `app.create_sales_invoice`, which posts them in one
 * transaction and is the only place stock actually leaves the ledger.
 */
export function CounterSale({
  organizationId,
  warehouses,
  canWrite,
  onOpenInvoice,
}: CounterSaleProps) {
  const { t, plural, errorMessage, formatMoney } = useI18n();
  const token = useAccessToken();
  const sale = usePostSale(organizationId);
  const { key: idempotencyKey, rotate } = useRetrySafeIdempotencyKey();
  const saleSchema = useMemo(() => buildSaleSchema(t), [t]);

  const products = useProducts(organizationId, {
    search: '',
    status: 'active',
    page: 1,
    pageSize: 100,
  });

  const [lines, setLines] = useState<BasketLine[]>([]);
  const [customer, setCustomer] = useState<SaleCustomer>(emptyManualCustomer);
  const [defaultTaxRate, setDefaultTaxRate] = useState('');
  const [pickerProduct, setPickerProduct] = useState<ProductSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<MessageKey | null>(null);
  const [posted, setPosted] = useState<SalesInvoiceCreateResult | null>(null);

  // Scans are resolved one at a time: a second code arriving mid-resolution would
  // otherwise read a basket that has not been updated yet.
  const resolving = useRef(false);

  const preview = useMemo(() => previewBasket(lines), [lines]);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    watch,
    formState: { errors },
  } = useForm<SaleValues>({ resolver: zodResolver(saleSchema), defaultValues: emptySale });

  const warehouseId = watch('warehouseId');
  const locationId = watch('locationId');

  useEffect(() => {
    setPosted(null);
  }, [organizationId]);

  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId);
  const selectedLocation = selectedWarehouse?.locations.find(
    (location) => location.id === locationId,
  );
  const locationLabel = selectedWarehouse
    ? `${selectedWarehouse.code} / ${selectedLocation?.code ?? ''}`
    : t('sale.noDepotSelected');

  const postError = sale.error ? errorMessage(sale.error, 'sale.post.failed') : null;

  const appendDevice = (device: DeviceSummary, origin: BasketOrigin): void => {
    const values = getValues();

    if (device.status !== 'in_stock') {
      setScanError(t('sale.device.notInStock', { serial: device.serialNumber }));
      return;
    }
    if (device.warehouseId !== values.warehouseId || device.locationId !== values.locationId) {
      setScanError(
        t('sale.device.wrongLocation', {
          serial: device.serialNumber,
          location: `${device.warehouseCode} / ${device.locationCode}`,
        }),
      );
      return;
    }
    if (lines.some((line) => line.kind === 'device' && line.deviceId === device.id)) {
      setNotice(t('sale.device.alreadyInBasket', { serial: device.serialNumber }));
      return;
    }

    setLines((current) =>
      addDevice(
        current,
        device,
        products.data?.items.find((product) => product.id === device.productId),
        { taxRate: defaultTaxRate, origin },
      ),
    );
    setNotice(t('sale.device.added', { serial: device.serialNumber }));
  };

  const handleCapture = async (capture: ScanCapture): Promise<void> => {
    if (!canWrite || resolving.current) {
      setNotice(t('sale.scan.waiting'));
      return;
    }

    resolving.current = true;
    setScanError(null);
    setNotice(null);
    setBusy(true);
    try {
      const scanned = await scanCode(organizationId, token, capture.rawValue);

      if (scanned.kind === 'device') {
        appendDevice(scanned.device, capture.source);
        return;
      }

      const product = scanned.product;
      if (product.isSerialized) {
        // A serialized model leaves as a unit, never as a quantity line.
        setPickerProduct(product);
        setNotice(t('sale.scan.pickDevice', { product: product.name }));
        return;
      }

      setLines((current) =>
        addProduct(current, product, { taxRate: defaultTaxRate, origin: capture.source }),
      );
      setNotice(t('sale.scan.productAdded', { product: product.name }));
    } catch (error) {
      setScanError(errorMessage(error, 'sale.scan.unknownCode'));
    } finally {
      resolving.current = false;
      setBusy(false);
    }
  };

  const addFromSearch = (product: ProductSummary) => {
    setScanError(null);
    setLines((current) =>
      addProduct(current, product, { taxRate: defaultTaxRate, origin: 'search' }),
    );
    setNotice(t('sale.scan.productAdded', { product: product.name }));
  };

  const post = handleSubmit(async (values) => {
    setScanError(null);
    setNotice(null);

    if (customer.mode === 'manual' && customer.name.trim() === '') {
      setCustomerError('sale.customer.nameRequired');
      return;
    }
    setCustomerError(null);

    const paidAmountMinor = parseAmountToMinor(values.paymentAmount) ?? 0;
    if (paidAmountMinor > preview.totals.totalMinor) {
      setScanError(t('sale.payment.exceedsTotal'));
      return;
    }

    try {
      const result = await sale.mutateAsync({
        input: {
          warehouseId: values.warehouseId,
          locationId: values.locationId,
          ...(customer.mode === 'directory'
            ? { customerId: customer.customer.id }
            : {
                customerName: customer.name.trim() || null,
                customerEmail: customer.email.trim() || null,
                customerPhone: customer.phone.trim() || null,
              }),
          lines: toInvoiceLines(lines),
          paidAmountMinor,
          paymentMethod: values.paymentMethod,
          reference: values.reference.trim() || null,
          notes: values.notes.trim() || null,
        },
        idempotencyKey,
      });

      // The sale is on the ledger, so this key is spent. The depot stays chosen:
      // the next sale leaves from the same shelf.
      rotate();
      setPosted(result);
      setLines([]);
      setCustomer(emptyManualCustomer);
      reset({ ...emptySale, warehouseId: values.warehouseId, locationId: values.locationId });
    } catch {
      // sale.error renders below the totals.
    }
  });

  if (posted) {
    return (
      <PostedSale
        organizationId={organizationId}
        result={posted}
        onDismiss={() => {
          setPosted(null);
          setNotice(null);
          setScanError(null);
        }}
        onOpenInvoice={onOpenInvoice}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <section
          aria-labelledby="sale-counter-heading"
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <h2 id="sale-counter-heading" className="text-sm font-semibold text-slate-900">
            {t('sale.scan.title')}
          </h2>

          <div className="mt-3">
            <ScanBox
              active={canWrite}
              busy={busy || sale.isPending}
              disabled={!canWrite}
              onCapture={(capture) => void handleCapture(capture)}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr] sm:items-end">
            <div>
              <label
                htmlFor="sale-default-tax"
                className="block text-xs font-medium text-slate-600"
              >
                {t('sale.defaultTax.label')}
              </label>
              <input
                id="sale-default-tax"
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={defaultTaxRate}
                placeholder="0"
                disabled={!canWrite}
                className={`${fieldClass} mt-0 font-mono`}
                onChange={(event) => setDefaultTaxRate(event.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500">{t('sale.defaultTax.hint')}</p>
          </div>

          {busy && (
            <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {t('sale.scan.resolving')}
            </p>
          )}
          {notice && !busy && (
            <p role="status" className="mt-3 text-sm text-emerald-700">
              {notice}
            </p>
          )}
          {scanError && (
            <p role="alert" className="mt-3 text-sm text-rose-700">
              {scanError}
            </p>
          )}
        </section>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ReceiptText aria-hidden="true" className="size-4 text-slate-500" />
              {t('sale.basket.title')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('sale.basket.count', {
                lines: plural('common.noun.lines', lines.length),
                quantity: plural('common.noun.units', preview.totalQuantity),
              })}
            </p>
          </div>

          <BasketTable
            organizationId={organizationId}
            lines={lines}
            warehouseId={warehouseId}
            locationId={locationId}
            canEdit={canWrite}
            totals={preview.lineAmounts}
            problems={preview.problems}
            onPatch={(key, patch) => {
              setScanError(null);
              setLines((current) => updateLine(current, key, patch));
            }}
            onRemove={(key) => setLines((current) => removeLine(current, key))}
          />
        </div>

        <ProductSearch
          organizationId={organizationId}
          disabled={!canWrite || busy}
          onAddProduct={addFromSearch}
          onPickDevice={(product) => {
            setScanError(null);
            setPickerProduct(product);
          }}
        />
      </div>

      <div className="min-w-0 space-y-4">
        <CustomerPicker
          organizationId={organizationId}
          value={customer}
          canWrite={canWrite}
          onChange={(next) => {
            setCustomerError(null);
            setCustomer(next);
          }}
          onSelected={(selected) => setCustomer({ mode: 'directory', customer: selected })}
          errorKey={customerError}
        />

        <form
          noValidate
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"
          onSubmit={post}
        >
          <h2 className="text-sm font-semibold text-slate-900">{t('sale.checkout.title')}</h2>

          <WarehouseLocationFields
            idPrefix="sale"
            warehouses={warehouses}
            warehouseField={register('warehouseId')}
            locationField={register('locationId')}
            selectedWarehouseId={warehouseId}
            warehouseLabel={t('sale.checkout.depot')}
            locationLabel={t('sale.checkout.issueFrom')}
          />
          {(errors.warehouseId || errors.locationId) && (
            <p role="alert" className="text-xs text-rose-700">
              {errors.warehouseId?.message ?? errors.locationId?.message}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">{t('sale.totals.net')}</dt>
            <dd className="text-end font-mono text-slate-900">
              {formatMoney(preview.totals.netMinor)}
            </dd>
            <dt className="text-slate-500">{t('sale.totals.tax')}</dt>
            <dd className="text-end font-mono text-slate-900">
              {formatMoney(preview.totals.taxMinor)}
            </dd>
            <dt className="font-semibold text-slate-700">{t('sale.totals.total')}</dt>
            <dd className="text-end font-mono font-semibold text-slate-900">
              {formatMoney(preview.totals.totalMinor)}
            </dd>
          </dl>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sale-payment-amount"
                className="block text-xs font-medium text-slate-600"
              >
                {t('sale.payment.amount')}
              </label>
              <input
                id="sale-payment-amount"
                type="text"
                inputMode="decimal"
                dir="ltr"
                placeholder="0.000"
                className={`${fieldClass} mt-0 font-mono`}
                aria-invalid={Boolean(errors.paymentAmount)}
                {...register('paymentAmount')}
              />
              {errors.paymentAmount && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.paymentAmount.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="sale-payment-method"
                className="block text-xs font-medium text-slate-600"
              >
                {t('sale.payment.method')}
              </label>
              <select
                id="sale-payment-method"
                className={fieldClass}
                {...register('paymentMethod')}
              >
                {(Object.keys(paymentMethodKeys) as PaymentMethod[]).map((method) => (
                  <option key={method} value={method}>
                    {t(paymentMethodKeys[method])}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">{t('sale.payment.hint')}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sale-reference" className="block text-xs font-medium text-slate-600">
                {t('sale.checkout.reference')}
              </label>
              <input
                id="sale-reference"
                type="text"
                dir="ltr"
                className={fieldClass}
                {...register('reference')}
              />
            </div>
            <div>
              <label htmlFor="sale-notes" className="block text-xs font-medium text-slate-600">
                {t('sale.checkout.notes')}
              </label>
              <input id="sale-notes" type="text" className={fieldClass} {...register('notes')} />
            </div>
          </div>

          {postError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {postError}
            </p>
          )}

          <Button type="submit" disabled={!canWrite || sale.isPending || !preview.ready}>
            {sale.isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {t('sale.post.action')}
          </Button>
          {!canWrite && <p className="text-xs text-slate-500">{t('sale.viewerReadOnly')}</p>}
          {canWrite && !preview.ready && (
            <p className="text-xs text-slate-500">
              {preview.problems.some((problem) => problem.reason === 'empty')
                ? t('sale.post.basketEmpty')
                : t('sale.post.fixLines')}
            </p>
          )}
        </form>

        <DevicePickerDialog
          organizationId={organizationId}
          product={pickerProduct}
          warehouseId={warehouseId}
          locationId={locationId}
          locationLabel={locationLabel}
          onOpenChange={(open) => {
            if (!open) setPickerProduct(null);
          }}
          onPick={(device) => appendDevice(device, 'picker')}
        />
      </div>
    </div>
  );
}

interface PostedSaleProps {
  organizationId: string;
  result: SalesInvoiceCreateResult;
  onDismiss: () => void;
  onOpenInvoice: (invoiceId: string) => void;
}

/** The confirmation of a posted sale carries the amounts the server computed, never the preview. */
function PostedSale({ organizationId, result, onDismiss, onOpenInvoice }: PostedSaleProps) {
  const { t, plural, formatMoney } = useI18n();

  return (
    <section
      aria-labelledby="sale-posted-heading"
      className="rounded-xl border border-emerald-200 bg-emerald-50 p-6"
    >
      <h2
        id="sale-posted-heading"
        className="flex items-center gap-2 text-lg font-semibold text-emerald-900"
      >
        <CheckCircle2 aria-hidden="true" className="size-5" />
        <span dir="ltr">{t('sale.posted.title', { number: result.number })}</span>
      </h2>

      <p className="mt-2 text-sm text-emerald-900">
        {t('sale.posted.lines', {
          lines: plural('common.noun.lines', result.lineCount),
          quantity: plural('common.noun.units', result.totalQuantity),
        })}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-emerald-800">{t('sale.totals.net')}</dt>
        <dd className="text-end font-mono text-emerald-900">
          {formatMoney(result.netAmountMinor)}
        </dd>
        <dt className="text-emerald-800">{t('sale.totals.tax')}</dt>
        <dd className="text-end font-mono text-emerald-900">
          {formatMoney(result.taxAmountMinor)}
        </dd>
        <dt className="font-semibold text-emerald-900">{t('sale.totals.total')}</dt>
        <dd className="text-end font-mono font-semibold text-emerald-900">
          {formatMoney(result.totalAmountMinor)}
        </dd>
      </dl>
      <p className="mt-2 text-sm text-emerald-800">
        {t('sale.posted.payment', {
          status: t(paymentStatusKeys[result.paymentStatus]),
          paid: formatMoney(result.paidAmountMinor),
          remaining: formatMoney(result.remainingAmountMinor),
        })}
      </p>
      <p className="mt-1 text-xs text-emerald-800">
        {t(result.orderId ? 'sale.posted.issued' : 'sale.posted.devicesOnly')}
      </p>
      {result.duplicate && (
        <p className="mt-2 text-xs text-amber-800">{t('sale.posted.replayed')}</p>
      )}

      <div className="mt-4 space-y-3">
        <InvoicePdfButtons organizationId={organizationId} invoiceId={result.invoiceId} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenInvoice(result.invoiceId)}
          >
            {t('sale.posted.view')}
          </Button>
          <Button type="button" onClick={onDismiss}>
            {t('sale.posted.newSale')}
          </Button>
        </div>
      </div>
    </section>
  );
}
