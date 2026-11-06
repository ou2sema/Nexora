import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  CustomerSummary,
  DeviceSummary,
  PaymentMethod,
  ProductSummary,
  SalesInvoiceCreateResult,
  WarehouseSummary,
} from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useAccessToken } from '@/features/auth/auth-provider';
import { useProducts } from '@/features/catalog/api';
import { scanCode } from '@/features/scanning/api';
import type { ScanCapture } from '@/features/scanning/scan-wedge';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { useMediaQuery } from '@/lib/use-media-query';
import { parseAmountToMinor, parseQuantity } from '@/lib/parse-amount';

import { fetchProductShelves, usePostSale, useRetrySafeIdempotencyKey } from './api';
import { BasketCard } from './basket-card';
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
import {
  CheckoutPanel,
  paidAmountMinor as paidForCoverage,
  type PaymentCoverage,
} from './checkout-panel';
import { emptyManualCustomer, type SaleCustomer } from './customer-picker';
import { DevicePickerDialog } from './device-picker-dialog';
import { FindAddItems } from './find-add-items';
import { pairLabel } from './selling-location';
import { guessShelf, type ShelfGuess } from './shelf-guess';
import { SaleComplete } from './sale-complete';
import { SaleStepper, type SaleStep } from './sale-stepper';
import { ScanConfirmDialog, type PendingScan } from './scan-confirm-dialog';

/** What the confirmation screen needs beyond what the RPC returns. */
interface PostedSale {
  result: SalesInvoiceCreateResult;
  buyerName: string | null;
  tenderedMinor: number | null;
}

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
 *
 * A desk works the whole counter on one screen; a phone works it in three steps,
 * because the basket, the review and the receipt do not fit together at 412 px.
 */
export function CounterSale({
  organizationId,
  warehouses,
  canWrite,
  onOpenInvoice,
}: CounterSaleProps) {
  const { t, plural, errorMessage, formatMoney } = useI18n();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const token = useAccessToken();
  const sale = usePostSale(organizationId);
  const { key: idempotencyKey, rotate } = useRetrySafeIdempotencyKey();

  // The shelf list the counter offers, and the catalogue price a serialized unit
  // inherits — a device record carries no price of its own.
  const products = useProducts(organizationId, {
    search: '',
    status: 'active',
    page: 1,
    pageSize: 100,
  });

  const [pair, setPair] = useState({ warehouseId: '', locationId: '' });
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [customer, setCustomer] = useState<SaleCustomer>(emptyManualCustomer);
  const [defaultTaxRate, setDefaultTaxRate] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [coverage, setCoverage] = useState<PaymentCoverage>('full');
  const [amountValue, setAmountValue] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [pickerProduct, setPickerProduct] = useState<ProductSummary | null>(null);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<MessageKey | null>(null);
  const [step, setStep] = useState<SaleStep>('items');
  const [posted, setPosted] = useState<PostedSale | null>(null);

  // Scans are resolved one at a time: a second code arriving mid-resolution would
  // otherwise read a basket that has not been updated yet.
  const resolving = useRef(false);

  const preview = useMemo(() => previewBasket(lines), [lines]);
  const shelf = useMemo(() => products.data?.items ?? [], [products.data]);
  const { warehouseId, locationId } = pair;
  const locationName = pairLabel(warehouses, warehouseId, locationId);
  // A dialog covering the counter must not keep the wedge listening: the same
  // label still in frame would queue a second read behind it.
  const scannerReady =
    canWrite && !busy && pendingScan === null && pickerProduct === null && !sale.isPending;

  // A credit sale receives nothing at the counter, so "pay in full" would book a
  // payment that never happened; the coverage of a credit sale is always partial.
  const isCredit = method === 'credit';
  const effectiveCoverage: PaymentCoverage = isCredit ? 'partial' : coverage;
  const tenderedMinor = parseAmountToMinor(amountValue);

  const locationChosen = warehouseId !== '' && locationId !== '';
  const canPost = canWrite && preview.ready && locationChosen;

  useEffect(() => {
    setPosted(null);
    setStep('items');
  }, [organizationId]);

  // The phone is a step machine; a desk shows every step at once. Coming back to
  // the desk layout must not strand the operator on a step the desk has no room for.
  useEffect(() => {
    if (isDesktop && step !== 'done') setStep('items');
  }, [isDesktop, step]);

  const amountError =
    amountValue.trim() === '' || tenderedMinor !== null ? null : t('sale.payment.invalid');
  const overTotal =
    tenderedMinor !== null &&
    effectiveCoverage === 'partial' &&
    tenderedMinor > preview.totals.totalMinor;

  const deviceShelfLabel = (device: DeviceSummary): string =>
    pairLabel(warehouses, device.warehouseId, device.locationId) ??
    `${device.warehouseCode} · ${device.locationCode}`;

  const appendDevice = (device: DeviceSummary, origin: BasketOrigin): void => {
    if (device.status !== 'in_stock') {
      setScanError(t('sale.device.notInStock', { serial: device.serialNumber }));
      return;
    }

    // The unit names the shelf for as long as none has been chosen. Once the
    // operator has chosen one, a unit sitting elsewhere belongs to a different
    // sale: one invoice issues from exactly one shelf.
    const deviceShelf = { warehouseId: device.warehouseId, locationId: device.locationId };
    if (
      locationChosen &&
      (device.warehouseId !== warehouseId || device.locationId !== locationId)
    ) {
      setScanError(
        t('sale.device.wrongLocation', {
          serial: device.serialNumber,
          location: deviceShelfLabel(device),
        }),
      );
      return;
    }
    if (lines.some((line) => line.kind === 'device' && line.deviceId === device.id)) {
      setNotice(t('sale.device.alreadyInBasket', { serial: device.serialNumber }));
      return;
    }

    if (!locationChosen) setPair(deviceShelf);

    setLines((current) =>
      addDevice(
        current,
        device,
        shelf.find((product) => product.id === device.productId),
        { taxRate: defaultTaxRate, origin },
      ),
    );
    setNotice(t('sale.device.added', { serial: device.serialNumber }));
  };

  /**
   * The read says where the goods sit, so the counter takes the shelf from it while
   * the operator has not named one. A chosen shelf is never moved under a basket,
   * and a product that sits on several shelves is deliberately left unanswered.
   */
  const adoptShelf = async (productId: string): Promise<'adopted' | 'several' | 'kept'> => {
    if (locationChosen) return 'kept';

    let guess: ShelfGuess;
    try {
      guess = guessShelf(await fetchProductShelves(organizationId, token, productId));
    } catch {
      // A shelf the counter cannot read is not a scan that failed: the field is
      // still on the screen and says what it needs to say.
      return 'kept';
    }

    if (guess.status === 'several') return 'several';
    if (guess.status === 'unknown') return 'kept';

    setPair(guess.shelf);
    return 'adopted';
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
        // A serialized model leaves as a unit, never as a quantity line, so the
        // shelf has to be settled before there is a unit list to show.
        if ((await adoptShelf(product.id)) === 'several') {
          setNotice(t('sale.location.several', { product: product.name }));
          return;
        }
        setPickerProduct(product);
        return;
      }

      await adoptShelf(product.id);

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
    setNotice(
      t('sale.scan.productAdded', {
        product: scan.product.name,
        units: plural('common.noun.units', quantity),
      }),
    );
    setPendingScan(null);
  };

  const addFromShelf = (product: ProductSummary) => {
    setScanError(null);
    setNotice(null);
    setLines((current) =>
      addProduct(current, product, { taxRate: defaultTaxRate, origin: 'manual' }),
    );
    setNotice(
      t('sale.scan.productAdded', {
        product: product.name,
        units: plural('common.noun.units', 1),
      }),
    );
  };

  const openPicker = (product: ProductSummary) => {
    setScanError(null);
    setNotice(null);
    setPickerProduct(product);
  };

  const review = () => {
    setCustomerError(
      customer.mode === 'manual' && customer.name.trim() === ''
        ? 'sale.customer.nameRequired'
        : null,
    );
    setStep('payment');
  };

  const post = async () => {
    setScanError(null);
    setNotice(null);

    if (!canPost) return;

    const buyerName =
      customer.mode === 'directory'
        ? customer.customer.name
        : customer.name.trim() === ''
          ? null
          : customer.name.trim();
    if (customer.mode === 'manual' && buyerName === null) {
      setCustomerError('sale.customer.nameRequired');
      setStep('items');
      return;
    }
    setCustomerError(null);

    if (overTotal) {
      setScanError(t('sale.payment.exceedsTotal'));
      return;
    }

    try {
      const result = await sale.mutateAsync({
        input: {
          warehouseId,
          locationId,
          ...(customer.mode === 'directory'
            ? { customerId: customer.customer.id }
            : {
                customerName: buyerName,
                customerEmail: customer.email.trim() || null,
                customerPhone: customer.phone.trim() || null,
              }),
          lines: toInvoiceLines(lines),
          paidAmountMinor: paidForCoverage(
            effectiveCoverage,
            preview.totals.totalMinor,
            tenderedMinor,
          ),
          paymentMethod: method,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        },
        idempotencyKey,
      });

      // The sale is on the ledger, so this key is spent. The depot and the buyer
      // stay: the next sale leaves from the same shelf, to the same regular.
      rotate();
      setPosted({
        result,
        buyerName,
        tenderedMinor:
          effectiveCoverage === 'full' && method === 'cash'
            ? (tenderedMinor ?? result.totalAmountMinor)
            : null,
      });
      setLines([]);
      setCustomer(emptyManualCustomer);
      setAmountValue('');
      setReference('');
      setNotes('');
      setCoverage('full');
      setStep('done');
    } catch {
      // sale.error renders above the confirm action.
    }
  };

  const startNewSale = () => {
    setPosted(null);
    setNotice(null);
    setScanError(null);
    setStep('items');
  };

  const postError = sale.error ? errorMessage(sale.error, 'sale.post.failed') : null;

  const blockingKey = !canWrite
    ? 'sale.viewerReadOnly'
    : !locationChosen
      ? 'sale.location.required'
      : preview.problems.some((problem) => problem.reason === 'empty')
        ? 'sale.post.basketEmpty'
        : !preview.ready
          ? 'sale.post.fixLines'
          : null;

  const blockingReason = blockingKey === null ? null : t(blockingKey);

  // The phone's docked bar keeps the shelf sentence, so its reason line only has to
  // say what that line cannot: a viewer's role, an empty basket, a line to fix.
  const barReason =
    blockingKey === null || blockingKey === 'sale.location.required'
      ? t('sale.review.includesTax', { tax: formatMoney(preview.totals.taxMinor) })
      : blockingReason;

  if (posted) {
    return (
      <div className="space-y-4">
        {!isDesktop && <SaleStepper current="done" />}
        <SaleComplete
          organizationId={organizationId}
          result={posted.result}
          buyerName={posted.buyerName}
          locationName={locationName}
          tenderedMinor={posted.tenderedMinor}
          onNewSale={startNewSale}
          onOpenInvoice={onOpenInvoice}
        />
      </div>
    );
  }

  const findPanel = (
    <FindAddItems
      organizationId={organizationId}
      products={shelf}
      shelfLoading={products.isPending}
      warehouses={warehouses}
      warehouseId={warehouseId}
      locationId={locationId}
      canWrite={canWrite}
      busy={busy || sale.isPending}
      scannerReady={scannerReady}
      notice={notice}
      scanError={scanError}
      onLocationChange={(nextWarehouseId, nextLocationId) =>
        setPair({ warehouseId: nextWarehouseId, locationId: nextLocationId })
      }
      onCapture={(capture) => void handleCapture(capture)}
      onAddProduct={addFromShelf}
      onPickDevice={openPicker}
    />
  );

  const basketPanel = (
    <BasketCard
      organizationId={organizationId}
      lines={lines}
      warehouseId={warehouseId}
      locationId={locationId}
      canEdit={canWrite}
      totals={preview.lineAmounts}
      problems={preview.problems}
      onPatch={(key, patch) => {
        setScanError(null);
        setNotice(null);
        setLines((current) => updateLine(current, key, patch));
      }}
      onRemove={(key) => setLines((current) => removeLine(current, key))}
    />
  );

  const checkoutPanel = (
    <CheckoutPanel
      organizationId={organizationId}
      canWrite={canWrite}
      customer={customer}
      customerError={customerError}
      onCustomerChange={(next) => {
        setCustomerError(null);
        setCustomer(next);
      }}
      onCustomerSelected={(selected: CustomerSummary) =>
        setCustomer({ mode: 'directory', customer: selected })
      }
      lines={lines}
      lineAmounts={preview.lineAmounts}
      totals={preview.totals}
      locationName={locationName}
      showLines={!isDesktop}
      method={method}
      onMethodChange={setMethod}
      coverage={effectiveCoverage}
      onCoverageChange={setCoverage}
      amountValue={amountValue}
      amountMinor={tenderedMinor}
      onAmountChange={setAmountValue}
      amountError={overTotal ? t('sale.payment.exceedsTotal') : amountError}
      taxRateValue={defaultTaxRate}
      onTaxRateChange={setDefaultTaxRate}
      referenceValue={reference}
      onReferenceChange={setReference}
      notesValue={notes}
      onNotesChange={setNotes}
      onSubmit={() => void post()}
      pending={sale.isPending}
      canSubmit={canPost}
      hint={blockingReason}
      error={postError}
    />
  );

  if (isDesktop) {
    return (
      <>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            {findPanel}
            {basketPanel}
          </div>
          <div className="sticky top-6 min-w-0">{checkoutPanel}</div>
        </div>

        <CounterDialogs
          pendingScan={pendingScan}
          onCloseScan={() => setPendingScan(null)}
          onConfirmScan={confirmScan}
          pickerProduct={pickerProduct}
          onClosePicker={() => setPickerProduct(null)}
          organizationId={organizationId}
          warehouseId={warehouseId}
          locationId={locationId}
          locationName={locationName}
          onPickDevice={(device) => appendDevice(device, 'picker')}
        />
      </>
    );
  }

  if (step === 'payment') {
    return (
      <div className="space-y-4">
        <SaleStepper current="payment" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ms-2 text-indigo-700"
          onClick={() => setStep('items')}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t('sale.basket.title')}
        </Button>
        {checkoutPanel}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <SaleStepper current="items" />
        {findPanel}
        {basketPanel}
      </div>

      <CounterDialogs
        pendingScan={pendingScan}
        onCloseScan={() => setPendingScan(null)}
        onConfirmScan={confirmScan}
        pickerProduct={pickerProduct}
        onClosePicker={() => setPickerProduct(null)}
        organizationId={organizationId}
        warehouseId={warehouseId}
        locationId={locationId}
        locationName={locationName}
        onPickDevice={(device) => appendDevice(device, 'picker')}
      />

      {/* A phone never shows the whole counter at once, so what the basket holds and
          what it costs ride at the bottom of the screen beside the review action. */}
      <div aria-hidden="true" className="h-24" />
      <div
        id="sale-mobile-summary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
      >
        <div className="flex items-center gap-3 px-4 py-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            {/* The basket card counts the lines right above the bar, so the bar spends
                its one spare line on the shelf the scan settled. */}
            <p className="truncate text-xs text-slate-500">
              {locationName === null
                ? t('sale.location.required')
                : t('sale.location.leavesFrom', { location: locationName })}
            </p>
            <p dir="ltr" className="font-mono text-base font-semibold text-slate-900">
              {formatMoney(preview.totals.totalMinor)}
            </p>
            <p className="truncate text-[11px] text-slate-500">{barReason}</p>
          </div>
          <Button type="button" className="shrink-0" disabled={!canPost} onClick={review}>
            {t('sale.review.action')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

interface CounterDialogsProps {
  organizationId: string;
  warehouseId: string;
  locationId: string;
  locationName: string | null;
  pendingScan: PendingScan | null;
  onCloseScan: () => void;
  onConfirmScan: (scan: PendingScan, quantity: number) => void;
  pickerProduct: ProductSummary | null;
  onClosePicker: () => void;
  onPickDevice: (device: DeviceSummary) => void;
}

/** The two reads that interrupt the counter: a product to confirm, a unit to choose. */
function CounterDialogs({
  organizationId,
  warehouseId,
  locationId,
  locationName,
  pendingScan,
  onCloseScan,
  onConfirmScan,
  pickerProduct,
  onClosePicker,
  onPickDevice,
}: CounterDialogsProps) {
  return (
    <>
      <ScanConfirmDialog
        scan={pendingScan}
        onOpenChange={(open) => {
          if (!open) onCloseScan();
        }}
        onConfirm={onConfirmScan}
      />
      <DevicePickerDialog
        organizationId={organizationId}
        product={pickerProduct}
        warehouseId={warehouseId}
        locationId={locationId}
        locationLabel={locationName ?? ''}
        onOpenChange={(open) => {
          if (!open) onClosePicker();
        }}
        onPick={onPickDevice}
      />
    </>
  );
}
