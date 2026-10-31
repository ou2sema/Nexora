import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { ProductSummary, WarehouseSummary } from '@mystock/contracts';
import { formatTnd, toMinorUnits } from '@mystock/domain';

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
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';
import {
  useCancelSalesOrder,
  useConfirmSalesOrder,
  useCreateSalesOrder,
  useFulfilSalesOrder,
  useSalesOrder,
} from './api';
import { salesOrderStatusLabels, salesOrderStatusStyles } from './labels';

function dialogError(error: unknown, fallback: string): string | null {
  if (error instanceof ApiError) return error.message;
  return error ? fallback : null;
}

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

const priceField = z
  .string()
  .trim()
  .refine((value) => value === '' || parsePriceInput(value) !== null, {
    message: 'Use a positive amount with up to 3 decimals',
  });

const quantityField = z
  .string()
  .trim()
  .refine((value) => /^\d+(\.\d{1,4})?$/.test(value) && Number(value) > 0, {
    message: 'Enter a quantity greater than zero',
  });

const lineSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  quantity: quantityField,
  unitPrice: priceField,
});

const createSchema = z
  .object({
    customerName: z.string().trim().min(1, 'Enter the customer name').max(160),
    customerEmail: z
      .string()
      .trim()
      .max(254)
      .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
        message: 'Enter a valid email address',
      }),
    customerPhone: z.string().trim().max(40),
    warehouseId: z.string().min(1, 'Select a warehouse'),
    locationId: z.string().min(1, 'Select a storage location'),
    reference: z.string().trim().max(120),
    notes: z.string().trim().max(2000),
    lines: z.array(lineSchema).min(1, 'Add at least one line').max(100),
  })
  .refine(
    (values) => new Set(values.lines.map((line) => line.productId)).size === values.lines.length,
    { message: 'Each product may appear only once', path: ['lines'] },
  );

type CreateValues = z.infer<typeof createSchema>;

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
  const mutation = useCreateSalesOrder(organizationId);
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
  const errorMessage = dialogError(mutation.error, 'The outgoing order could not be created.');

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
        <DialogTitle>New outgoing order</DialogTitle>
        <DialogDescription>
          Confirming reserves stock; fulfilling issues it. Serialized products are sold per device.
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="so-customer" className="block text-sm font-medium text-slate-700">
                Customer name
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
                Reference (optional)
              </label>
              <input
                id="so-reference"
                type="text"
                className={fieldClass}
                {...register('reference')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="so-email" className="block text-sm font-medium text-slate-700">
                Email (optional)
              </label>
              <input
                id="so-email"
                type="email"
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
                Phone (optional)
              </label>
              <input
                id="so-phone"
                type="tel"
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
                Lines
              </h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => append(emptyLine)}>
                <Plus aria-hidden="true" className="size-4" />
                Add line
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Only active, non-serialized products can be sold through an order line.
            </p>

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
                      Product
                    </label>
                    <select
                      id={`so-line-product-${index}`}
                      className={fieldClass}
                      {...register(`lines.${index}.productId`)}
                    >
                      <option value="">Select a product</option>
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
                      Quantity
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
                      Unit price (TND)
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
                      aria-label={`Remove line ${index + 1}`}
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
              Notes (optional)
            </label>
            <textarea id="so-notes" rows={2} className={fieldClass} {...register('notes')} />
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {errorMessage}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create outgoing order'}
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

  const confirmError = dialogError(confirmMutation.error, 'The order could not be confirmed.');
  const fulfilError = dialogError(fulfilMutation.error, 'The order could not be fulfilled.');
  const cancelError = dialogError(cancelMutation.error, 'The order could not be cancelled.');

  return (
    <Dialog open={Boolean(salesOrderId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>
          {data ? `${data.number} · ${data.customerName}` : 'Outgoing order'}
        </DialogTitle>
        <DialogDescription>
          {data
            ? `${salesOrderStatusLabels[data.status]} · ${data.warehouseCode} / ${data.locationCode}`
            : 'Loading outgoing order…'}
        </DialogDescription>

        {order.isError ? (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {order.error instanceof Error ? order.error.message : 'The order failed to load.'}
          </p>
        ) : data ? (
          <div className="mt-5 space-y-6">
            <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                      salesOrderStatusStyles[data.status],
                    )}
                  >
                    {salesOrderStatusLabels[data.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact
                </dt>
                <dd className="mt-1 text-slate-800">
                  {data.customerEmail ?? data.customerPhone ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reference
                </dt>
                <dd className="mt-1 text-slate-800">{data.reference ?? '—'}</dd>
              </div>
            </dl>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Product
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Quantity
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Unit price
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Reservation
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2">
                        <p className="text-slate-800">{line.productName}</p>
                        <p className="font-mono text-xs text-slate-500">{line.productSku}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">{line.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {line.unitPriceMinor === null ? '—' : formatTnd(line.unitPriceMinor)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">
                        {line.reservationId ? `${line.reservationId.slice(0, 8)}…` : '—'}
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
                          `Reserved ${result.reservedQuantity} unit${result.reservedQuantity === 1 ? '' : 's'} for ${result.number}.`,
                        );
                      } catch {
                        // mutation.error renders below.
                      }
                    }}
                  >
                    {confirmMutation.isPending ? 'Confirming…' : 'Confirm and reserve stock'}
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
                          `Issued ${result.issuedQuantity} unit${result.issuedQuantity === 1 ? '' : 's'} for ${result.number}.`,
                        );
                      } catch {
                        // mutation.error renders below.
                      }
                    }}
                  >
                    {fulfilMutation.isPending ? 'Fulfilling…' : 'Fulfil and issue stock'}
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
                  Cancel order
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Cancelling releases any reservation held for this order.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="Cancellation reason"
                    type="text"
                    placeholder="Reason (optional)"
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
                          `Order ${result.number} was cancelled and ${result.releasedReservations} reservation${result.releasedReservations === 1 ? '' : 's'} released.`,
                        );
                        setReason('');
                      } catch {
                        // mutation.error renders below.
                      }
                    }}
                  >
                    {cancelMutation.isPending ? 'Cancelling…' : 'Cancel order'}
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
            Loading order…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
