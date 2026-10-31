import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { ProductSummary, SupplierSummary, WarehouseSummary } from '@mystock/contracts';
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
  useCreatePurchaseOrder,
  useCancelPurchaseOrder,
  useOrderPurchaseOrder,
  usePurchaseOrder,
  useReceivePurchaseOrder,
} from './api';
import { purchaseOrderStatusLabels, purchaseOrderStatusStyles } from './labels';

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
  unitCost: priceField,
});

const createSchema = z
  .object({
    supplierId: z.string().min(1, 'Select a supplier'),
    warehouseId: z.string().min(1, 'Select a warehouse'),
    locationId: z.string().min(1, 'Select a storage location'),
    expectedOn: z.string(),
    reference: z.string().trim().max(120),
    notes: z.string().trim().max(2000),
    lines: z.array(lineSchema).min(1, 'Add at least one line').max(100),
  })
  .refine(
    (values) => new Set(values.lines.map((line) => line.productId)).size === values.lines.length,
    { message: 'Each product may appear only once', path: ['lines'] },
  );

type CreateValues = z.infer<typeof createSchema>;

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
  const mutation = useCreatePurchaseOrder(organizationId);
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
  const errorMessage = dialogError(mutation.error, 'The purchase order could not be created.');

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
        <DialogTitle>New purchase order</DialogTitle>
        <DialogDescription>
          Drafts can be cancelled. Ordered quantities enter stock only when received.
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="po-supplier" className="block text-sm font-medium text-slate-700">
              Supplier
            </label>
            <select id="po-supplier" className={fieldClass} {...register('supplierId')}>
              <option value="">Select a supplier</option>
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
              <p className="mt-1 text-xs text-amber-700">
                Create an active supplier before raising a purchase order.
              </p>
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
                Expected date (optional)
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
                Supplier reference (optional)
              </label>
              <input
                id="po-reference"
                type="text"
                className={fieldClass}
                {...register('reference')}
              />
            </div>
          </div>

          <section aria-labelledby="po-lines-heading">
            <div className="flex items-center justify-between">
              <h3 id="po-lines-heading" className="text-sm font-semibold text-slate-900">
                Lines
              </h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => append(emptyLine)}>
                <Plus aria-hidden="true" className="size-4" />
                Add line
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
                      Product
                    </label>
                    <select
                      id={`po-line-product-${index}`}
                      className={fieldClass}
                      {...register(`lines.${index}.productId`)}
                    >
                      <option value="">Select a product</option>
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
                      Quantity
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
                      Unit cost (TND)
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
              Notes (optional)
            </label>
            <textarea id="po-notes" rows={2} className={fieldClass} {...register('notes')} />
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
              {mutation.isPending ? 'Creating…' : 'Create purchase order'}
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
  const order = usePurchaseOrder(organizationId, purchaseOrderId);
  const orderMutation = useOrderPurchaseOrder(organizationId);
  const receiveMutation = useReceivePurchaseOrder(organizationId);
  const cancelMutation = useCancelPurchaseOrder(organizationId);

  const [receipt, setReceipt] = useState<Record<string, ReceiptState>>({});
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setReceipt({});
    setReason('');
    setNotice(null);
  }, [purchaseOrderId]);

  const data = order.data;
  const receivable = data?.status === 'ordered' || data?.status === 'partially_received';
  const cancellable = data?.status === 'draft' || data?.status === 'ordered';
  const openLines =
    data?.lines.filter((line) => line.quantityOrdered - line.quantityReceived > 0) ?? [];

  const receiveError = dialogError(receiveMutation.error, 'The receipt could not be posted.');
  const cancelError = dialogError(cancelMutation.error, 'The order could not be cancelled.');
  const orderError = dialogError(orderMutation.error, 'The order could not be advanced.');

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
      setNotice('Enter a quantity or at least one serial number to receive.');
      return;
    }

    try {
      const result = await receiveMutation.mutateAsync({
        purchaseOrderId: data.id,
        input: { lines },
      });
      setNotice(
        `Received ${result.receivedQuantity} unit${result.receivedQuantity === 1 ? '' : 's'} · ${purchaseOrderStatusLabels[result.status]}`,
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
          {data ? `${data.number} · ${data.supplierName}` : 'Purchase order'}
        </DialogTitle>
        <DialogDescription>
          {data
            ? `${purchaseOrderStatusLabels[data.status]} · ${data.warehouseCode} / ${data.locationCode}`
            : 'Loading purchase order…'}
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
                      purchaseOrderStatusStyles[data.status],
                    )}
                  >
                    {purchaseOrderStatusLabels[data.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Expected
                </dt>
                <dd className="mt-1 text-slate-800">{data.expectedOn ?? '—'}</dd>
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
                      Ordered
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Received
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Unit cost
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
                      <td className="px-3 py-2 text-right text-slate-700">
                        {line.quantityOrdered}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {line.quantityReceived}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {line.unitCostMinor === null ? '—' : formatTnd(line.unitCostMinor)}
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
                  Receive stock
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Serialized products register one device per serial number. Use serial|IMEI per
                  line.
                </p>
                <div className="mt-3 space-y-3">
                  {openLines.map((line) => {
                    const state = receipt[line.id] ?? { quantity: '', serials: '' };

                    return (
                      <div key={line.id} className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{line.productName}</p>
                          <p className="text-xs text-slate-500">
                            Remaining {line.quantityOrdered - line.quantityReceived}
                          </p>
                        </div>
                        {line.isSerialized ? (
                          <textarea
                            aria-label={`Serial numbers for ${line.productSku}`}
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
                            aria-label={`Quantity to receive for ${line.productSku}`}
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
                  {receiveMutation.isPending ? 'Receiving…' : 'Post receipt'}
                </Button>
              </section>
            )}

            {canWrite && data.status === 'draft' && (
              <section aria-labelledby="po-order-heading">
                <h3 id="po-order-heading" className="text-sm font-semibold text-slate-900">
                  Send to supplier
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Marking the order as ordered makes it receivable.
                </p>
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
                        `Purchase order ${result.number} is now ${purchaseOrderStatusLabels[result.status].toLowerCase()}.`,
                      );
                    } catch {
                      // mutation.error renders above.
                    }
                  }}
                >
                  {orderMutation.isPending ? 'Updating…' : 'Mark as ordered'}
                </Button>
              </section>
            )}

            {canWrite && cancellable && (
              <section
                aria-labelledby="po-cancel-heading"
                className="rounded-lg border border-rose-100 bg-rose-50/50 p-4"
              >
                <h3 id="po-cancel-heading" className="text-sm font-semibold text-slate-900">
                  Cancel order
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Cancelling is only possible before any stock is received.
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
                          purchaseOrderId: data.id,
                          input: { reason: reason || null },
                        });
                        setNotice(`Purchase order ${result.number} was cancelled.`);
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
