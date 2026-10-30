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

import type { ProductSummary, ScanResult, StockCount, WarehouseSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useWarehouses } from '@/features/catalog/api';
import {
  deviceConditionLabels,
  deviceStatusLabels,
  deviceStatusStyles,
} from '@/features/devices/labels';
import { useOrganization } from '@/features/organizations/organization-provider';
import { usePostStockMovement } from '@/features/stock/api';
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';
import { ApiError } from '@/lib/api-client';
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

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-TN', { maximumFractionDigits: 4 }).format(value);
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

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
  if (result.kind === 'device') {
    const { device } = result;
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Serialized device
            </p>
            <h2 className="mt-1 font-mono text-lg font-semibold text-slate-900">
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
            {deviceStatusLabels[device.status]}
          </span>
        </header>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">IMEI</dt>
            <dd className="font-mono text-slate-900">{device.imei ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Condition</dt>
            <dd className="text-slate-900">{deviceConditionLabels[device.condition]}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Location</dt>
            <dd className="font-mono text-slate-900">
              {device.warehouseCode} / {device.locationCode}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Received</dt>
            <dd className="text-slate-900">{new Date(device.receivedAt).toLocaleString()}</dd>
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
            Print label
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/devices">
              <Smartphone aria-hidden="true" className="size-4" />
              Open device history
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
            {product.isSerialized ? 'Serialized product' : 'Quantity product'}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{product.name}</h2>
          <p className="font-mono text-sm text-slate-600">{product.sku}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Available</p>
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
          <dt className="text-slate-500">Barcode</dt>
          <dd className="font-mono text-slate-900">{product.barcode ?? 'Not assigned'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Internal code</dt>
          <dd className="font-mono text-slate-900">{product.internalCode ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">On hand</dt>
          <dd className="tabular-nums text-slate-900">{formatQuantity(totals.onHand)}</dd>
        </div>
      </dl>

      {stockLines.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Stock lines for the scanned product</caption>
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Location
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">
                  On hand
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">
                  Reserved
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Available
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockLines.map((line) => (
                <tr key={`${line.warehouseId}-${line.locationId}`}>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-700">
                    {line.warehouseCode} / {line.locationCode}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-900">
                    {formatQuantity(line.onHand)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-600">
                    {formatQuantity(line.reserved)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-900">
                    {formatQuantity(line.available)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          No stock has been posted for this product yet.
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
          Print label
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
  const warehouse = warehouses.find((item) => item.id === warehouseId);
  const locations = warehouse?.locations ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium text-slate-700">
        Warehouse
        <select
          value={warehouseId}
          disabled={disabled}
          className={fieldClass}
          onChange={(event) => onChange(event.target.value, '')}
        >
          <option value="">Select warehouse</option>
          {warehouses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Storage location
        <select
          value={locationId}
          disabled={disabled || !warehouseId}
          className={fieldClass}
          onChange={(event) => onChange(warehouseId, event.target.value)}
        >
          <option value="">Select location</option>
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
      setNotice(`Duplicate scan ignored: ${code}`);
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
            ? `Resolved device ${scanned.device.serialNumber}.`
            : `Resolved ${scanned.product.name}.`,
        );
      }
    } catch (error) {
      setResult(null);
      setScanError(messageOf(error, 'The code could not be resolved.'));
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
      setNotice('Serialized units are received from the Devices page so each serial is traceable.');
      return;
    }
    const quantity = parseQuantity(receiveQuantity);
    if (quantity === null || quantity <= 0) {
      setScanError('Enter a receipt quantity greater than zero with at most four decimals.');
      return;
    }
    if (!warehouseId || !locationId) {
      setScanError('Choose the warehouse and storage location that received the stock.');
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
            `Received ${formatQuantity(quantity)} × ${scannedProduct.name}. On hand is now ${formatQuantity(posted.onHand)}.`,
          );
          lastScan.current = null;
          void handleScan(scannedProduct.barcode ?? scannedProduct.sku, { quiet: true });
        },
        onError: (error) => setScanError(messageOf(error, 'The receipt could not be posted.')),
      },
    );
  };

  const submitStartCount = () => {
    if (!warehouseId || !locationId) {
      setScanError('Choose the warehouse and storage location to count.');
      return;
    }
    setScanError(null);
    startCount.mutate(
      { warehouseId, locationId, note: null },
      {
        onSuccess: (started) => {
          setActiveCountId(started.countId);
          setConfirmPost(false);
          setNotice('Stock count started. Scan products to record counted quantities.');
        },
        onError: (error) => setScanError(messageOf(error, 'The count could not be started.')),
      },
    );
  };

  const resumeCount = (selected: { id: string; warehouseId: string; locationId: string }) => {
    setActiveCountId(selected.id);
    setWarehouseId(selected.warehouseId);
    setLocationId(selected.locationId);
    setConfirmPost(false);
    setNotice('Open count selected.');
  };

  const submitRecord = () => {
    if (!count || !scannedProduct) return;
    const quantity = parseQuantity(countQuantity);
    if (quantity === null) {
      setScanError('Enter a counted quantity of zero or more with at most four decimals.');
      return;
    }

    setScanError(null);
    recordCount.mutate(
      { countId: count.id, productId: scannedProduct.id, quantity, mode: countMode },
      {
        onSuccess: (recorded) => {
          setNotice(
            `${scannedProduct.name}: counted ${formatQuantity(recorded.countedQuantity)} (${countMode === 'set' ? 'absolute' : 'increment'}).`,
          );
        },
        onError: (error) => setScanError(messageOf(error, 'The count could not be recorded.')),
      },
    );
  };

  const submitPost = () => {
    if (!count) return;
    setScanError(null);
    postCount.mutate(count.id, {
      onSuccess: (posted) => {
        setNotice(
          `Count posted: ${posted.lineCount} line${posted.lineCount === 1 ? '' : 's'}, ${posted.adjustedLines} adjustment${posted.adjustedLines === 1 ? '' : 's'}.`,
        );
        setActiveCountId(null);
        setConfirmPost(false);
      },
      onError: (error) => {
        setConfirmPost(false);
        setScanError(messageOf(error, 'The count could not be posted.'));
      },
    });
  };

  const submitDiscard = () => {
    if (!count) return;
    setScanError(null);
    discardCount.mutate(count.id, {
      onSuccess: () => {
        setNotice('Count discarded. No adjustments were posted.');
        setActiveCountId(null);
        setConfirmPost(false);
      },
      onError: (error) => setScanError(messageOf(error, 'The count could not be discarded.')),
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Scanning</h1>
        <p className="mt-1 text-sm text-slate-600">
          Scan or type a barcode, serial number or SKU, then receive stock or run a count at one
          storage location.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Scanning workflow">
        <Button
          role="tab"
          aria-selected={mode === 'receive'}
          variant={mode === 'receive' ? 'primary' : 'secondary'}
          onClick={() => setMode('receive')}
        >
          <ScanLine aria-hidden="true" className="size-4" />
          Receive stock
        </Button>
        <Button
          role="tab"
          aria-selected={mode === 'count'}
          variant={mode === 'count' ? 'primary' : 'secondary'}
          onClick={() => setMode('count')}
        >
          <ClipboardCheck aria-hidden="true" className="size-4" />
          Inventory count
        </Button>
      </div>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Your viewer role can look up scanned codes but cannot receive stock or record counts.
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
          <h2 className="text-base font-semibold text-slate-900">Scan a code</h2>
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
            {cameraOn ? 'Stop camera' : 'Scan with camera'}
          </Button>
        </div>

        {cameraOn && (
          <div className="mt-3 max-w-md">
            <CameraScanner active={cameraOn} onDetect={(code) => void handleScan(code)} />
          </div>
        )}

        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitManual}>
          <label htmlFor="scan-code" className="sr-only">
            Barcode, serial number or SKU
          </label>
          <input
            id="scan-code"
            value={manualCode}
            placeholder="Type or use a hardware scanner"
            autoComplete="off"
            className={`${fieldClass} mt-0 flex-1`}
            onChange={(event) => setManualCode(event.target.value)}
          />
          <Button type="submit" disabled={!manualCode.trim()}>
            <ScanLine aria-hidden="true" className="size-4" />
            Look up
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
              <h2 className="mt-4 text-base font-semibold text-slate-900">Nothing scanned yet</h2>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                Device serial numbers resolve first, then product barcodes, SKUs and internal codes.
                Repeating the same scan within 1.5 seconds is ignored.
              </p>
            </section>
          )}

          {mode === 'count' && count && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Count lines</h2>
                  <p className="font-mono text-xs text-slate-500">
                    {count.warehouseCode} / {count.locationCode} · {count.lineCount} line
                    {count.lineCount === 1 ? '' : 's'} · variance{' '}
                    {formatQuantity(countTotals.variance)}
                  </p>
                </div>
                <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-indigo-800 ring-1 ring-indigo-200">
                  {count.status}
                </span>
              </header>

              {count.lines.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-600">
                  Scan a product to record the first counted quantity.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Recorded count lines</caption>
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th scope="col" className="px-5 py-3 font-semibold">
                          Product
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                          On hand
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                          Counted
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                          Variance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {count.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-900">{line.productName}</p>
                            <p className="font-mono text-xs text-slate-500">{line.productSku}</p>
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                            {formatQuantity(line.onHand)}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-900">
                            {formatQuantity(line.countedQuantity)}
                          </td>
                          <td
                            className={cn(
                              'px-5 py-3 text-right font-medium tabular-nums',
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
                      Posting writes {countTotals.negative} adjustment
                      {countTotals.negative === 1 ? '' : 's'} totalling{' '}
                      {formatQuantity(countTotals.variance)} units to the stock ledger. This cannot
                      be undone.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" disabled={postCount.isPending} onClick={submitPost}>
                        <Send aria-hidden="true" className="size-4" />
                        {postCount.isPending ? 'Posting…' : 'Confirm post'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmPost(false)}
                        disabled={postCount.isPending}
                      >
                        Keep counting
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
                      Post count
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!canWrite || busy}
                      onClick={submitDiscard}
                    >
                      Discard count
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
              <h2 className="text-base font-semibold text-slate-900">Receive into</h2>
              <p className="mt-1 text-sm text-slate-600">
                A receipt increases on-hand stock at one location. Serialized products must be
                registered as devices instead.
              </p>

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
                Quantity
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
                {receive.isPending ? 'Posting…' : 'Post receipt'}
              </Button>

              {scannedProduct?.isSerialized && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  This product is serialized. Register the unit from{' '}
                  <Link className="font-semibold text-indigo-700" to="/devices">
                    Devices
                  </Link>{' '}
                  so its history stays traceable.
                </p>
              )}
            </section>
          ) : (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900">
                  {count ? 'Record a counted product' : 'Start a count'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {count
                    ? 'Scan a product, then record the counted quantity. Increment adds to the current line; set replaces it.'
                    : 'A count is scoped to one storage location, and only one count can be open per location.'}
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
                      {startCount.isPending ? 'Starting…' : 'Start count'}
                    </Button>
                  </>
                ) : (
                  <>
                    {scannedProduct && !scannedProduct.isSerialized ? (
                      <>
                        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <span className="font-medium">{scannedProduct.name}</span>
                          <span className="font-mono text-xs text-slate-500">
                            {' '}
                            · {scannedProduct.sku}
                          </span>
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Quantity
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
                            Mode
                            <select
                              value={countMode}
                              className={fieldClass}
                              onChange={(event) =>
                                setCountMode(event.target.value as 'increment' | 'set')
                              }
                            >
                              <option value="increment">Add to line</option>
                              <option value="set">Set exact</option>
                            </select>
                          </label>
                        </div>
                        <Button
                          className="mt-3 w-full"
                          disabled={!canWrite || recordCount.isPending}
                          onClick={submitRecord}
                        >
                          <ClipboardCheck aria-hidden="true" className="size-4" />
                          {recordCount.isPending ? 'Recording…' : 'Record count'}
                        </Button>
                      </>
                    ) : scannedProduct ? (
                      <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Serialized products are not counted by quantity. Each device is tracked in
                        Devices instead.
                      </p>
                    ) : (
                      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Scan a quantity product to record a count line.
                      </p>
                    )}
                  </>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900">Open counts</h2>
                {openCounts.isPending ? (
                  <p className="mt-2 text-sm text-slate-500">Loading counts…</p>
                ) : (openCounts.data?.items.length ?? 0) === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    No count is open. Start one for a storage location.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {openCounts.data?.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-mono text-xs text-slate-700">
                            {item.warehouseCode} / {item.locationCode}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.lineCount} line{item.lineCount === 1 ? '' : 's'} ·{' '}
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => resumeCount(item)}
                          disabled={item.id === activeCountId}
                        >
                          {item.id === activeCountId ? 'Selected' : 'Resume'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {activeCountId && !count && activeCount.isPending && (
            <p className="text-sm text-slate-500">Loading the selected count…</p>
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
