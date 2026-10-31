import {
  Camera,
  CameraOff,
  CheckCircle2,
  ClipboardCheck,
  Printer,
  ScanLine,
  Send,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { type FormEvent, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import type {
  ProductSummary,
  ScanResult,
  StockCount,
  StockCountStatus,
  WarehouseSummary,
} from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useWarehouses } from '@/features/catalog/api';
import {
  deviceConditionKeys,
  deviceStatusKeys,
  deviceStatusStyles,
} from '@/features/devices/labels';
import { useOrganization } from '@/features/organizations/organization-provider';
import { usePostStockMovement } from '@/features/stock/api';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';
import { CameraScanner } from '@/features/scanning/camera-scanner';
import { LabelDialog, type LabelTarget } from '@/features/scanning/label-dialog';
import {
  scanCode,
  useDiscardStockCount,
  usePostStockCount,
  useRecordStockCount,
  useStartStockCount,
  useStockCount,
  useStockCounts,
} from '@/features/scanning/api';
import { useAccessToken } from '@/features/auth/auth-provider';

type Mode = 'receive' | 'count';

const countStatusKeys: Record<StockCountStatus, MessageKey> = {
  open: 'scan.count.status.open',
  posted: 'scan.count.status.posted',
  cancelled: 'scan.count.status.cancelled',
};

function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const quantity = Number(normalized);
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  if (Math.abs(quantity * 10_000 - Math.round(quantity * 10_000)) > 1e-6) return null;
  return quantity;
}

function ScanResultCard({
  result,
  onPrint,
}: {
  result: ScanResult;
  onPrint: (targets: LabelTarget[]) => void;
}) {
  const { t, formatQuantity, formatDateTime } = useI18n();

  if (result.kind === 'device') {
    const { device } = result;
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {t('scan.result.serializedDevice')}
            </p>
            <h2 dir="ltr" className="mt-1 font-mono text-lg font-semibold text-slate-900">
              {device.serialNumber}
            </h2>
            <p className="text-sm text-slate-600">
              {device.productName} · {device.productSku}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
              deviceStatusStyles[device.status],
            )}
          >
            {t(deviceStatusKeys[device.status])}
          </span>
        </header>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{t('scan.result.imei')}</dt>
            <dd dir="ltr" className="font-mono text-slate-900">
              {device.imei ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('scan.result.condition')}</dt>
            <dd className="text-slate-900">{t(deviceConditionKeys[device.condition])}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('common.location')}</dt>
            <dd dir="ltr" className="font-mono text-slate-900">
              {device.warehouseCode} / {device.locationCode}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('scan.result.received')}</dt>
            <dd className="text-slate-900">{formatDateTime(device.receivedAt)}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onPrint([
                {
                  kind: 'device',
                  id: device.id,
                  title: `${device.serialNumber} — ${device.productName}`,
                },
              ])
            }
          >
            <Printer aria-hidden="true" className="size-4" />
            {t('scan.printLabel')}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/devices">
              <Smartphone aria-hidden="true" className="size-4" />
              {t('scan.openDeviceHistory')}
            </Link>
          </Button>
        </div>
      </article>
    );
  }

  const { product, stockLines, totals } = result;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            {product.isSerialized
              ? t('scan.result.serializedProduct')
              : t('scan.result.quantityProduct')}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{product.name}</h2>
          <p dir="ltr" className="font-mono text-sm text-slate-600">
            {product.sku}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {t('scan.result.available')}
          </p>
          <p
            className={cn(
              'text-2xl font-semibold tabular-nums',
              totals.available <= 0 ? 'text-rose-700' : 'text-emerald-700',
            )}
          >
            {formatQuantity(totals.available)}
          </p>
        </div>
      </header>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">{t('scan.result.barcode')}</dt>
          <dd dir="ltr" className="font-mono text-slate-900">
            {product.barcode ?? t('scan.result.notAssigned')}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t('scan.result.internalCode')}</dt>
          <dd dir="ltr" className="font-mono text-slate-900">
            {product.internalCode ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t('scan.result.onHand')}</dt>
          <dd className="tabular-nums text-slate-900">{formatQuantity(totals.onHand)}</dd>
        </div>
      </dl>

      {stockLines.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <caption className="sr-only">{t('scan.result.stockLinesCaption')}</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-2 pe-4 font-semibold">
                  {t('common.location')}
                </th>
                <th scope="col" className="py-2 pe-4 text-end font-semibold">
                  {t('scan.result.onHand')}
                </th>
                <th scope="col" className="py-2 pe-4 text-end font-semibold">
                  {t('scan.result.reserved')}
                </th>
                <th scope="col" className="py-2 text-end font-semibold">
                  {t('scan.result.available')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockLines.map((line) => (
                <tr key={`${line.warehouseId}-${line.locationId}`}>
                  <td dir="ltr" className="py-2 pe-4 font-mono text-xs text-slate-700">
                    {line.warehouseCode} / {line.locationCode}
                  </td>
                  <td className="py-2 pe-4 text-end tabular-nums text-slate-900">
                    {formatQuantity(line.onHand)}
                  </td>
                  <td className="py-2 pe-4 text-end tabular-nums text-slate-600">
                    {formatQuantity(line.reserved)}
                  </td>
                  <td className="py-2 text-end tabular-nums text-slate-900">
                    {formatQuantity(line.available)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t('scan.result.noStock')}
        </p>
      )}

      <div className="mt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            onPrint([
              {
                kind: 'product',
                id: product.id,
                title: `${product.name} (${product.sku})`,
              },
            ])
          }
        >
          <Printer aria-hidden="true" className="size-4" />
          {t('scan.printLabel')}
        </Button>
      </div>
    </article>
  );
}

function LocationPicker({
  warehouses,
  warehouseId,
  locationId,
  onChange,
  disabled,
}: {
  warehouses: WarehouseSummary[];
  warehouseId: string;
  locationId: string;
  onChange: (warehouseId: string, locationId: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const warehouse = warehouses.find((item) => item.id === warehouseId);
  const locations = warehouse?.locations ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium text-slate-700">
        {t('common.warehouse')}
        <select
          value={warehouseId}
          disabled={disabled}
          className={fieldClass}
          onChange={(event) => onChange(event.target.value, '')}
        >
          <option value="">{t('common.selectWarehouseShort')}</option>
          {warehouses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        {t('common.storageLocation')}
        <select
          value={locationId}
          disabled={disabled || !warehouseId}
          className={fieldClass}
          onChange={(event) => onChange(warehouseId, event.target.value)}
        >
          <option value="">{t('common.selectLocationShort')}</option>
          {locations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function ScanningPage() {
  const { t, plural, errorMessage, formatQuantity, formatDate } = useI18n();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const token = useAccessToken();
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const [mode, setMode] = useState<Mode>('receive');
  const [cameraOn, setCameraOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [labelTargets, setLabelTargets] = useState<LabelTarget[] | null>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [receiveQuantity, setReceiveQuantity] = useState('1');
  const [countQuantity, setCountQuantity] = useState('1');
  const [countMode, setCountMode] = useState<'increment' | 'set'>('increment');
  const [activeCountId, setActiveCountId] = useState<string | null>(null);
  const [confirmPost, setConfirmPost] = useState(false);

  const warehouses = useWarehouses(organizationId);
  const openCounts = useStockCounts(organizationId, { status: 'open', page: 1, pageSize: 20 });
  const activeCount = useStockCount(organizationId, activeCountId);

  const receive = usePostStockMovement(organizationId ?? '');
  const startCount = useStartStockCount(organizationId ?? '');
  const recordCount = useRecordStockCount(organizationId ?? '');
  const postCount = usePostStockCount(organizationId ?? '');
  const discardCount = useDiscardStockCount(organizationId ?? '');

  const scannedProduct: ProductSummary | null = result?.kind === 'product' ? result.product : null;
  const count: StockCount | null = activeCount.data ?? null;

  const countTotals = useMemo(() => {
    const lines = count?.lines ?? [];
    return {
      lines: lines.length,
      variance: lines.reduce((sum, line) => sum + line.variance, 0),
      negative: lines.filter((line) => line.variance !== 0).length,
    };
  }, [count]);

  const handleScan = async (raw: string, options: { quiet?: boolean } = {}) => {
    const code = raw.trim();
    if (!code || !organizationId) return;

    const now = Date.now();
    const previous = lastScan.current;
    if (
      previous &&
      previous.code.toLowerCase() === code.toLowerCase() &&
      now - previous.at < 1_500
    ) {
      setNotice(t('scan.notice.duplicate', { code }));
      return;
    }
    lastScan.current = { code, at: now };

    setScanError(null);
    if (!options.quiet) setNotice(null);
    try {
      const scanned = await scanCode(organizationId, token, code);
      setResult(scanned);
      if (!options.quiet) {
        setNotice(
          scanned.kind === 'device'
            ? t('scan.notice.device', { serial: scanned.device.serialNumber })
            : t('scan.notice.product', { product: scanned.product.name }),
        );
      }
    } catch (error) {
      setResult(null);
      setScanError(errorMessage(error, 'scan.error.resolveFailed'));
    }
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    void handleScan(code);
  };

  const submitReceive = () => {
    if (!scannedProduct) return;
    if (scannedProduct.isSerialized) {
      setNotice(t('scan.notice.serializedReceive'));
      return;
    }
    const quantity = parseQuantity(receiveQuantity);
    if (quantity === null || quantity <= 0) {
      setScanError(t('scan.error.receiptQuantity'));
      return;
    }
    if (!warehouseId || !locationId) {
      setScanError(t('scan.error.receiptLocation'));
      return;
    }

    setScanError(null);
    receive.mutate(
      {
        productId: scannedProduct.id,
        warehouseId,
        locationId,
        type: 'receipt',
        quantity,
        reason: 'Scan receiving',
      },
      {
        onSuccess: (posted) => {
          setNotice(
            t('scan.notice.received', {
              quantity: formatQuantity(quantity),
              product: scannedProduct.name,
              onHand: formatQuantity(posted.onHand),
            }),
          );
          lastScan.current = null;
          void handleScan(scannedProduct.barcode ?? scannedProduct.sku, { quiet: true });
        },
        onError: (error) => setScanError(errorMessage(error, 'scan.error.receiptFailed')),
      },
    );
  };

  const submitStartCount = () => {
    if (!warehouseId || !locationId) {
      setScanError(t('scan.error.countLocation'));
      return;
    }
    setScanError(null);
    startCount.mutate(
      { warehouseId, locationId, note: null },
      {
        onSuccess: (started) => {
          setActiveCountId(started.countId);
          setConfirmPost(false);
          setNotice(t('scan.notice.countStarted'));
        },
        onError: (error) => setScanError(errorMessage(error, 'scan.error.countStartFailed')),
      },
    );
  };

  const resumeCount = (selected: { id: string; warehouseId: string; locationId: string }) => {
    setActiveCountId(selected.id);
    setWarehouseId(selected.warehouseId);
    setLocationId(selected.locationId);
    setConfirmPost(false);
    setNotice(t('scan.notice.countSelected'));
  };

  const submitRecord = () => {
    if (!count || !scannedProduct) return;
    const quantity = parseQuantity(countQuantity);
    if (quantity === null) {
      setScanError(t('scan.error.countQuantity'));
      return;
    }

    setScanError(null);
    recordCount.mutate(
      { countId: count.id, productId: scannedProduct.id, quantity, mode: countMode },
      {
        onSuccess: (recorded) => {
          setNotice(
            t('scan.notice.countRecorded', {
              product: scannedProduct.name,
              quantity: formatQuantity(recorded.countedQuantity),
              mode: t(countMode === 'set' ? 'scan.mode.absolute' : 'scan.mode.increment'),
            }),
          );
        },
        onError: (error) => setScanError(errorMessage(error, 'scan.error.countRecordFailed')),
      },
    );
  };

  const submitPost = () => {
    if (!count) return;
    setScanError(null);
    postCount.mutate(count.id, {
      onSuccess: (posted) => {
        setNotice(
          t('scan.notice.posted', {
            lines: plural('scan.lines', posted.lineCount),
            adjustments: plural('scan.adjustments', posted.adjustedLines),
          }),
        );
        setActiveCountId(null);
        setConfirmPost(false);
      },
      onError: (error) => {
        setConfirmPost(false);
        setScanError(errorMessage(error, 'scan.error.countPostFailed'));
      },
    });
  };

  const submitDiscard = () => {
    if (!count) return;
    setScanError(null);
    discardCount.mutate(count.id, {
      onSuccess: () => {
        setNotice(t('scan.notice.discarded'));
        setActiveCountId(null);
        setConfirmPost(false);
      },
      onError: (error) => setScanError(errorMessage(error, 'scan.error.countDiscardFailed')),
    });
  };

  const busy =
    receive.isPending ||
    startCount.isPending ||
    recordCount.isPending ||
    postCount.isPending ||
    discardCount.isPending;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('scan.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('scan.subtitle')}</p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('scan.tabsLabel')}>
        <Button
          role="tab"
          aria-selected={mode === 'receive'}
          variant={mode === 'receive' ? 'primary' : 'secondary'}
          onClick={() => setMode('receive')}
        >
          <ScanLine aria-hidden="true" className="size-4" />
          {t('scan.tabs.receive')}
        </Button>
        <Button
          role="tab"
          aria-selected={mode === 'count'}
          variant={mode === 'count' ? 'primary' : 'secondary'}
          onClick={() => setMode('count')}
        >
          <ClipboardCheck aria-hidden="true" className="size-4" />
          {t('scan.tabs.count')}
        </Button>
      </div>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          {t('scan.readOnly')}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          {notice}
        </p>
      )}

      {scanError && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <XCircle aria-hidden="true" className="size-4 shrink-0" />
          {scanError}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{t('scan.lookupSection')}</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCameraOn((current) => !current);
              setScanError(null);
            }}
          >
            {cameraOn ? (
              <CameraOff aria-hidden="true" className="size-4" />
            ) : (
              <Camera aria-hidden="true" className="size-4" />
            )}
            {cameraOn ? t('scan.camera.stop') : t('scan.camera.start')}
          </Button>
        </div>

        {cameraOn && (
          <div className="mt-3 max-w-md">
            <CameraScanner active={cameraOn} onDetect={(code) => void handleScan(code)} />
          </div>
        )}

        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitManual}>
          <label htmlFor="scan-code" className="sr-only">
            {t('scan.codeLabel')}
          </label>
          <input
            id="scan-code"
            value={manualCode}
            dir="ltr"
            placeholder={t('scan.codePlaceholder')}
            autoComplete="off"
            className={`${fieldClass} mt-0 flex-1`}
            onChange={(event) => setManualCode(event.target.value)}
          />
          <Button type="submit" disabled={!manualCode.trim()}>
            <ScanLine aria-hidden="true" className="size-4" />
            {t('scan.lookup')}
          </Button>
        </form>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          {result ? (
            <ScanResultCard result={result} onPrint={(targets) => setLabelTargets(targets)} />
          ) : (
            <section className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
                <ScanLine aria-hidden="true" className="size-6" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-slate-900">
                {t('scan.empty.title')}
              </h2>
              <p className="mt-2 max-w-md text-sm text-slate-600">{t('scan.empty.body')}</p>
            </section>
          )}

          {mode === 'count' && count && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {t('scan.count.title')}
                  </h2>
                  <p className="font-mono text-xs text-slate-500">
                    {t('scan.count.lineSummary', {
                      location: `${count.warehouseCode} / ${count.locationCode}`,
                      lines: plural('scan.lines', count.lineCount),
                      variance: formatQuantity(countTotals.variance),
                    })}
                  </p>
                </div>
                <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-indigo-800 ring-1 ring-indigo-200">
                  {t(countStatusKeys[count.status])}
                </span>
              </header>

              {count.lines.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-600">
                  {t('scan.count.empty')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-sm">
                    <caption className="sr-only">{t('scan.count.caption')}</caption>
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th scope="col" className="px-5 py-3 font-semibold">
                          {t('common.product')}
                        </th>
                        <th scope="col" className="px-5 py-3 text-end font-semibold">
                          {t('scan.count.onHand')}
                        </th>
                        <th scope="col" className="px-5 py-3 text-end font-semibold">
                          {t('scan.count.counted')}
                        </th>
                        <th scope="col" className="px-5 py-3 text-end font-semibold">
                          {t('scan.count.varianceColumn')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {count.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-900">{line.productName}</p>
                            <p dir="ltr" className="font-mono text-xs text-slate-500">
                              {line.productSku}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-end tabular-nums text-slate-600">
                            {formatQuantity(line.onHand)}
                          </td>
                          <td className="px-5 py-3 text-end tabular-nums text-slate-900">
                            {formatQuantity(line.countedQuantity)}
                          </td>
                          <td
                            className={cn(
                              'px-5 py-3 text-end font-medium tabular-nums',
                              line.variance === 0
                                ? 'text-slate-500'
                                : line.variance > 0
                                  ? 'text-emerald-700'
                                  : 'text-rose-700',
                            )}
                          >
                            {line.variance > 0 ? '+' : ''}
                            {formatQuantity(line.variance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <footer className="space-y-3 border-t border-slate-200 px-5 py-4">
                {confirmPost ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <p>
                      {t('scan.count.confirm', {
                        adjustments: plural('scan.adjustments', countTotals.negative),
                        quantity: formatQuantity(countTotals.variance),
                      })}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" disabled={postCount.isPending} onClick={submitPost}>
                        <Send aria-hidden="true" className="size-4" />
                        {postCount.isPending
                          ? t('scan.count.posting')
                          : t('scan.count.confirmPost')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmPost(false)}
                        disabled={postCount.isPending}
                      >
                        {t('scan.count.keepCounting')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!canWrite || count.lineCount === 0 || busy}
                      onClick={() => setConfirmPost(true)}
                    >
                      <Send aria-hidden="true" className="size-4" />
                      {t('scan.count.post')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!canWrite || busy}
                      onClick={submitDiscard}
                    >
                      {t('scan.count.discard')}
                    </Button>
                  </div>
                )}
              </footer>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {mode === 'receive' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900">{t('scan.receive.title')}</h2>
              <p className="mt-1 text-sm text-slate-600">{t('scan.receive.description')}</p>

              <div className="mt-4">
                <LocationPicker
                  warehouses={warehouses.data ?? []}
                  warehouseId={warehouseId}
                  locationId={locationId}
                  onChange={(nextWarehouse, nextLocation) => {
                    setWarehouseId(nextWarehouse);
                    setLocationId(nextLocation);
                  }}
                  disabled={!canWrite}
                />
              </div>

              <label className="mt-3 block text-sm font-medium text-slate-700">
                {t('common.quantity')}
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={receiveQuantity}
                  disabled={!canWrite}
                  className={fieldClass}
                  onChange={(event) => setReceiveQuantity(event.target.value)}
                />
              </label>

              <Button
                className="mt-4 w-full"
                disabled={!canWrite || !scannedProduct || scannedProduct.isSerialized || busy}
                onClick={submitReceive}
              >
                <Send aria-hidden="true" className="size-4" />
                {receive.isPending ? t('scan.receive.posting') : t('scan.receive.post')}
              </Button>

              {scannedProduct?.isSerialized && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {t('scan.receive.serializedBefore')}
                  <Link className="font-semibold text-indigo-700" to="/devices">
                    {t('nav.devices')}
                  </Link>
                  {t('scan.receive.serializedAfter')}
                </p>
              )}
            </section>
          ) : (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900">
                  {count ? t('scan.count.recordTitle') : t('scan.count.startTitle')}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {count ? t('scan.count.recordDescription') : t('scan.count.startDescription')}
                </p>

                {!count ? (
                  <>
                    <div className="mt-4">
                      <LocationPicker
                        warehouses={warehouses.data ?? []}
                        warehouseId={warehouseId}
                        locationId={locationId}
                        onChange={(nextWarehouse, nextLocation) => {
                          setWarehouseId(nextWarehouse);
                          setLocationId(nextLocation);
                        }}
                        disabled={!canWrite}
                      />
                    </div>
                    <Button
                      className="mt-4 w-full"
                      disabled={!canWrite || !warehouseId || !locationId || busy}
                      onClick={submitStartCount}
                    >
                      <ClipboardCheck aria-hidden="true" className="size-4" />
                      {startCount.isPending ? t('scan.count.starting') : t('scan.count.start')}
                    </Button>
                  </>
                ) : (
                  <>
                    {scannedProduct && !scannedProduct.isSerialized ? (
                      <>
                        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <span className="font-medium">{scannedProduct.name}</span>
                          <span dir="ltr" className="font-mono text-xs text-slate-500">
                            {' '}
                            · {scannedProduct.sku}
                          </span>
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t('common.quantity')}
                            <input
                              type="number"
                              min={0}
                              step="0.0001"
                              value={countQuantity}
                              className={fieldClass}
                              onChange={(event) => setCountQuantity(event.target.value)}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t('scan.count.mode')}
                            <select
                              value={countMode}
                              className={fieldClass}
                              onChange={(event) =>
                                setCountMode(event.target.value as 'increment' | 'set')
                              }
                            >
                              <option value="increment">{t('scan.count.addToLine')}</option>
                              <option value="set">{t('scan.count.setExact')}</option>
                            </select>
                          </label>
                        </div>
                        <Button
                          className="mt-3 w-full"
                          disabled={!canWrite || recordCount.isPending}
                          onClick={submitRecord}
                        >
                          <ClipboardCheck aria-hidden="true" className="size-4" />
                          {recordCount.isPending
                            ? t('scan.count.recording')
                            : t('scan.count.record')}
                        </Button>
                      </>
                    ) : scannedProduct ? (
                      <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {t('scan.count.serializedHelp')}
                      </p>
                    ) : (
                      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {t('scan.count.scanQuantityProduct')}
                      </p>
                    )}
                  </>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900">
                  {t('scan.count.openCounts')}
                </h2>
                {openCounts.isPending ? (
                  <p className="mt-2 text-sm text-slate-500">{t('scan.count.loadingOpen')}</p>
                ) : (openCounts.data?.items.length ?? 0) === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">{t('scan.count.noneOpen')}</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {openCounts.data?.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <div>
                          <p dir="ltr" className="font-mono text-xs text-slate-700">
                            {item.warehouseCode} / {item.locationCode}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t('scan.count.itemSummary', {
                              lines: plural('scan.lines', item.lineCount),
                              date: formatDate(item.createdAt),
                            })}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => resumeCount(item)}
                          disabled={item.id === activeCountId}
                        >
                          {item.id === activeCountId
                            ? t('scan.count.selected')
                            : t('scan.count.resume')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {activeCountId && !count && activeCount.isPending && (
            <p className="text-sm text-slate-500">{t('scan.count.loadingSelected')}</p>
          )}
        </aside>
      </div>

      {organizationId && labelTargets && (
        <LabelDialog
          organizationId={organizationId}
          targets={labelTargets}
          open={Boolean(labelTargets)}
          onOpenChange={(open) => {
            if (!open) setLabelTargets(null);
          }}
        />
      )}
    </div>
  );
}
