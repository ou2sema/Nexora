import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { ProductSummary, SupplierSummary, WarehouseSummary } from '@mystock/contracts';
import { toMinorUnits } from '@mystock/domain';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { WarehouseLocationFields } from '@/components/ui/warehouse-location-fields';
import type { MessageKey, MessageValues } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { saveBlob } from '@/lib/download';
import { fieldClass } from '@/lib/form-field';
import {
  useCreatePurchaseOrder,
  useCancelPurchaseOrder,
  useDownloadPurchaseOrderPdf,
  useOrderPurchaseOrder,
  usePurchaseOrder,
  useReceivePurchaseOrder,
} from './api';
import { purchaseOrderStatusKeys, purchaseOrderStatusStyles } from './labels';
import { PurchaseReturnsSection } from './return-dialogs';

type Translator = (key: MessageKey, values?: MessageValues) => string;

function parsePriceInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;

  try {
    return toMinorUnits(amount);
  } catch {
    return null;
  }
}

function buildCreateSchema(t: Translator) {
  const priceField = z
    .string()
    .trim()
    .refine((value) => value === '' || parsePriceInput(value) !== null, {
      message: t('purchasing.form.invalidPrice'),
    });

  const quantityField = z
    .string()
    .trim()
    .refine((value) => /^\d+(\.\d{1,4})?$/.test(value) && Number(value) > 0, {
      message: t('purchasing.form.invalidQuantity'),
    });

  const lineSchema = z.object({
    productId: z.string().min(1, t('purchasing.form.selectProduct')),
    quantity: quantityField,
    unitCost: priceField,
  });

  return z
    .object({
      supplierId: z.string().min(1, t('purchasing.create.selectSupplier')),
      warehouseId: z.string().min(1, t('common.selectWarehouse')),
      locationId: z.string().min(1, t('common.selectLocation')),
      expectedOn: z.string(),
      reference: z.string().trim().max(120),
      notes: z.string().trim().max(2000),
      lines: z.array(lineSchema).min(1, t('purchasing.form.addLineRequired')).max(100),
    })
    .refine(
      (values) => new Set(values.lines.map((line) => line.productId)).size === values.lines.length,
      { message: t('purchasing.form.duplicateProduct'), path: ['lines'] },
    );
}

type CreateValues = z.infer<ReturnType<typeof buildCreateSchema>>;

const emptyLine = { productId: '', quantity: '', unitCost: '' };

interface CreatePurchaseOrderDialogProps {
  organizationId: string;
  suppliers: SupplierSummary[];
  warehouses: WarehouseSummary[];
  products: ProductSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePurchaseOrderDialog({
  organizationId,
  suppliers,
  warehouses,
  products,
  open,
  onOpenChange,
}: CreatePurchaseOrderDialogProps) {
  const { t, errorMessage } = useI18n();
  const mutation = useCreatePurchaseOrder(organizationId);
  const createSchema = useMemo(() => buildCreateSchema(t), [t]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      supplierId: '',
      warehouseId: '',
      locationId: '',
      expectedOn: '',
      reference: '',
      notes: '',
      lines: [emptyLine],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const warehouseId = watch('warehouseId');

  useEffect(() => {
    if (open) {
      reset({
        supplierId: '',
        warehouseId: '',
        locationId: '',
        expectedOn: '',
        reference: '',
        notes: '',
        lines: [emptyLine],
      });
    }
  }, [open, reset]);

  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive);
  const createError = mutation.error
    ? errorMessage(mutation.error, 'purchasing.create.failed')
    : null;

  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        supplierId: values.supplierId,
        warehouseId: values.warehouseId,
        locationId: values.locationId,
        expectedOn: values.expectedOn || null,
        reference: values.reference || null,
        notes: values.notes || null,
        lines: values.lines.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          unitCostMinor: parsePriceInput(line.unitCost),
        })),
      });
      reset();
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{t('purchasing.newOrder')}</DialogTitle>
        <DialogDescription>{t('purchasing.create.description')}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="po-supplier" className="block text-sm font-medium text-slate-700">
              {t('common.supplier')}
            </label>
            <select id="po-supplier" className={fieldClass} {...register('supplierId')}>
              <option value="">{t('purchasing.create.selectSupplier')}</option>
              {activeSuppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            {errors.supplierId && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                {errors.supplierId.message}
              </p>
            )}
            {activeSuppliers.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">{t('purchasing.create.noSuppliers')}</p>
            )}
          </div>

          <WarehouseLocationFields
            idPrefix="po"
            warehouses={warehouses}
            warehouseField={register('warehouseId')}
            locationField={register('locationId')}
            selectedWarehouseId={warehouseId}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="po-expected" className="block text-sm font-medium text-slate-700">
                {t('purchasing.form.expectedDateOptional')}
              </label>
              <input
                id="po-expected"
                type="date"
                className={fieldClass}
                {...register('expectedOn')}
              />
            </div>
            <div>
              <label htmlFor="po-reference" className="block text-sm font-medium text-slate-700">
                {t('purchasing.form.supplierReferenceOptional')}
              </label>
              <input
                id="po-reference"
                type="text"
                dir="ltr"
                className={fieldClass}
                {...register('reference')}
              />
            </div>
          </div>

          <section aria-labelledby="po-lines-heading">
            <div className="flex items-center justify-between">
              <h3 id="po-lines-heading" className="text-sm font-semibold text-slate-900">
                {t('purchasing.form.lines')}
              </h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => append(emptyLine)}>
                <Plus aria-hidden="true" className="size-4" />
                {t('purchasing.form.addLine')}
              </Button>
            </div>

            <div className="mt-2 space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]"
                >
                  <div>
                    <label
                      htmlFor={`po-line-product-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t('common.product')}
                    </label>
                    <select
                      id={`po-line-product-${index}`}
                      className={fieldClass}
                      {...register(`lines.${index}.productId`)}
                    >
                      <option value="">{t('purchasing.form.selectProduct')}</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`po-line-quantity-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t('common.quantity')}
                    </label>
                    <input
                      id={`po-line-quantity-${index}`}
                      type="text"
                      inputMode="decimal"
                      className={fieldClass}
                      {...register(`lines.${index}.quantity`)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`po-line-cost-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t('purchasing.form.unitCost')}
                    </label>
                    <input
                      id={`po-line-cost-${index}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.000"
                      className={fieldClass}
                      {...register(`lines.${index}.unitCost`)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t('purchasing.form.removeLine', { index: index + 1 })}
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                  {errors.lines?.[index]?.productId && (
                    <p role="alert" className="text-xs text-rose-700 sm:col-span-4">
                      {errors.lines[index]?.productId?.message}
                    </p>
                  )}
                  {errors.lines?.[index]?.quantity && (
                    <p role="alert" className="text-xs text-rose-700 sm:col-span-4">
                      {errors.lines[index]?.quantity?.message}
                    </p>
                  )}
                  {errors.lines?.[index]?.unitCost && (
                    <p role="alert" className="text-xs text-rose-700 sm:col-span-4">
                      {errors.lines[index]?.unitCost?.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {errors.lines?.message && (
              <p role="alert" className="mt-2 text-xs text-rose-700">
                {errors.lines.message}
              </p>
            )}
          </section>

          <div>
            <label htmlFor="po-notes" className="block text-sm font-medium text-slate-700">
              {t('purchasing.form.notesOptional')}
            </label>
            <textarea id="po-notes" rows={2} className={fieldClass} {...register('notes')} />
          </div>

          {createError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {createError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('purchasing.create.creating') : t('purchasing.create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ReceiptState {
  quantity: string;
  serials: string;
}

function parseSerials(value: string): { serialNumber: string; imei?: string }[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [serialNumber = '', imei = ''] = entry.split('|').map((part) => part.trim());
      return imei ? { serialNumber, imei } : { serialNumber };
    });
}

interface PurchaseOrderDetailDialogProps {
  organizationId: string;
  purchaseOrderId: string | null;
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseOrderDetailDialog({
  organizationId,
  purchaseOrderId,
  canWrite,
  onOpenChange,
}: PurchaseOrderDetailDialogProps) {
  const { t, plural, errorMessage, formatQuantity, formatMoney } = useI18n();
  const order = usePurchaseOrder(organizationId, purchaseOrderId);
  const orderMutation = useOrderPurchaseOrder(organizationId);
  const receiveMutation = useReceivePurchaseOrder(organizationId);
  const cancelMutation = useCancelPurchaseOrder(organizationId);
  const downloadPdf = useDownloadPurchaseOrderPdf(organizationId);

  const [receipt, setReceipt] = useState<Record<string, ReceiptState>>({});
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    setReceipt({});
    setReason('');
    setNotice(null);
    setPdfError(null);
  }, [purchaseOrderId]);

  const data = order.data;
  const receivable = data?.status === 'ordered' || data?.status === 'partially_received';
  const cancellable = data?.status === 'draft' || data?.status === 'ordered';
  const openLines =
    data?.lines.filter((line) => line.quantityOrdered - line.quantityReceived > 0) ?? [];

  const receiveError = receiveMutation.error
    ? errorMessage(receiveMutation.error, 'purchasing.receipt.failed')
    : null;
  const cancelError = cancelMutation.error
    ? errorMessage(cancelMutation.error, 'purchasing.cancel.failed')
    : null;
  const orderError = orderMutation.error
    ? errorMessage(orderMutation.error, 'purchasing.order.failed')
    : null;

  const downloadOrderPdf = async (orderId: string) => {
    setPdfError(null);
    setPdfPending(true);
    try {
      const file = await downloadPdf(orderId);
      saveBlob(file.blob, file.filename);
      setNotice(t('purchasing.detail.downloaded', { filename: file.filename }));
    } catch (error) {
      setPdfError(errorMessage(error, 'purchasing.detail.pdfFailed'));
    } finally {
      setPdfPending(false);
    }
  };

  const submitReceipt = async () => {
    if (!data) return;

    const lines = openLines.flatMap((line) => {
      const state = receipt[line.id];
      if (!state) return [];

      if (line.isSerialized) {
        const serials = parseSerials(state.serials);
        return serials.length > 0 ? [{ lineId: line.id, quantity: serials.length, serials }] : [];
      }

      const quantity = Number(state.quantity);
      return Number.isFinite(quantity) && quantity > 0 ? [{ lineId: line.id, quantity }] : [];
    });

    if (lines.length === 0) {
      setNotice(t('purchasing.receipt.empty'));
      return;
    }

    try {
      const result = await receiveMutation.mutateAsync({
        purchaseOrderId: data.id,
        input: { lines },
      });
      setNotice(
        plural('purchasing.receipt.posted', result.receivedQuantity, {
          status: t(purchaseOrderStatusKeys[result.status]),
        }),
      );
      setReceipt({});
    } catch {
      // mutation.error renders below.
    }
  };

  return (
    <Dialog open={Boolean(purchaseOrderId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>
          {data ? (
            <>
              <span dir="ltr">{data.number}</span> · {data.supplierName}
            </>
          ) : (
            t('purchasing.detail.title')
          )}
        </DialogTitle>
        <DialogDescription>
          {data
            ? t('purchasing.detail.subtitle', {
                status: t(purchaseOrderStatusKeys[data.status]),
                warehouse: data.warehouseCode,
                location: data.locationCode,
              })
            : t('purchasing.detail.loading')}
        </DialogDescription>

        {order.isError ? (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errorMessage(order.error, 'purchasing.detail.loadFailed')}
          </p>
        ) : data ? (
          <div className="mt-5 space-y-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={pdfPending}
                onClick={() => void downloadOrderPdf(data.id)}
              >
                {pdfPending
                  ? t('purchasing.detail.preparingPdf')
                  : t('purchasing.detail.downloadPdf')}
              </Button>
            </div>

            {pdfError && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {pdfError}
              </p>
            )}

            <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('common.status')}
                </dt>
                <dd className="mt-1">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                      purchaseOrderStatusStyles[data.status],
                    )}
                  >
                    {t(purchaseOrderStatusKeys[data.status])}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('purchasing.columns.expected')}
                </dt>
                <dd className="mt-1 text-slate-800">
                  {data.expectedOn ?? t('common.notAvailable')}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('common.reference')}
                </dt>
                <dd className="mt-1 text-slate-800">
                  {data.reference ?? t('common.notAvailable')}
                </dd>
              </div>
            </dl>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      {t('common.product')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">
                      {t('purchasing.detail.ordered')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">
                      {t('purchasing.detail.received')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">
                      {t('purchasing.detail.returned')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">
                      {t('purchasing.detail.unitCost')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2">
                        <p className="text-slate-800">{line.productName}</p>
                        <p dir="ltr" className="font-mono text-xs text-slate-500">
                          {line.productSku}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-end text-slate-700">
                        {formatQuantity(line.quantityOrdered)}
                      </td>
                      <td className="px-3 py-2 text-end text-slate-700">
                        {formatQuantity(line.quantityReceived)}
                      </td>
                      <td className="px-3 py-2 text-end text-slate-700">
                        {formatQuantity(line.quantityReturned)}
                      </td>
                      <td className="px-3 py-2 text-end text-slate-700">
                        {line.unitCostMinor === null
                          ? t('common.notAvailable')
                          : formatMoney(line.unitCostMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {notice && (
              <p
                role="status"
                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                {notice}
              </p>
            )}

            {canWrite && receivable && openLines.length > 0 && (
              <section
                aria-labelledby="po-receipt-heading"
                className="rounded-lg border border-slate-200 p-4"
              >
                <h3 id="po-receipt-heading" className="text-sm font-semibold text-slate-900">
                  {t('purchasing.receipt.heading')}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{t('purchasing.receipt.help')}</p>
                <div className="mt-3 space-y-3">
                  {openLines.map((line) => {
                    const state = receipt[line.id] ?? { quantity: '', serials: '' };

                    return (
                      <div key={line.id} className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{line.productName}</p>
                          <p className="text-xs text-slate-500">
                            {t('purchasing.receipt.remaining', {
                              count: formatQuantity(line.quantityOrdered - line.quantityReceived),
                            })}
                          </p>
                        </div>
                        {line.isSerialized ? (
                          <textarea
                            aria-label={t('purchasing.receipt.serialsLabel', {
                              sku: line.productSku,
                            })}
                            rows={2}
                            placeholder="SN-0001|356789012345671"
                            className={fieldClass}
                            value={state.serials}
                            onChange={(event) =>
                              setReceipt((current) => ({
                                ...current,
                                [line.id]: { ...state, serials: event.target.value },
                              }))
                            }
                          />
                        ) : (
                          <input
                            aria-label={t('purchasing.receipt.quantityLabel', {
                              sku: line.productSku,
                            })}
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            className={fieldClass}
                            value={state.quantity}
                            onChange={(event) =>
                              setReceipt((current) => ({
                                ...current,
                                [line.id]: { ...state, quantity: event.target.value },
                              }))
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {receiveError && (
                  <p role="alert" className="mt-3 text-xs text-rose-700">
                    {receiveError}
                  </p>
                )}
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={receiveMutation.isPending}
                  onClick={() => void submitReceipt()}
                >
                  {receiveMutation.isPending
                    ? t('purchasing.receipt.receiving')
                    : t('purchasing.receipt.submit')}
                </Button>
              </section>
            )}

            {data.lines.some((line) => line.quantityReceived > 0) && (
              <PurchaseReturnsSection
                organizationId={organizationId}
                order={data}
                canWrite={canWrite}
              />
            )}

            {canWrite && data.status === 'draft' && (
              <section aria-labelledby="po-order-heading">
                <h3 id="po-order-heading" className="text-sm font-semibold text-slate-900">
                  {t('purchasing.order.heading')}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{t('purchasing.order.help')}</p>
                {orderError && (
                  <p role="alert" className="mt-2 text-xs text-rose-700">
                    {orderError}
                  </p>
                )}
                <Button
                  className="mt-2"
                  size="sm"
                  disabled={orderMutation.isPending}
                  onClick={async () => {
                    try {
                      const result = await orderMutation.mutateAsync(data.id);
                      setNotice(
                        t('purchasing.detail.nowStatus', {
                          number: result.number,
                          status: t(purchaseOrderStatusKeys[result.status]).toLowerCase(),
                        }),
                      );
                    } catch {
                      // mutation.error renders above.
                    }
                  }}
                >
                  {orderMutation.isPending
                    ? t('purchasing.order.updating')
                    : t('purchasing.order.submit')}
                </Button>
              </section>
            )}

            {canWrite && cancellable && (
              <section
                aria-labelledby="po-cancel-heading"
                className="rounded-lg border border-rose-100 bg-rose-50/50 p-4"
              >
                <h3 id="po-cancel-heading" className="text-sm font-semibold text-slate-900">
                  {t('purchasing.cancel.heading')}
                </h3>
                <p className="mt-1 text-xs text-slate-600">{t('purchasing.cancel.help')}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label={t('purchasing.cancel.reasonLabel')}
                    type="text"
                    placeholder={t('purchasing.cancel.reasonPlaceholder')}
                    className={fieldClass}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={cancelMutation.isPending}
                    onClick={async () => {
                      try {
                        const result = await cancelMutation.mutateAsync({
                          purchaseOrderId: data.id,
                          input: { reason: reason || null },
                        });
                        setNotice(t('purchasing.detail.cancelled', { number: result.number }));
                        setReason('');
                      } catch {
                        // mutation.error renders below.
                      }
                    }}
                  >
                    {cancelMutation.isPending
                      ? t('purchasing.cancel.cancelling')
                      : t('purchasing.cancel.submit')}
                  </Button>
                </div>
                {cancelError && (
                  <p role="alert" className="mt-2 text-xs text-rose-700">
                    {cancelError}
                  </p>
                )}
              </section>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500" role="status">
            {t('purchasing.detail.loadingOrder')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
