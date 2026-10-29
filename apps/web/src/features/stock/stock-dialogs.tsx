import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type {
  ProductSummary,
  StockPostingInput,
  StockReservationCreateInput,
  StockTransferInput,
  WarehouseSummary,
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
import { WarehouseLocationFields } from '@/components/ui/warehouse-location-fields';
import { ApiError } from '@/lib/api-client';
import { fieldClass } from '@/lib/form-field';
import {
  usePostStockMovement,
  useReserveStock,
  useStockReservations,
  useStockTransfer,
} from './api';

type PostingMode = 'receipt' | 'issue' | 'adjustment';

const modeCopy: Record<PostingMode, { title: string; description: string; submit: string }> = {
  receipt: {
    title: 'Receive stock',
    description: 'Increase the on-hand quantity for a product at one storage location.',
    submit: 'Post receipt',
  },
  issue: {
    title: 'Issue stock',
    description:
      'Decrease on-hand stock. Issue the reservation quantity to fulfil a reservation atomically.',
    submit: 'Post issue',
  },
  adjustment: {
    title: 'Adjust stock',
    description: 'Correct the ledger with a signed delta. Adjustments require a documented reason.',
    submit: 'Post adjustment',
  },
};

function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;

  const quantity = Number(normalized);
  return Number.isFinite(quantity) ? quantity : null;
}

function quantityIssue(value: string, mode: PostingMode): string | null {
  const quantity = parseQuantity(value);
  if (quantity === null) return 'Enter a number';
  if (Math.abs(quantity * 10_000 - Math.round(quantity * 10_000)) > 1e-6) {
    return 'Use at most four decimal places';
  }
  if (mode === 'adjustment' && quantity === 0) return 'Adjustment quantity must not be zero';
  if (mode !== 'adjustment' && quantity <= 0) return 'Quantity must be greater than zero';
  return null;
}

const postingBaseSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  warehouseId: z.string().min(1, 'Select a warehouse'),
  locationId: z.string().min(1, 'Select a storage location'),
  quantity: z.string().trim().min(1, 'Enter a quantity'),
  reason: z.string().trim().max(500),
  reservationId: z.string(),
});

type PostingValues = z.infer<typeof postingBaseSchema>;

interface StockDialogProps {
  organizationId: string;
  warehouses: WarehouseSummary[];
  products: ProductSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function activeProducts(products: ProductSummary[], serialized: boolean) {
  return products.filter(
    (product) => product.status === 'active' && product.isSerialized === serialized,
  );
}

function dialogError(error: unknown, fallback: string): string | null {
  if (error instanceof ApiError) return error.message;
  return error ? fallback : null;
}

export function StockPostingDialog({
  organizationId,
  warehouses,
  products,
  mode,
  open,
  onOpenChange,
}: StockDialogProps & { mode: PostingMode }) {
  const mutation = usePostStockMovement(organizationId);
  const copy = modeCopy[mode];

  const schema = useMemo(
    () =>
      postingBaseSchema.superRefine((values, context) => {
        const message = quantityIssue(values.quantity, mode);
        if (message) context.addIssue({ code: 'custom', path: ['quantity'], message });
        if (mode === 'adjustment' && values.reason.length < 3) {
          context.addIssue({
            code: 'custom',
            path: ['reason'],
            message: 'Adjustments require a reason of at least 3 characters',
          });
        }
      }),
    [mode],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PostingValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      productId: '',
      warehouseId: '',
      locationId: '',
      quantity: '',
      reason: '',
      reservationId: '',
    },
  });

  const productId = watch('productId');
  const warehouseId = watch('warehouseId');
  const locationId = watch('locationId');
  const reservationId = watch('reservationId');

  const reservations = useStockReservations(
    organizationId,
    { status: 'active', page: 1, pageSize: 100 },
    open && mode === 'issue',
  );
  const matchingReservations = (reservations.data?.items ?? []).filter(
    (reservation) =>
      reservation.productId === productId &&
      reservation.warehouseId === warehouseId &&
      reservation.locationId === locationId,
  );

  useEffect(() => {
    if (open) reset();
  }, [open, mode, reset]);

  useEffect(() => {
    setValue('locationId', '');
    setValue('reservationId', '');
  }, [productId, warehouseId, setValue]);

  const errorMessage = dialogError(mutation.error, 'The movement could not be posted.');

  const submit = handleSubmit(async (values) => {
    const quantity = parseQuantity(values.quantity);
    if (quantity === null) return;

    const input: StockPostingInput = {
      productId: values.productId,
      warehouseId: values.warehouseId,
      locationId: values.locationId,
      type: mode,
      quantity,
      reason: values.reason.trim() === '' ? null : values.reason,
      referenceType: mode === 'adjustment' ? 'adjustment' : 'manual',
      reservationId: mode === 'issue' && values.reservationId ? values.reservationId : null,
    };

    try {
      await mutation.mutateAsync(input);
      reset();
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="posting-product" className="block text-sm font-medium text-slate-700">
              Product
            </label>
            <select id="posting-product" className={fieldClass} {...register('productId')}>
              <option value="">Select a product</option>
              {activeProducts(products, false).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
            </select>
            {errors.productId && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                {errors.productId.message}
              </p>
            )}
          </div>

          <WarehouseLocationFields
            idPrefix="posting"
            warehouses={warehouses}
            warehouseField={register('warehouseId')}
            locationField={register('locationId')}
            selectedWarehouseId={warehouseId}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="posting-quantity"
                className="block text-sm font-medium text-slate-700"
              >
                Quantity
              </label>
              <input
                id="posting-quantity"
                type="text"
                inputMode="decimal"
                className={fieldClass}
                disabled={Boolean(reservationId)}
                aria-invalid={Boolean(errors.quantity)}
                aria-describedby={errors.quantity ? 'posting-quantity-error' : undefined}
                {...register('quantity')}
              />
              {errors.quantity ? (
                <p id="posting-quantity-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.quantity.message}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  {mode === 'adjustment'
                    ? 'Use a negative value to decrease stock.'
                    : 'Up to four decimal places.'}
                </p>
              )}
            </div>

            {mode === 'issue' && (
              <div>
                <label
                  htmlFor="posting-reservation"
                  className="block text-sm font-medium text-slate-700"
                >
                  Fulfil reservation (optional)
                </label>
                <select
                  id="posting-reservation"
                  className={fieldClass}
                  value={reservationId}
                  disabled={matchingReservations.length === 0}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const reservation = matchingReservations.find((item) => item.id === nextId);
                    setValue('reservationId', nextId);
                    setValue('quantity', reservation ? String(reservation.quantity) : '');
                  }}
                >
                  <option value="">
                    {matchingReservations.length === 0
                      ? 'No active reservation for this line'
                      : 'No reservation'}
                  </option>
                  {matchingReservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.quantity} reserved · {reservation.productSku}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="posting-reason" className="block text-sm font-medium text-slate-700">
              Reason {mode === 'adjustment' ? '' : '(optional)'}
            </label>
            <input
              id="posting-reason"
              type="text"
              className={fieldClass}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? 'posting-reason-error' : undefined}
              {...register('reason')}
            />
            {errors.reason && (
              <p id="posting-reason-error" role="alert" className="mt-1 text-xs text-rose-700">
                {errors.reason.message}
              </p>
            )}
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
              {mutation.isPending ? 'Posting…' : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const transferSchema = z
  .object({
    productId: z.string().min(1, 'Select a product'),
    sourceWarehouseId: z.string().min(1, 'Select the source warehouse'),
    sourceLocationId: z.string().min(1, 'Select the source location'),
    targetWarehouseId: z.string().min(1, 'Select the target warehouse'),
    targetLocationId: z.string().min(1, 'Select the target location'),
    quantity: z.string().trim().min(1, 'Enter a quantity'),
    reason: z.string().trim().max(500),
  })
  .superRefine((values, context) => {
    const message = quantityIssue(values.quantity, 'receipt');
    if (message) context.addIssue({ code: 'custom', path: ['quantity'], message });
    if (
      values.sourceWarehouseId === values.targetWarehouseId &&
      values.sourceLocationId === values.targetLocationId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['targetLocationId'],
        message: 'Choose two different locations',
      });
    }
  });

type TransferValues = z.infer<typeof transferSchema>;

export function StockTransferDialog({
  organizationId,
  warehouses,
  products,
  open,
  onOpenChange,
}: StockDialogProps) {
  const mutation = useStockTransfer(organizationId);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      productId: '',
      sourceWarehouseId: '',
      sourceLocationId: '',
      targetWarehouseId: '',
      targetLocationId: '',
      quantity: '',
      reason: '',
    },
  });

  const sourceWarehouseId = watch('sourceWarehouseId');
  const targetWarehouseId = watch('targetWarehouseId');

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    setValue('sourceLocationId', '');
  }, [sourceWarehouseId, setValue]);

  useEffect(() => {
    setValue('targetLocationId', '');
  }, [targetWarehouseId, setValue]);

  const errorMessage = dialogError(mutation.error, 'The transfer could not be posted.');

  const submit = handleSubmit(async (values) => {
    const quantity = parseQuantity(values.quantity);
    if (quantity === null) return;

    const input: StockTransferInput = {
      productId: values.productId,
      sourceWarehouseId: values.sourceWarehouseId,
      sourceLocationId: values.sourceLocationId,
      targetWarehouseId: values.targetWarehouseId,
      targetLocationId: values.targetLocationId,
      quantity,
      reason: values.reason.trim() === '' ? null : values.reason,
    };

    try {
      await mutation.mutateAsync(input);
      reset();
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Transfer stock</DialogTitle>
        <DialogDescription>
          Move quantity between two storage locations in one atomic operation.
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="transfer-product" className="block text-sm font-medium text-slate-700">
              Product
            </label>
            <select id="transfer-product" className={fieldClass} {...register('productId')}>
              <option value="">Select a product</option>
              {activeProducts(products, false).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
            </select>
            {errors.productId && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                {errors.productId.message}
              </p>
            )}
          </div>

          <WarehouseLocationFields
            idPrefix="transfer-source"
            warehouses={warehouses}
            warehouseField={register('sourceWarehouseId')}
            locationField={register('sourceLocationId')}
            selectedWarehouseId={sourceWarehouseId}
            warehouseLabel="Source warehouse"
            locationLabel="Source location"
          />

          <WarehouseLocationFields
            idPrefix="transfer-target"
            warehouses={warehouses}
            warehouseField={register('targetWarehouseId')}
            locationField={register('targetLocationId')}
            selectedWarehouseId={targetWarehouseId}
            warehouseLabel="Target warehouse"
            locationLabel="Target location"
          />
          {errors.targetLocationId && (
            <p role="alert" className="text-xs text-rose-700">
              {errors.targetLocationId.message}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="transfer-quantity"
                className="block text-sm font-medium text-slate-700"
              >
                Quantity
              </label>
              <input
                id="transfer-quantity"
                type="text"
                inputMode="decimal"
                className={fieldClass}
                aria-invalid={Boolean(errors.quantity)}
                {...register('quantity')}
              />
              {errors.quantity && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.quantity.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="transfer-reason" className="block text-sm font-medium text-slate-700">
                Reason (optional)
              </label>
              <input
                id="transfer-reason"
                type="text"
                className={fieldClass}
                {...register('reason')}
              />
            </div>
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
              {mutation.isPending ? 'Transferring…' : 'Post transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const reservationSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  warehouseId: z.string().min(1, 'Select a warehouse'),
  locationId: z.string().min(1, 'Select a storage location'),
  quantity: z.string().trim().min(1, 'Enter a quantity'),
  expiresAt: z.string(),
  note: z.string().trim().max(500),
});

type ReservationValues = z.infer<typeof reservationSchema>;

export function ReservationDialog({
  organizationId,
  warehouses,
  products,
  open,
  onOpenChange,
}: StockDialogProps) {
  const mutation = useReserveStock(organizationId);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReservationValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      productId: '',
      warehouseId: '',
      locationId: '',
      quantity: '',
      expiresAt: '',
      note: '',
    },
  });

  const productId = watch('productId');
  const warehouseId = watch('warehouseId');

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    setValue('locationId', '');
  }, [productId, warehouseId, setValue]);

  const errorMessage = dialogError(mutation.error, 'The reservation could not be created.');

  const submit = handleSubmit(async (values) => {
    const quantity = parseQuantity(values.quantity);
    if (quantity === null || quantity <= 0) return;

    const input: StockReservationCreateInput = {
      productId: values.productId,
      warehouseId: values.warehouseId,
      locationId: values.locationId,
      quantity,
      expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
      note: values.note.trim() === '' ? null : values.note,
    };

    try {
      await mutation.mutateAsync(input);
      reset();
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Reserve stock</DialogTitle>
        <DialogDescription>
          Reservations hold availability without changing physical on-hand stock.
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label
              htmlFor="reservation-product"
              className="block text-sm font-medium text-slate-700"
            >
              Product
            </label>
            <select id="reservation-product" className={fieldClass} {...register('productId')}>
              <option value="">Select a product</option>
              {activeProducts(products, false).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
            </select>
            {errors.productId && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                {errors.productId.message}
              </p>
            )}
          </div>

          <WarehouseLocationFields
            idPrefix="reservation"
            warehouses={warehouses}
            warehouseField={register('warehouseId')}
            locationField={register('locationId')}
            selectedWarehouseId={warehouseId}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reservation-quantity"
                className="block text-sm font-medium text-slate-700"
              >
                Quantity
              </label>
              <input
                id="reservation-quantity"
                type="text"
                inputMode="decimal"
                className={fieldClass}
                aria-invalid={Boolean(errors.quantity)}
                {...register('quantity')}
              />
              {errors.quantity && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.quantity.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reservation-expires"
                className="block text-sm font-medium text-slate-700"
              >
                Expires (optional)
              </label>
              <input
                id="reservation-expires"
                type="datetime-local"
                className={fieldClass}
                {...register('expiresAt')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reservation-note" className="block text-sm font-medium text-slate-700">
              Note (optional)
            </label>
            <input id="reservation-note" type="text" className={fieldClass} {...register('note')} />
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
              {mutation.isPending ? 'Reserving…' : 'Create reservation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
