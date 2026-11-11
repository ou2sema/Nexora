import { Printer, Smartphone } from 'lucide-react';
import { Link } from 'react-router';

import type { ScanResult, TrackedItemEventType, TrackedItemStatus } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  deviceConditionKeys,
  deviceStatusKeys,
  deviceStatusStyles,
} from '@/features/devices/labels';
import { useI18n } from '@/i18n/provider';
import type { MessageKey } from '@/i18n/messages';
import { cn } from '@/lib/cn';

import type { LabelTarget } from './label-dialog';

const trackedStatusStyles: Record<TrackedItemStatus, string> = {
  in_stock: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  sold: 'bg-slate-100 text-slate-600 ring-slate-200',
  returned: 'bg-amber-50 text-amber-700 ring-amber-200',
  lost: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const trackedStatusKeys: Record<TrackedItemStatus, MessageKey> = {
  in_stock: 'scan.trackedStatus.in_stock',
  sold: 'scan.trackedStatus.sold',
  returned: 'scan.trackedStatus.returned',
  lost: 'scan.trackedStatus.lost',
};

const trackedEventKeys: Record<TrackedItemEventType, MessageKey> = {
  received: 'scan.trackedEvent.received',
  moved: 'scan.trackedEvent.moved',
  sold: 'scan.trackedEvent.sold',
  returned: 'scan.trackedEvent.returned',
  marked_lost: 'scan.trackedEvent.marked_lost',
  status_changed: 'scan.trackedEvent.status_changed',
};

export function ScanResultCard({
  result,
  onPrint,
}: {
  result: ScanResult;
  onPrint: (targets: LabelTarget[]) => void;
}) {
  const { t, formatQuantity, formatDateTime } = useI18n();

  if (result.kind === 'tracked_item') {
    const { item, product, events } = result;
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {t('scan.result.trackedItem')}
            </p>
            <h2 dir="ltr" className="mt-1 font-mono text-lg font-semibold text-slate-900">
              {item.unitCode}
            </h2>
            <p className="text-sm text-slate-600">
              {product.name} · {product.sku}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
              trackedStatusStyles[item.status],
            )}
          >
            {t(trackedStatusKeys[item.status])}
          </span>
        </header>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{t('scan.result.productBarcode')}</dt>
            <dd dir="ltr" className="font-mono text-slate-900">
              {product.barcode ?? t('scan.result.notAssigned')}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('scan.result.serialNumber')}</dt>
            <dd dir="ltr" className="font-mono text-slate-900">
              {item.serialNumber ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('scan.result.imei')}</dt>
            <dd dir="ltr" className="font-mono text-slate-900">
              {item.imei ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('common.location')}</dt>
            <dd dir="ltr" className="font-mono text-slate-900">
              {item.warehouseCode} / {item.locationCode}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('scan.result.received')}</dt>
            <dd className="text-slate-900">{formatDateTime(item.receivedAt)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('scan.result.purchaseOrder')}</dt>
            <dd dir="ltr" className="font-mono text-slate-900">
              {item.purchaseOrderNumber ?? '—'}
            </dd>
          </div>
        </dl>

        <h3 className="mt-5 text-sm font-semibold text-slate-900">{t('scan.result.history')}</h3>
        {events.length > 0 ? (
          <ol className="mt-2 space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    {t(trackedEventKeys[event.eventType])}
                  </span>
                  <span className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</span>
                </div>
                {event.note && <p className="mt-1 text-xs text-slate-600">{event.note}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{t('scan.result.noHistory')}</p>
        )}

        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onPrint([
                {
                  kind: 'item',
                  id: item.id,
                  title: `${item.unitCode} — ${product.name}`,
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
