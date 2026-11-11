import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Printer, Send, X } from 'lucide-react';

import type {
  PurchaseOrderLineSummary,
  PurchaseOrderSummary,
  PurchaseReceiptTrackedItem,
  ScanResult,
} from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  usePurchaseOrder,
  usePurchaseOrders,
  useReceivePurchaseOrder,
} from '@/features/operations/api';
import { purchaseOrderStatusKeys } from '@/features/operations/labels';
import { useI18n } from '@/i18n/provider';
import type { MessageKey, MessageValues } from '@/i18n/messages';
import { fieldClass } from '@/lib/form-field';

import {
  buildReceipt,
  clearLine,
  collectSerial,
  collectUnit,
  dockTotals,
  dropSerial,
  remainingQuantity,
  setUnits,
  unitsOf,
  type CollectOutcome,
  type DockState,
} from './dock-receipt';
import type { LabelTarget } from './label-dialog';

interface DockMessage {
  key: MessageKey;
  values?: MessageValues;
}

/** What the order line still expects, and what has been scanned against it so far. */
function lineProgress(line: PurchaseOrderLineSummary, state: DockState) {
  return { remaining: remainingQuantity(line), queued: unitsOf(line, state[line.id]) };
}

/**
 * Receiving reads an order the way the counter reads a shelf: the goods say what they
 * are and the order says where they go. A serial scan with no line chosen lands on the
 * order's only serialized line, so a pallet of phones is read without the keyboard
 * being touched once.
 */
export function useReceiveDock(organizationId: string | null) {
  const { t, plural, errorMessage, formatQuantity } = useI18n();
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [state, setState] = useState<DockState>({});
  const [collectorId, setCollectorId] = useState<string | null>(null);
  const [message, setMessage] = useState<DockMessage | null>(null);
  const [lastTrackedItems, setLastTrackedItems] = useState<PurchaseReceiptTrackedItem[]>([]);

  const ordered = usePurchaseOrders(organizationId, {
    search: '',
    status: 'ordered',
    supplierId: '',
    page: 1,
    pageSize: 50,
  });
  const partial = usePurchaseOrders(organizationId, {
    search: '',
    status: 'partially_received',
    supplierId: '',
    page: 1,
    pageSize: 50,
  });
  const order = usePurchaseOrder(organizationId, purchaseOrderId === '' ? null : purchaseOrderId);
  const receive = useReceivePurchaseOrder(organizationId ?? '');

  const openOrders = useMemo(() => {
    const byId = new Map<string, PurchaseOrderSummary>();
    for (const item of [...(ordered.data?.items ?? []), ...(partial.data?.items ?? [])]) {
      byId.set(item.id, item);
    }
    return [...byId.values()].sort((a, b) => b.number.localeCompare(a.number));
  }, [ordered.data, partial.data]);

  const lines = order.data?.lines ?? [];
  const loading = Boolean(purchaseOrderId) && order.isPending;
  const totals = dockTotals(state, lines);

  const collector = (): PurchaseOrderLineSummary | null => {
    const serialized = lines.filter((line) => line.isSerialized);
    if (collectorId) {
      const chosen = serialized.find((line) => line.id === collectorId);
      if (chosen) return chosen;
    }
    return serialized.length === 1 ? (serialized[0] ?? null) : null;
  };

  const voice = (
    outcome: CollectOutcome,
    line: PurchaseOrderLineSummary,
    code: string,
    next: DockState,
  ) => {
    const progress = lineProgress(line, next);

    if (outcome === 'full') {
      setMessage({ key: 'scan.dock.full', values: { product: line.productName } });
      return;
    }
    if (outcome === 'duplicate') {
      setMessage({ key: 'scan.dock.duplicate', values: { code } });
      return;
    }
    if (outcome === 'imei') {
      setMessage({ key: 'scan.dock.imeiQueued', values: { code, product: line.productName } });
      return;
    }
    if (outcome === 'serial') {
      setMessage({
        key: 'scan.dock.serialQueued',
        values: {
          code,
          product: line.productName,
          queued: formatQuantity(progress.queued),
          remaining: formatQuantity(progress.remaining),
        },
      });
      return;
    }
    setMessage({
      key: 'scan.dock.queued',
      values: {
        product: line.productName,
        quantity: formatQuantity(progress.queued),
        remaining: formatQuantity(progress.remaining),
      },
    });
  };

  /** A code the server resolved: the dock decides whether it belongs to this delivery. */
  const onResolved = (result: ScanResult) => {
    if (order.isError) {
      setMessage({ key: 'scan.dock.orderLoadFailed' });
      return;
    }
    if (!order.data) {
      setMessage({ key: openOrders.length === 0 ? 'scan.dock.noneShort' : 'scan.dock.noOrder' });
      return;
    }

    if (result.kind === 'tracked_item') {
      setMessage({
        key: 'scan.dock.alreadyRegisteredUnit',
        values: { code: result.item.unitCode, product: result.item.productName },
      });
      return;
    }

    if (result.kind === 'device') {
      const onOrder = lines.some((line) => line.productId === result.device.productId);
      setMessage({
        key: onOrder ? 'scan.dock.alreadyRegistered' : 'scan.dock.alreadyRegisteredBare',
        values: { serial: result.device.serialNumber, number: order.data.number },
      });
      return;
    }

    const line = lines.find((entry) => entry.productId === result.product.id);
    if (!line) {
      setMessage({
        key: 'scan.dock.notOnOrder',
        values: { product: result.product.name, number: order.data.number },
      });
      return;
    }

    if (line.isSerialized) {
      setCollectorId(line.id);
      const progress = lineProgress(line, state);
      setMessage({
        key: 'scan.dock.collecting',
        values: {
          product: line.productName,
          queued: formatQuantity(progress.queued),
          remaining: formatQuantity(progress.remaining),
        },
      });
      return;
    }

    const [next, outcome] = collectUnit(state, line);
    setState(next);
    voice(outcome, line, result.product.name, next);
  };

  /**
   * A code the server could not resolve is, at the dock, the serial of a unit that has
   * never been registered. It joins the serialized line being collected, and only a code
   * with no line to join falls through to the page's resolve error.
   */
  const onUnknown = (code: string): boolean => {
    const line = collector();
    if (!line) return false;

    const [next, outcome] = collectSerial(state, line, code);
    setState(next);
    voice(outcome, line, code.trim(), next);
    return true;
  };

  const onQuantityChange = (line: PurchaseOrderLineSummary, value: string) => {
    const [next] = setUnits(state, line, value);
    setState(next);
    setMessage(null);
  };

  const onRemoveSerial = (line: PurchaseOrderLineSummary, index: number) => {
    setState(dropSerial(state, line, index));
    setMessage(null);
  };

  const onClearLine = (lineId: string) => {
    setState(clearLine(state, lineId));
    if (collectorId === lineId) setCollectorId(null);
    setMessage(null);
  };

  const onChooseOrder = (id: string) => {
    setPurchaseOrderId(id);
    setState({});
    setCollectorId(null);
    setMessage(null);
    setLastTrackedItems([]);
  };

  const post = async () => {
    if (!order.data) return;

    const input = buildReceipt(state, lines);
    if (input.lines.length === 0) {
      setMessage({ key: 'scan.dock.empty' });
      return;
    }

    try {
      const result = await receive.mutateAsync({ purchaseOrderId: order.data.id, input });
      setState({});
      setCollectorId(null);
      setLastTrackedItems(result.trackedItems);
      // A finished order leaves the picker, so the next delivery is the one in the room.
      if (result.status === 'received') setPurchaseOrderId('');
      setMessage({
        key: 'scan.dock.posted',
        values: {
          number: result.number,
          quantity: plural('scan.dock.units', result.receivedQuantity),
          status: t(purchaseOrderStatusKeys[result.status]),
        },
      });
    } catch {
      // receive.error renders beside the post button.
    }
  };

  return {
    purchaseOrderId,
    onChooseOrder,
    order: order.data ?? null,
    loading,
    openOrders,
    lines,
    state,
    totals,
    collectorId: collector()?.id ?? null,
    lineProgress,
    onResolved,
    onUnknown,
    onQuantityChange,
    onRemoveSerial,
    onClearLine,
    post,
    posting: receive.isPending,
    postError: receive.error ? errorMessage(receive.error, 'purchasing.receipt.failed') : null,
    message,
    lastTrackedItems,
  };
}

export type ReceiveDockApi = ReturnType<typeof useReceiveDock>;

function DockLineRow({
  line,
  dock,
  canWrite,
  collecting,
}: {
  line: PurchaseOrderLineSummary;
  dock: ReceiveDockApi;
  canWrite: boolean;
  collecting: boolean;
}) {
  const { t, formatQuantity } = useI18n();
  const { remaining, queued } = dock.lineProgress(line, dock.state);
  const entry = dock.state[line.id];

  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{line.productName}</p>
          <p dir="ltr" className="font-mono text-xs text-slate-500">
            {line.productSku}
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {t('scan.dock.remaining', {
            count: formatQuantity(remaining),
            queued: formatQuantity(queued),
          })}
        </p>
      </div>

      {line.isSerialized ? (
        <div className="mt-2 space-y-2">
          {entry && entry.serials.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {entry.serials.map((serial, index) => (
                <li key={serial.serialNumber}>
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 font-mono text-xs text-indigo-900">
                    <span dir="ltr">
                      {serial.imei
                        ? `${serial.serialNumber} · ${serial.imei}`
                        : serial.serialNumber}
                    </span>
                    <button
                      type="button"
                      disabled={!canWrite || dock.posting}
                      aria-label={t('scan.dock.removeSerial', { serial: serial.serialNumber })}
                      className="rounded p-0.5 text-indigo-500 hover:bg-indigo-100"
                      onClick={() => dock.onRemoveSerial(line, index)}
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">{t('scan.dock.serialHelp')}</p>
          )}
          {collecting && (
            <p className="text-xs font-medium text-indigo-700">{t('scan.dock.collectingHere')}</p>
          )}
        </div>
      ) : (
        <label className="mt-2 block text-xs text-slate-600">
          {t('scan.dock.unitsNow')}
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            disabled={!canWrite || dock.posting || remaining === 0}
            value={entry ? String(entry.quantity) : ''}
            placeholder="0"
            className={`${fieldClass} mt-1`}
            onChange={(event) => dock.onQuantityChange(line, event.target.value)}
          />
        </label>
      )}

      {line.isIndividuallyTracked && (
        <p className="mt-1 text-xs text-slate-500">{t('scan.dock.trackedHint')}</p>
      )}

      {queued > 0 && (
        <button
          type="button"
          disabled={!canWrite || dock.posting}
          className="mt-2 text-xs font-semibold text-slate-500 underline-offset-2 hover:underline"
          onClick={() => dock.onClearLine(line.id)}
        >
          {t('scan.dock.clearLine')}
        </button>
      )}
    </li>
  );
}

export function ReceiveDock({
  dock,
  canWrite,
  onPrintLabels,
}: {
  dock: ReceiveDockApi;
  canWrite: boolean;
  onPrintLabels?: (targets: LabelTarget[]) => void;
}) {
  const { t, plural } = useI18n();
  const order = dock.order;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{t('scan.dock.title')}</h2>
      <p className="mt-1 text-sm text-slate-600">{t('scan.dock.description')}</p>

      {dock.openOrders.length === 0 && !dock.purchaseOrderId ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t('scan.dock.none')}{' '}
          <Link className="font-semibold text-indigo-700" to="/purchasing">
            {t('nav.purchasing')}
          </Link>
        </p>
      ) : (
        <label className="mt-4 block text-sm font-medium text-slate-700">
          {t('scan.dock.orderLabel')}
          <select
            id="dock-order"
            className={fieldClass}
            value={dock.purchaseOrderId}
            disabled={!canWrite || dock.posting}
            onChange={(event) => dock.onChooseOrder(event.target.value)}
          >
            <option value="">{t('scan.dock.orderPlaceholder')}</option>
            {dock.openOrders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.number} · {item.supplierName} ·{' '}
                {plural('scan.dock.units', item.totalQuantity)}
              </option>
            ))}
          </select>
        </label>
      )}

      {dock.loading && <p className="mt-3 text-sm text-slate-500">{t('scan.dock.loading')}</p>}

      {order && (
        <>
          <p className="mt-3 text-sm text-slate-600">
            {t('scan.dock.goesTo', { location: `${order.warehouseCode} / ${order.locationCode}` })}
          </p>

          <ul className="mt-3 space-y-2">
            {order.lines
              .filter((line) => remainingQuantity(line) > 0)
              .map((line) => (
                <DockLineRow
                  key={line.id}
                  line={line}
                  dock={dock}
                  canWrite={canWrite}
                  collecting={dock.collectorId === line.id}
                />
              ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              disabled={!canWrite || dock.posting || dock.totals.open === 0}
              onClick={() => void dock.post()}
            >
              <Send aria-hidden="true" className="size-4" />
              {dock.posting
                ? t('scan.dock.posting')
                : t('scan.dock.post', {
                    quantity: plural('scan.dock.units', dock.totals.units),
                    lines: plural('scan.dock.lines', dock.totals.open),
                  })}
            </Button>
          </div>
        </>
      )}

      {/* A fully received order leaves the picker, so its confirmation and the labels
          for the units just registered must render outside the order block. */}
      {(dock.postError || dock.message || (dock.lastTrackedItems.length > 0 && onPrintLabels)) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {dock.postError ? (
            <p role="alert" className="text-sm text-rose-700">
              {dock.postError}
            </p>
          ) : (
            dock.message && (
              <p role="status" className="text-sm text-slate-600">
                {t(dock.message.key, dock.message.values)}
              </p>
            )
          )}

          {dock.lastTrackedItems.length > 0 && onPrintLabels && (
            <Button
              variant="secondary"
              disabled={dock.posting}
              onClick={() =>
                onPrintLabels(
                  dock.lastTrackedItems.map((item) => ({
                    kind: 'item',
                    id: item.id,
                    title: item.unitCode,
                  })),
                )
              }
            >
              <Printer aria-hidden="true" className="size-4" />
              {t('scan.dock.printUnitLabels', {
                labels: plural('scan.dock.units', dock.lastTrackedItems.length),
              })}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
