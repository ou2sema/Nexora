import { useState } from 'react';

import type {
  PurchaseOrderDetail,
  PurchaseReturnSummary,
  ReturnStatus,
  SalesOrderDetail,
  SalesReturnSummary,
} from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDevices } from '@/features/devices/api';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { saveBlob } from '@/lib/download';
import { fieldClass } from '@/lib/form-field';
import {
  useCancelPurchaseReturn,
  useCancelSalesReturn,
  useCreatePurchaseReturn,
  useCreateSalesReturn,
  useDownloadPurchaseReturnPdf,
  usePostPurchaseReturn,
  usePostSalesReturn,
  usePurchaseReturns,
  useSalesReturns,
} from './api';

export const returnStatusKeys: Record<ReturnStatus, MessageKey> = {
  draft: 'returns.status.draft',
  posted: 'returns.status.posted',
  cancelled: 'returns.status.cancelled',
};

export const returnStatusStyles: Record<ReturnStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  posted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-200',
};

function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        returnStatusStyles[status],
      )}
    >
      {t(returnStatusKeys[status])}
    </span>
  );
}

function parseQuantity(value: string): number {
  const quantity = Number(value.trim().replace(',', '.'));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

interface SerializedDevicePickerProps {
  organizationId: string;
  productId: string;
  productName: string;
  selected: string[];
  onChange: (deviceIds: string[]) => void;
}

function SerializedDevicePicker({
  organizationId,
  productId,
  productName,
  selected,
  onChange,
}: SerializedDevicePickerProps) {
  const { t } = useI18n();
  const devices = useDevices(organizationId, {
    search: '',
    status: 'in_stock',
    productId,
    page: 1,
    pageSize: 100,
  });

  const items = devices.data?.items ?? [];

  return (
    <div>
      <p className="text-xs font-medium text-slate-600">
        {t('returns.devicePicker.summary', { product: productName, selected: selected.length })}
      </p>
      {devices.isPending ? (
        <p className="mt-1 text-xs text-slate-500" role="status">
          {t('returns.devicePicker.loading')}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-1 text-xs text-amber-700">{t('returns.devicePicker.empty')}</p>
      ) : (
        <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {items.map((device) => (
            <label key={device.id} className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                aria-label={t('returns.devicePicker.deviceLabel', {
                  serial: device.serialNumber,
                })}
                checked={selected.includes(device.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, device.id]
                      : selected.filter((id) => id !== device.id),
                  )
                }
              />
              <span dir="ltr" className="font-mono">
                {device.serialNumber}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface PurchaseReturnDialogProps {
  organizationId: string;
  order: PurchaseOrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (message: string) => void;
}

function PurchaseReturnDialog({
  organizationId,
  order,
  open,
  onOpenChange,
  onCreated,
}: PurchaseReturnDialogProps) {
  const { t, errorMessage, formatQuantity } = useI18n();
  const mutation = useCreatePurchaseReturn(organizationId);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [devices, setDevices] = useState<Record<string, string[]>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const returnableLines = order.lines.filter(
    (line) => line.quantityReceived - line.quantityReturned > 0,
  );

  const reset = () => {
    setReason('');
    setReference('');
    setQuantities({});
    setDevices({});
    setLocalError(null);
  };

  const submit = async () => {
    if (reason.trim().length < 3) {
      setLocalError(t('returns.purchase.reasonTooShort'));
      return;
    }

    const lines = returnableLines.flatMap((line) => {
      if (line.isSerialized) {
        const deviceIds = devices[line.id] ?? [];
        return deviceIds.length > 0
          ? [{ purchaseOrderLineId: line.id, quantity: deviceIds.length, deviceIds }]
          : [];
      }

      const quantity = parseQuantity(quantities[line.id] ?? '');
      return quantity > 0 ? [{ purchaseOrderLineId: line.id, quantity }] : [];
    });

    if (lines.length === 0) {
      setLocalError(t('returns.purchase.emptySelection'));
      return;
    }

    try {
      const result = await mutation.mutateAsync({
        purchaseOrderId: order.id,
        input: { reason: reason.trim(), reference: reference.trim() || null, lines },
      });
      onCreated(t('returns.purchase.created', { number: result.number }));
      reset();
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  };

  const submitError = mutation.error ? errorMessage(mutation.error, 'returns.createFailed') : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t('returns.purchase.dialogTitle')}</DialogTitle>
        <DialogDescription>{t('returns.purchase.dialogDescription')}</DialogDescription>

        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="purchase-return-reason"
              className="block text-sm font-medium text-slate-700"
            >
              {t('common.reason')}
            </label>
            <input
              id="purchase-return-reason"
              type="text"
              className={fieldClass}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="purchase-return-reference"
              className="block text-sm font-medium text-slate-700"
            >
              {t('returns.form.referenceOptional')}
            </label>
            <input
              id="purchase-return-reference"
              type="text"
              dir="ltr"
              className={fieldClass}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>

          <div className="space-y-3">
            {returnableLines.map((line) => (
              <div key={line.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">
                  {line.productName}{' '}
                  <span dir="ltr" className="font-mono text-xs text-slate-500">
                    {line.productSku}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t('returns.purchase.returnable', {
                    returnable: formatQuantity(line.quantityReceived - line.quantityReturned),
                    received: formatQuantity(line.quantityReceived),
                  })}
                </p>
                <div className="mt-2">
                  {line.isSerialized ? (
                    <SerializedDevicePicker
                      organizationId={organizationId}
                      productId={line.productId}
                      productName={line.productName}
                      selected={devices[line.id] ?? []}
                      onChange={(deviceIds) =>
                        setDevices((current) => ({ ...current, [line.id]: deviceIds }))
                      }
                    />
                  ) : (
                    <input
                      aria-label={t('returns.form.quantityLabel', { sku: line.productSku })}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      className={fieldClass}
                      value={quantities[line.id] ?? ''}
                      onChange={(event) =>
                        setQuantities((current) => ({ ...current, [line.id]: event.target.value }))
                      }
                    />
                  )}
                </div>
              </div>
            ))}
            {returnableLines.length === 0 && (
              <p className="text-sm text-slate-500">{t('returns.purchase.allReturned')}</p>
            )}
          </div>

          {(localError || submitError) && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {localError ?? submitError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={mutation.isPending || returnableLines.length === 0}
              onClick={() => void submit()}
            >
              {mutation.isPending ? t('returns.form.creating') : t('returns.form.submit')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PurchaseReturnsSectionProps {
  organizationId: string;
  order: PurchaseOrderDetail;
  canWrite: boolean;
}

export function PurchaseReturnsSection({
  organizationId,
  order,
  canWrite,
}: PurchaseReturnsSectionProps) {
  const { t, errorMessage, formatQuantity } = useI18n();
  const returns = usePurchaseReturns(organizationId, order.id);
  const postMutation = usePostPurchaseReturn(organizationId);
  const cancelMutation = useCancelPurchaseReturn(organizationId);
  const downloadPdf = useDownloadPurchaseReturnPdf(organizationId);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pdfPendingId, setPdfPendingId] = useState<string | null>(null);

  const returnable = order.lines.some((line) => line.quantityReceived - line.quantityReturned > 0);
  const items: PurchaseReturnSummary[] = returns.data?.items ?? [];

  const post = async (returnId: string) => {
    setActionError(null);
    try {
      const result = await postMutation.mutateAsync({ purchaseOrderId: order.id, returnId });
      setNotice(t('returns.purchase.posted', { number: result.number }));
    } catch (error) {
      setActionError(errorMessage(error, 'returns.postFailed'));
    }
  };

  const cancel = async (returnId: string) => {
    setActionError(null);
    try {
      const result = await cancelMutation.mutateAsync({
        purchaseOrderId: order.id,
        returnId,
        input: {},
      });
      setNotice(t('returns.cancelled', { number: result.number }));
    } catch (error) {
      setActionError(errorMessage(error, 'returns.cancelFailed'));
    }
  };

  const download = async (item: PurchaseReturnSummary) => {
    setActionError(null);
    setPdfPendingId(item.id);
    try {
      const file = await downloadPdf(order.id, item.id);
      saveBlob(file.blob, file.filename);
      setNotice(t('returns.downloaded', { filename: file.filename }));
    } catch (error) {
      setActionError(errorMessage(error, 'returns.downloadFailed'));
    } finally {
      setPdfPendingId(null);
    }
  };

  return (
    <section aria-labelledby="purchase-returns-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="purchase-returns-heading" className="text-sm font-semibold text-slate-900">
            {t('returns.purchase.heading')}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{t('returns.purchase.help')}</p>
        </div>
        {canWrite && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!returnable}
            onClick={() => setCreateOpen(true)}
          >
            {t('returns.purchase.new')}
          </Button>
        )}
      </div>

      {returns.isError ? (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(returns.error, 'returns.loadFailed')}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t('returns.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('returns.columns.number')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('common.status')}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">
                  {t('common.quantity')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('common.reason')}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td dir="ltr" className="px-3 py-2 font-mono text-xs text-slate-800">
                    {item.number}
                  </td>
                  <td className="px-3 py-2">
                    <ReturnStatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2 text-end text-slate-700">
                    {formatQuantity(item.totalQuantity)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{item.reason}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      {canWrite && item.status === 'draft' && (
                        <>
                          <Button
                            size="sm"
                            disabled={postMutation.isPending}
                            onClick={() => void post(item.id)}
                          >
                            {t('returns.postAction')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={cancelMutation.isPending}
                            onClick={() => void cancel(item.id)}
                          >
                            {t('returns.cancelAction')}
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pdfPendingId === item.id}
                        onClick={() => void download(item)}
                      >
                        {pdfPendingId === item.id
                          ? t('returns.preparing')
                          : t('returns.downloadPdf')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {actionError}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {canWrite && (
        <PurchaseReturnDialog
          organizationId={organizationId}
          order={order}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(message) => setNotice(message)}
        />
      )}
    </section>
  );
}

interface SalesReturnDialogProps {
  organizationId: string;
  order: SalesOrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (message: string) => void;
}

function SalesReturnDialog({
  organizationId,
  order,
  open,
  onOpenChange,
  onCreated,
}: SalesReturnDialogProps) {
  const { t, errorMessage, formatQuantity } = useI18n();
  const mutation = useCreateSalesReturn(organizationId);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const returnableLines = order.lines.filter((line) => line.quantity - line.quantityReturned > 0);

  const reset = () => {
    setReason('');
    setReference('');
    setQuantities({});
    setLocalError(null);
  };

  const submit = async () => {
    if (reason.trim().length < 3) {
      setLocalError(t('returns.sales.reasonTooShort'));
      return;
    }

    const lines = returnableLines.flatMap((line) => {
      const quantity = parseQuantity(quantities[line.id] ?? '');
      return quantity > 0 ? [{ salesOrderLineId: line.id, quantity }] : [];
    });

    if (lines.length === 0) {
      setLocalError(t('returns.sales.emptySelection'));
      return;
    }

    try {
      const result = await mutation.mutateAsync({
        salesOrderId: order.id,
        input: { reason: reason.trim(), reference: reference.trim() || null, lines },
      });
      onCreated(t('returns.sales.created', { number: result.number }));
      reset();
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  };

  const submitError = mutation.error ? errorMessage(mutation.error, 'returns.createFailed') : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t('returns.sales.dialogTitle')}</DialogTitle>
        <DialogDescription>{t('returns.sales.dialogDescription')}</DialogDescription>

        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="sales-return-reason"
              className="block text-sm font-medium text-slate-700"
            >
              {t('common.reason')}
            </label>
            <input
              id="sales-return-reason"
              type="text"
              className={fieldClass}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="sales-return-reference"
              className="block text-sm font-medium text-slate-700"
            >
              {t('returns.form.referenceOptional')}
            </label>
            <input
              id="sales-return-reference"
              type="text"
              dir="ltr"
              className={fieldClass}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>

          <div className="space-y-3">
            {returnableLines.map((line) => (
              <div key={line.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">
                  {line.productName}{' '}
                  <span dir="ltr" className="font-mono text-xs text-slate-500">
                    {line.productSku}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t('returns.sales.returnable', {
                    returnable: formatQuantity(line.quantity - line.quantityReturned),
                    fulfilled: formatQuantity(line.quantity),
                  })}
                </p>
                <input
                  aria-label={t('returns.form.quantityLabel', { sku: line.productSku })}
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  className={fieldClass}
                  value={quantities[line.id] ?? ''}
                  onChange={(event) =>
                    setQuantities((current) => ({ ...current, [line.id]: event.target.value }))
                  }
                />
              </div>
            ))}
            {returnableLines.length === 0 && (
              <p className="text-sm text-slate-500">{t('returns.sales.allReturned')}</p>
            )}
          </div>

          {(localError || submitError) && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {localError ?? submitError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={mutation.isPending || returnableLines.length === 0}
              onClick={() => void submit()}
            >
              {mutation.isPending ? t('returns.form.creating') : t('returns.form.submit')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SalesReturnsSectionProps {
  organizationId: string;
  order: SalesOrderDetail;
  canWrite: boolean;
}

export function SalesReturnsSection({ organizationId, order, canWrite }: SalesReturnsSectionProps) {
  const { t, errorMessage, formatQuantity } = useI18n();
  const returns = useSalesReturns(organizationId, order.id);
  const postMutation = usePostSalesReturn(organizationId);
  const cancelMutation = useCancelSalesReturn(organizationId);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const returnable = order.lines.some((line) => line.quantity - line.quantityReturned > 0);
  const items: SalesReturnSummary[] = returns.data?.items ?? [];

  const post = async (returnId: string) => {
    setActionError(null);
    try {
      const result = await postMutation.mutateAsync({ salesOrderId: order.id, returnId });
      setNotice(t('returns.sales.posted', { number: result.number }));
    } catch (error) {
      setActionError(errorMessage(error, 'returns.postFailed'));
    }
  };

  const cancel = async (returnId: string) => {
    setActionError(null);
    try {
      const result = await cancelMutation.mutateAsync({
        salesOrderId: order.id,
        returnId,
        input: {},
      });
      setNotice(t('returns.cancelled', { number: result.number }));
    } catch (error) {
      setActionError(errorMessage(error, 'returns.cancelFailed'));
    }
  };

  return (
    <section aria-labelledby="sales-returns-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="sales-returns-heading" className="text-sm font-semibold text-slate-900">
            {t('returns.sales.heading')}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{t('returns.sales.help')}</p>
        </div>
        {canWrite && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!returnable}
            onClick={() => setCreateOpen(true)}
          >
            {t('returns.sales.new')}
          </Button>
        )}
      </div>

      {returns.isError ? (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(returns.error, 'returns.loadFailed')}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {t('returns.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('returns.columns.number')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('common.status')}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">
                  {t('common.quantity')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('common.reason')}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td dir="ltr" className="px-3 py-2 font-mono text-xs text-slate-800">
                    {item.number}
                  </td>
                  <td className="px-3 py-2">
                    <ReturnStatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2 text-end text-slate-700">
                    {formatQuantity(item.totalQuantity)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{item.reason}</td>
                  <td className="px-3 py-2">
                    {canWrite && item.status === 'draft' ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={postMutation.isPending}
                          onClick={() => void post(item.id)}
                        >
                          {t('returns.postAction')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cancelMutation.isPending}
                          onClick={() => void cancel(item.id)}
                        >
                          {t('returns.cancelAction')}
                        </Button>
                      </div>
                    ) : (
                      <span className="block text-end text-xs text-slate-400">
                        {t('common.notAvailable')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {actionError}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {canWrite && (
        <SalesReturnDialog
          organizationId={organizationId}
          order={order}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(message) => setNotice(message)}
        />
      )}
    </section>
  );
}
