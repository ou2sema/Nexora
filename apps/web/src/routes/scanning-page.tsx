import { Camera, CameraOff, CheckCircle2, ClipboardCheck, ScanLine, XCircle } from 'lucide-react';
import { type FormEvent, useMemo, useRef, useState } from 'react';

import type { ProductSummary, ScanResult, StockCount, StockCountSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useWarehouses } from '@/features/catalog/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useAccessToken } from '@/features/auth/auth-provider';
import { usePostStockMovement } from '@/features/stock/api';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { CameraScanner } from '@/features/scanning/camera-scanner';
import { LabelDialog, type LabelTarget } from '@/features/scanning/label-dialog';
import { CountLinesSection } from '@/features/scanning/count-lines-section';
import { CountWorkflowPanel, type CountMode } from '@/features/scanning/count-workflow-panel';
import { OpenCountsPanel } from '@/features/scanning/open-counts-panel';
import { ReceivePanel } from '@/features/scanning/receive-panel';
import { ScanResultCard } from '@/features/scanning/scan-result-card';
import {
  scanCode,
  useDiscardStockCount,
  usePostStockCount,
  useRecordStockCount,
  useStartStockCount,
  useStockCount,
  useStockCounts,
} from '@/features/scanning/api';

type Mode = 'receive' | 'count';

function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const quantity = Number(normalized);
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  if (Math.abs(quantity * 10_000 - Math.round(quantity * 10_000)) > 1e-6) return null;
  return quantity;
}

export function ScanningPage() {
  const { t, plural, errorMessage, formatQuantity } = useI18n();
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
  const [countMode, setCountMode] = useState<CountMode>('increment');
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

  const changeLocation = (nextWarehouseId: string, nextLocationId: string) => {
    setWarehouseId(nextWarehouseId);
    setLocationId(nextLocationId);
  };

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

  const resumeCount = (selected: StockCountSummary) => {
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
            <CountLinesSection
              count={count}
              totals={countTotals}
              canWrite={canWrite}
              busy={busy}
              posting={postCount.isPending}
              confirmPost={confirmPost}
              onAskConfirm={() => setConfirmPost(true)}
              onCancelConfirm={() => setConfirmPost(false)}
              onPost={submitPost}
              onDiscard={submitDiscard}
            />
          )}
        </div>

        <aside className="space-y-6">
          {mode === 'receive' ? (
            <ReceivePanel
              warehouses={warehouses.data ?? []}
              warehouseId={warehouseId}
              locationId={locationId}
              onLocationChange={changeLocation}
              quantity={receiveQuantity}
              onQuantityChange={setReceiveQuantity}
              product={scannedProduct}
              canWrite={canWrite}
              posting={receive.isPending}
              busy={busy}
              onSubmit={submitReceive}
            />
          ) : (
            <>
              <CountWorkflowPanel
                count={count}
                product={scannedProduct}
                warehouses={warehouses.data ?? []}
                warehouseId={warehouseId}
                locationId={locationId}
                onLocationChange={changeLocation}
                quantity={countQuantity}
                onQuantityChange={setCountQuantity}
                mode={countMode}
                onModeChange={setCountMode}
                canWrite={canWrite}
                starting={startCount.isPending}
                recording={recordCount.isPending}
                busy={busy}
                onStart={submitStartCount}
                onRecord={submitRecord}
              />

              <OpenCountsPanel
                counts={openCounts.data?.items ?? []}
                loading={openCounts.isPending}
                activeCountId={activeCountId}
                onResume={resumeCount}
              />
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
