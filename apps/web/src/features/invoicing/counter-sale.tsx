import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import type {
  DeviceSummary,
  ProductSummary,
  SalesInvoiceCreateResult,
  WarehouseSummary,
} from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { WarehouseLocationFields } from '@/components/ui/warehouse-location-fields';
import { useAccessToken } from '@/features/auth/auth-provider';
import { useProducts } from '@/features/catalog/api';
import { scanCode } from '@/features/scanning/api';
import type { ScanCapture } from '@/features/scanning/scan-wedge';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { parseAmountToMinor, parseQuantity } from '@/lib/parse-amount';

import { usePostSale, useRetrySafeIdempotencyKey } from './api';
import { BasketTable } from './basket-table';
import {
  addDevice,
  addProduct,
  type BasketLine,
  type BasketOrigin,
  effectivePriceMinor,
  findProductLine,
  previewBasket,
  removeLine,
  toInvoiceLines,
  updateLine,
} from './basket';
import { emptyManualCustomer, type SaleCustomer } from './customer-picker';
import { DevicePickerDialog } from './device-picker-dialog';
import { InvoicePdfButtons } from './invoice-pdf-buttons';
import { paymentStatusKeys } from './labels';
import { ProductSearchDialog } from './product-search';
import { SaleReviewDialog } from './sale-review-dialog';
import { buildSaleSchema, emptySale, type SaleValues } from './sale-form';
import { ScanBox } from './scan-box';
import { ScanConfirmDialog, type PendingScan } from './scan-confirm-dialog';

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
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<MessageKey | null>(null);
  const [posted, setPosted] = useState<SalesInvoiceCreateResult | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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

  // A popup covers the counter, so the wedge stops listening and the camera stops
  // reading while one is open: a scan belongs to the page, not to the dialog.
  const dialogOpen =
    pendingScan !== null || pickerProduct !== null || manualEntryOpen || reviewOpen;
  const depotChosen = warehouseId !== '' && locationId !== '';

  // Why the counter will not open the review yet, in the order the operator fixes it.
  const blockedHint: MessageKey | null = !canWrite
    ? 'sale.viewerReadOnly'
    : !depotChosen
      ? 'sale.post.needsDepot'
      : !preview.ready
        ? preview.problems.some((problem) => problem.reason === 'empty')
          ? 'sale.post.basketEmpty'
          : 'sale.post.fixLines'
        : null;

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

      // Nothing enters the basket from a read until the operator confirms it:
      // the camera keeps seeing the label and the wedge fires on its own trigger.
      const existing = findProductLine(lines, product.id);
      setPendingScan({
        product,
        code: capture.rawValue,
        origin: capture.source,
        unitPriceMinor: existing ? effectivePriceMinor(existing) : product.salePriceMinor,
        alreadyInBasket: existing ? (parseQuantity(existing.quantity) ?? 0) : 0,
      });
    } catch (error) {
      setScanError(errorMessage(error, 'sale.scan.unknownCode'));
    } finally {
      resolving.current = false;
      setBusy(false);
    }
  };

  const confirmScan = (scan: PendingScan, quantity: number) => {
    setLines((current) =>
      addProduct(current, scan.product, {
        taxRate: defaultTaxRate,
        origin: scan.origin,
        quantity,
      }),
    );
    setNotice(t('sale.scan.productAdded', { product: scan.product.name }));
    setPendingScan(null);
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
    setPaymentError(null);

    if (customer.mode === 'manual' && customer.name.trim() === '') {
      setCustomerError('sale.customer.nameRequired');
      return;
    }
    setCustomerError(null);

    const paidAmountMinor = parseAmountToMinor(values.paymentAmount) ?? 0;
    if (paidAmountMinor > preview.totals.totalMinor) {
      setPaymentError(t('sale.payment.exceedsTotal'));
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
      setReviewOpen(false);
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
    <>
      {/* The counter is worked in one column: where the stock leaves from, then the
          code, then the basket. Everything the operator used to hunt for in a second
          column — buyer, amounts, money — is reviewed in a popup before posting. */}
      <div className="flex flex-col gap-4">
        <section
          aria-labelledby="sale-depot-heading"
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <h2 id="sale-depot-heading" className="text-sm font-semibold text-slate-900">
            {t('sale.depot.title')}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{t('sale.depot.hint')}</p>

          <div className="mt-3">
            <WarehouseLocationFields
              idPrefix="sale"
              warehouses={warehouses}
              warehouseField={register('warehouseId')}
              locationField={register('locationId')}
              selectedWarehouseId={warehouseId}
              warehouseLabel={t('sale.checkout.depot')}
              locationLabel={t('sale.checkout.issueFrom')}
            />
          </div>
          {(errors.warehouseId || errors.locationId) && (
            <p role="alert" className="mt-2 text-xs text-rose-700">
              {errors.warehouseId?.message ?? errors.locationId?.message}
            </p>
          )}
        </section>

        <section
          aria-labelledby="sale-counter-heading"
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <h2 id="sale-counter-heading" className="text-sm font-semibold text-slate-900">
            {t('sale.scan.title')}
          </h2>

          <div className="mt-3">
            <ScanBox
              active={canWrite && !dialogOpen}
              busy={busy || sale.isPending}
              disabled={!canWrite}
              onCapture={(capture) => void handleCapture(capture)}
              onManualEntry={() => {
                setScanError(null);
                setManualEntryOpen(true);
              }}
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
            <p className="hidden text-xs text-slate-500 sm:block">{t('sale.defaultTax.hint')}</p>
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
      </div>

      <ScanConfirmDialog
        scan={pendingScan}
        onOpenChange={(open) => {
          if (!open) setPendingScan(null);
        }}
        onConfirm={confirmScan}
      />

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

      <ProductSearchDialog
        organizationId={organizationId}
        open={manualEntryOpen}
        onOpenChange={setManualEntryOpen}
        notice={notice}
        onAddProduct={addFromSearch}
        onPickDevice={(product) => {
          setScanError(null);
          setPickerProduct(product);
        }}
      />

      <SaleReviewDialog
        organizationId={organizationId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        canWrite={canWrite}
        lines={lines}
        preview={preview}
        locationLabel={locationLabel}
        customer={customer}
        customerErrorKey={customerError}
        onCustomerChange={(next) => {
          setCustomerError(null);
          setCustomer(next);
        }}
        onCustomerSelected={(selected) => setCustomer({ mode: 'directory', customer: selected })}
        register={register}
        errors={errors}
        isPending={sale.isPending}
        postError={paymentError ?? postError}
        onSubmit={post}
      />

      {/* What the basket holds, what it costs and the one action that reviews and
          posts it ride at the bottom of the screen: the counter is worked from there
          on a phone, and the same strip keeps a desktop operator from hunting. */}
      <div aria-hidden="true" className="h-24" />
      <div
        id="sale-summary-bar"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
      >
        <div className="flex items-center gap-3 px-4 py-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
          <div className="min-w-0 shrink-0">
            <p className="text-xs text-slate-500">
              {t('sale.basket.count', {
                lines: plural('common.noun.lines', lines.length),
                quantity: plural('common.noun.units', preview.totalQuantity),
              })}
            </p>
            <p className="font-mono text-base font-semibold text-slate-900">
              {formatMoney(preview.totals.totalMinor)}
            </p>
          </div>
          {blockedHint && (
            <p role="status" className="min-w-0 flex-1 truncate text-xs text-amber-700">
              {t(blockedHint)}
            </p>
          )}
          <Button
            type="button"
            className={blockedHint ? 'shrink-0' : 'ms-auto shrink-0'}
            onClick={() => {
              setPaymentError(null);
              setReviewOpen(true);
            }}
            disabled={blockedHint !== null}
          >
            {sale.isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {t('sale.post.action')}
          </Button>
        </div>
      </div>
    </>
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
