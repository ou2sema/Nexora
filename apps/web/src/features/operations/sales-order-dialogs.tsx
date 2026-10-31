import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { ProductSummary, WarehouseSummary } from '@mystock/contracts';
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
import { fieldClass } from '@/lib/form-field';
import {
  useCancelSalesOrder,
  useConfirmSalesOrder,
  useCreateSalesOrder,
  useFulfilSalesOrder,
  useSalesOrder,
} from './api';
import { salesOrderStatusKeys, salesOrderStatusStyles } from './labels';
import { SalesReturnsSection } from './return-dialogs';

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
      message: t('sales.form.invalidPrice'),
    });

  const quantityField = z
    .string()
    .trim()
    .refine((value) => /^\d+(\.\d{1,4})?$/.test(value) && Number(value) > 0, {
      message: t('sales.form.invalidQuantity'),
    });

  const lineSchema = z.object({
    productId: z.string().min(1, t('sales.form.selectProduct')),
    quantity: quantityField,
    unitPrice: priceField,
  });

  return z
    .object({
      customerName: z.string().trim().min(1, t('sales.form.customerNameRequired')).max(160),
      customerEmail: z
        .string()
        .trim()
        .max(254)
        .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
          message: t('sales.form.invalidEmail'),
        }),
      customerPhone: z.string().trim().max(40),
      warehouseId: z.string().min(1, t('common.selectWarehouse')),
      locationId: z.string().min(1, t('common.selectLocation')),
      reference: z.string().trim().max(120),
      notes: z.string().trim().max(2000),
      lines: z.array(lineSchema).min(1, t('sales.form.addLineRequired')).max(100),
    })
    .refine(
      (values) => new Set(values.lines.map((line) => line.productId)).size === values.lines.length,
      { message: t('sales.form.duplicateProduct'), path: ['lines'] },
    );
}

type CreateValues = z.infer<ReturnType<typeof buildCreateSchema>>;

const emptyLine = { productId: '', quantity: '', unitPrice: '' };

interface CreateSalesOrderDialogProps {
  organizationId: string;
  warehouses: WarehouseSummary[];
  products: ProductSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSalesOrderDialog({
  organizationId,
  warehouses,
  products,
  open,
  onOpenChange,
}: CreateSalesOrderDialogProps) {
  const { t, errorMessage } = useI18n();
  const mutation = useCreateSalesOrder(organizationId);
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
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      warehouseId: '',
      locationId: '',
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
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        warehouseId: '',
        locationId: '',
        reference: '',
        notes: '',
        lines: [emptyLine],
      });
    }
  }, [open, reset]);

  const sellableProducts = products.filter(
    (product) => product.status === 'active' && !product.isSerialized,
  );
  const createError = mutation.error ? errorMessage(mutation.error, 'sales.create.failed') : null;

  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        customerName: values.customerName,
        customerEmail: values.customerEmail || null,
        customerPhone: values.customerPhone || null,
        warehouseId: values.warehouseId,
        locationId: values.locationId,
        reference: values.reference || null,
        notes: values.notes || null,
        lines: values.lines.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          unitPriceMinor: parsePriceInput(line.unitPrice),
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
        <DialogTitle>{t('sales.newOrder')}</DialogTitle>
        <DialogDescription>{t('sales.create.description')}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="so-customer" className="block text-sm font-medium text-slate-700">
                {t('sales.form.customerName')}
              </label>
              <input
                id="so-customer"
                type="text"
                className={fieldClass}
                aria-invalid={Boolean(errors.customerName)}
                {...register('customerName')}
              />
              {errors.customerName && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.customerName.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="so-reference" className="block text-sm font-medium text-slate-700">
                {t('sales.form.referenceOptional')}
              </label>
              <input
                id="so-reference"
                type="text"
                dir="ltr"
                className={fieldClass}
                {...register('reference')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="so-email" className="block text-sm font-medium text-slate-700">
                {t('sales.form.emailOptional')}
              </label>
              <input
                id="so-email"
                type="email"
                dir="ltr"
                className={fieldClass}
                aria-invalid={Boolean(errors.customerEmail)}
                {...register('customerEmail')}
              />
              {errors.customerEmail && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.customerEmail.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="so-phone" className="block text-sm font-medium text-slate-700">
                {t('sales.form.phoneOptional')}
              </label>
              <input
                id="so-phone"
                type="tel"
                dir="ltr"
                className={fieldClass}
                {...register('customerPhone')}
              />
            </div>
          </div>

          <WarehouseLocationFields
            idPrefix="so"
            warehouses={warehouses}
            warehouseField={register('warehouseId')}
            locationField={register('locationId')}
            selectedWarehouseId={warehouseId}
          />

          <section aria-labelledby="so-lines-heading">
            <div className="flex items-center justify-between">
              <h3 id="so-lines-heading" className="text-sm font-semibold text-slate-900">
                {t('sales.form.lines')}
              </h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => append(emptyLine)}>
                <Plus aria-hidden="true" className="size-4" />
                {t('sales.form.addLine')}
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('sales.form.linesHint')}</p>

            <div className="mt-2 space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]"
                >
                  <div>
                    <label
                      htmlFor={`so-line-product-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t('common.product')}
                    </label>
                    <select
                      id={`so-line-product-${index}`}
                      className={fieldClass}
                      {...register(`lines.${index}.productId`)}
                    >
                      <option value="">{t('sales.form.selectProduct')}</option>
                      {sellableProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`so-line-quantity-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t('common.quantity')}
                    </label>
                    <input
                      id={`so-line-quantity-${index}`}
                      type="text"
                      inputMode="decimal"
                      className={fieldClass}
                      {...register(`lines.${index}.quantity`)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`so-line-price-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t('sales.form.unitPrice')}
                    </label>
                    <input
                      id={`so-line-price-${index}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.000"
                      className={fieldClass}
                      {...register(`lines.${index}.unitPrice`)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t('sales.form.removeLine', { index: index + 1 })}
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
                  {errors.lines?.[index]?.unitPrice && (
                    <p role="alert" className="text-xs text-rose-700 sm:col-span-4">
                      {errors.lines[index]?.unitPrice?.message}
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
            <label htmlFor="so-notes" className="block text-sm font-medium text-slate-700">
              {t('sales.form.notesOptional')}
            </label>
            <textarea id="so-notes" rows={2} className={fieldClass} {...register('notes')} />
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
              {mutation.isPending ? t('sales.create.creating') : t('sales.create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface SalesOrderDetailDialogProps {
  organizationId: string;
  salesOrderId: string | null;
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SalesOrderDetailDialog({
  organizationId,
  salesOrderId,
  canWrite,
  onOpenChange,
}: SalesOrderDetailDialogProps) {
  const { t, plural, errorMessage, formatQuantity, formatMoney } = useI18n();
  const order = useSalesOrder(organizationId, salesOrderId);
  const confirmMutation = useConfirmSalesOrder(organizationId);
  const fulfilMutation = useFulfilSalesOrder(organizationId);
  const cancelMutation = useCancelSalesOrder(organizationId);

  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setReason('');
    setNotice(null);
  }, [salesOrderId]);

  const data = order.data;
  const cancellable = data?.status === 'draft' || data?.status === 'confirmed';

  const confirmError = confirmMutation.error
    ? errorMessage(confirmMutation.error, 'sales.detail.confirmFailed')
    : null;
  const fulfilError = fulfilMutation.error
    ? errorMessage(fulfilMutation.error, 'sales.detail.fulfilFailed')
    : null;
  const cancelError = cancelMutation.error
    ? errorMessage(cancelMutation.error, 'sales.detail.cancelFailed')
    : null;

  return (
    <Dialog open={Boolean(salesOrderId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>
          {data ? (
            <>
              <span dir="ltr">{data.number}</span> · {data.customerName}
            </>
          ) : (
            t('sales.detail.title')
          )}
        </DialogTitle>
        <DialogDescription>
          {data
            ? t('sales.detail.subtitle', {
                status: t(salesOrderStatusKeys[data.status]),
                warehouse: data.warehouseCode,
                location: data.locationCode,
              })
            : t('sales.detail.loading')}
        </DialogDescription>

        {order.isError ? (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errorMessage(order.error, 'sales.detail.loadFailed')}
          </p>
        ) : data ? (
          <div className="mt-5 space-y-6">
            <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('common.status')}
                </dt>
                <dd className="mt-1">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                      salesOrderStatusStyles[data.status],
                    )}
                  >
                    {t(salesOrderStatusKeys[data.status])}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('sales.detail.contact')}
                </dt>
                <dd className="mt-1 text-slate-800">
                  {data.customerEmail ?? data.customerPhone ?? t('common.notAvailable')}
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
                      {t('common.quantity')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">
                      {t('sales.detail.returned')}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-semibold">
                      {t('sales.detail.unitPrice')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      {t('sales.detail.reservation')}
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
                        {formatQuantity(line.quantity)}
                      </td>
                      <td className="px-3 py-2 text-end text-slate-700">
                        {formatQuantity(line.quantityReturned)}
                      </td>
                      <td className="px-3 py-2 text-end text-slate-700">
                        {line.unitPriceMinor === null
                          ? t('common.notAvailable')
                          : formatMoney(line.unitPriceMinor)}
                      </td>
                      <td dir="ltr" className="px-3 py-2 font-mono text-xs text-slate-500">
                        {line.reservationId
                          ? `${line.reservationId.slice(0, 8)}…`
                          : t('common.notAvailable')}
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

            {canWrite && (
              <div className="flex flex-wrap gap-2">
                {data.status === 'draft' && (
                  <Button
                    size="sm"
                    disabled={confirmMutation.isPending}
                    onClick={async () => {
                      try {
                        const result = await confirmMutation.mutateAsync(data.id);
                        setNotice(
                          plural('sales.detail.reserved', result.reservedQuantity, {
                            order: result.number,
                          }),
                        );
                      } catch {
                        // mutation.error renders below.
                      }
                    }}
                  >
                    {confirmMutation.isPending
                      ? t('sales.detail.confirming')
                      : t('sales.detail.confirm')}
                  </Button>
                )}

                {data.status === 'confirmed' && (
                  <Button
                    size="sm"
                    disabled={fulfilMutation.isPending}
                    onClick={async () => {
                      try {
                        const result = await fulfilMutation.mutateAsync(data.id);
                        setNotice(
                          plural('sales.detail.issued', result.issuedQuantity, {
                            order: result.number,
                          }),
                        );
                      } catch {
                        // mutation.error renders below.
                      }
                    }}
                  >
                    {fulfilMutation.isPending
                      ? t('sales.detail.fulfilling')
                      : t('sales.detail.fulfil')}
                  </Button>
                )}
              </div>
            )}

            {(confirmError || fulfilError) && (
              <p role="alert" className="text-xs text-rose-700">
                {confirmError ?? fulfilError}
              </p>
            )}

            {canWrite && cancellable && (
              <section
                aria-labelledby="so-cancel-heading"
                className="rounded-lg border border-rose-100 bg-rose-50/50 p-4"
              >
                <h3 id="so-cancel-heading" className="text-sm font-semibold text-slate-900">
                  {t('sales.cancel.heading')}
                </h3>
                <p className="mt-1 text-xs text-slate-600">{t('sales.cancel.help')}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label={t('sales.cancel.reasonLabel')}
                    type="text"
                    placeholder={t('sales.cancel.reasonPlaceholder')}
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
                          salesOrderId: data.id,
                          input: { reason: reason || null },
                        });
                        setNotice(
                          plural(
                            'sales.detail.cancelledWithReservations',
                            result.releasedReservations,
                            { order: result.number },
                          ),
                        );
                        setReason('');
                      } catch {
                        // mutation.error renders below.
                      }
                    }}
                  >
                    {cancelMutation.isPending
                      ? t('sales.cancel.cancelling')
                      : t('sales.cancel.submit')}
                  </Button>
                </div>
                {cancelError && (
                  <p role="alert" className="mt-2 text-xs text-rose-700">
                    {cancelError}
                  </p>
                )}
              </section>
            )}

            {data.status === 'fulfilled' && (
              <SalesReturnsSection
                organizationId={organizationId}
                order={data}
                canWrite={canWrite}
              />
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500" role="status">
            {t('sales.detail.loadingOrder')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
