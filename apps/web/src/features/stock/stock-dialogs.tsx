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
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import {
  usePostStockMovement,
  useReserveStock,
  useStockReservations,
  useStockTransfer,
} from './api';

type PostingMode = 'receipt' | 'issue' | 'adjustment';

interface ModeCopy {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  submitKey: MessageKey;
}

const modeCopy: Record<PostingMode, ModeCopy> = {
  receipt: {
    titleKey: 'stockDialog.mode.receipt.title',
    descriptionKey: 'stockDialog.mode.receipt.description',
    submitKey: 'stockDialog.mode.receipt.submit',
  },
  issue: {
    titleKey: 'stockDialog.mode.issue.title',
    descriptionKey: 'stockDialog.mode.issue.description',
    submitKey: 'stockDialog.mode.issue.submit',
  },
  adjustment: {
    titleKey: 'stockDialog.mode.adjustment.title',
    descriptionKey: 'stockDialog.mode.adjustment.description',
    submitKey: 'stockDialog.mode.adjustment.submit',
  },
};

function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;

  const quantity = Number(normalized);
  return Number.isFinite(quantity) ? quantity : null;
}

function quantityIssue(
  value: string,
  mode: PostingMode,
  t: (key: MessageKey) => string,
): string | null {
  const quantity = parseQuantity(value);
  if (quantity === null) return t('stockDialog.quantityNumber');
  if (Math.abs(quantity * 10_000 - Math.round(quantity * 10_000)) > 1e-6) {
    return t('stockDialog.quantityDecimals');
  }
  if (mode === 'adjustment' && quantity === 0) return t('stockDialog.quantityZero');
  if (mode !== 'adjustment' && quantity <= 0) return t('stockDialog.quantityPositive');
  return null;
}

interface PostingValues {
  productId: string;
  warehouseId: string;
  locationId: string;
  quantity: string;
  reason: string;
  reservationId: string;
}

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

export function StockPostingDialog({
  organizationId,
  warehouses,
  products,
  mode,
  open,
  onOpenChange,
}: StockDialogProps & { mode: PostingMode }) {
  const { t, formatQuantity, errorMessage } = useI18n();
  const mutation = usePostStockMovement(organizationId);
  const copy = modeCopy[mode];

  const schema = useMemo(
    () =>
      z
        .object({
          productId: z.string().min(1, t('stockDialog.selectProduct')),
          warehouseId: z.string().min(1, t('common.selectWarehouse')),
          locationId: z.string().min(1, t('stockDialog.selectLocation')),
          quantity: z.string().trim().min(1, t('stockDialog.enterQuantity')),
          reason: z.string().trim().max(500),
          reservationId: z.string(),
        })
        .superRefine((values, context) => {
          const message = quantityIssue(values.quantity, mode, t);
          if (message) context.addIssue({ code: 'custom', path: ['quantity'], message });
          if (mode === 'adjustment' && values.reason.length < 3) {
            context.addIssue({
              code: 'custom',
              path: ['reason'],
              message: t('stockDialog.adjustmentReasonShort'),
            });
          }
        }),
    [mode, t],
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

  const formError = mutation.error ? errorMessage(mutation.error, 'stockDialog.postError') : null;

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
        <DialogTitle>{t(copy.titleKey)}</DialogTitle>
        <DialogDescription>{t(copy.descriptionKey)}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="posting-product" className="block text-sm font-medium text-slate-700">
              {t('common.product')}
            </label>
            <select id="posting-product" className={fieldClass} {...register('productId')}>
              <option value="">{t('stockDialog.selectProduct')}</option>
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
                {t('common.quantity')}
              </label>
              <input
                id="posting-quantity"
                type="text"
                dir="ltr"
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
                    ? t('stockDialog.form.quantityNegativeHint')
                    : t('stockDialog.form.quantityHint')}
                </p>
              )}
            </div>

            {mode === 'issue' && (
              <div>
                <label
                  htmlFor="posting-reservation"
                  className="block text-sm font-medium text-slate-700"
                >
                  {t('stockDialog.form.fulfilReservation')}
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
                      ? t('stockDialog.form.noActiveReservation')
                      : t('stockDialog.form.noReservation')}
                  </option>
                  {matchingReservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {t('stockDialog.reservationOption', {
                        quantity: formatQuantity(reservation.quantity),
                        sku: reservation.productSku,
                      })}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="posting-reason" className="block text-sm font-medium text-slate-700">
              {mode === 'adjustment'
                ? t('stockDialog.form.reason')
                : t('stockDialog.form.reasonOptional')}
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

          {formError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {formError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('stockDialog.posting') : t(copy.submitKey)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface TransferValues {
  productId: string;
  sourceWarehouseId: string;
  sourceLocationId: string;
  targetWarehouseId: string;
  targetLocationId: string;
  quantity: string;
  reason: string;
}

export function StockTransferDialog({
  organizationId,
  warehouses,
  products,
  open,
  onOpenChange,
}: StockDialogProps) {
  const { t, errorMessage } = useI18n();
  const mutation = useStockTransfer(organizationId);

  const schema = useMemo(
    () =>
      z
        .object({
          productId: z.string().min(1, t('stockDialog.selectProduct')),
          sourceWarehouseId: z.string().min(1, t('stockDialog.selectSourceWarehouse')),
          sourceLocationId: z.string().min(1, t('stockDialog.selectSourceLocation')),
          targetWarehouseId: z.string().min(1, t('stockDialog.selectTargetWarehouse')),
          targetLocationId: z.string().min(1, t('stockDialog.selectTargetLocation')),
          quantity: z.string().trim().min(1, t('stockDialog.enterQuantity')),
          reason: z.string().trim().max(500),
        })
        .superRefine((values, context) => {
          const message = quantityIssue(values.quantity, 'receipt', t);
          if (message) context.addIssue({ code: 'custom', path: ['quantity'], message });
          if (
            values.sourceWarehouseId === values.targetWarehouseId &&
            values.sourceLocationId === values.targetLocationId
          ) {
            context.addIssue({
              code: 'custom',
              path: ['targetLocationId'],
              message: t('stockDialog.differentLocations'),
            });
          }
        }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransferValues>({
    resolver: zodResolver(schema),
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

  const formError = mutation.error
    ? errorMessage(mutation.error, 'stockDialog.transferError')
    : null;

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
        <DialogTitle>{t('stockDialog.transfer.title')}</DialogTitle>
        <DialogDescription>{t('stockDialog.transfer.description')}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="transfer-product" className="block text-sm font-medium text-slate-700">
              {t('common.product')}
            </label>
            <select id="transfer-product" className={fieldClass} {...register('productId')}>
              <option value="">{t('stockDialog.selectProduct')}</option>
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
            warehouseLabel={t('stockDialog.sourceWarehouse')}
            locationLabel={t('stockDialog.sourceLocation')}
          />

          <WarehouseLocationFields
            idPrefix="transfer-target"
            warehouses={warehouses}
            warehouseField={register('targetWarehouseId')}
            locationField={register('targetLocationId')}
            selectedWarehouseId={targetWarehouseId}
            warehouseLabel={t('stockDialog.targetWarehouse')}
            locationLabel={t('stockDialog.targetLocation')}
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
                {t('common.quantity')}
              </label>
              <input
                id="transfer-quantity"
                type="text"
                dir="ltr"
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
                {t('stockDialog.form.reasonOptional')}
              </label>
              <input
                id="transfer-reason"
                type="text"
                className={fieldClass}
                {...register('reason')}
              />
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {formError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t('stockDialog.transferring')
                : t('stockDialog.transfer.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ReservationValues {
  productId: string;
  warehouseId: string;
  locationId: string;
  quantity: string;
  expiresAt: string;
  note: string;
}

export function ReservationDialog({
  organizationId,
  warehouses,
  products,
  open,
  onOpenChange,
}: StockDialogProps) {
  const { t, errorMessage } = useI18n();
  const mutation = useReserveStock(organizationId);

  const schema = useMemo(
    () =>
      z.object({
        productId: z.string().min(1, t('stockDialog.selectProduct')),
        warehouseId: z.string().min(1, t('common.selectWarehouse')),
        locationId: z.string().min(1, t('stockDialog.selectLocation')),
        quantity: z.string().trim().min(1, t('stockDialog.enterQuantity')),
        expiresAt: z.string(),
        note: z.string().trim().max(500),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReservationValues>({
    resolver: zodResolver(schema),
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

  const formError = mutation.error
    ? errorMessage(mutation.error, 'stockDialog.reservationError')
    : null;

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
        <DialogTitle>{t('stockDialog.reservation.title')}</DialogTitle>
        <DialogDescription>{t('stockDialog.reservation.description')}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label
              htmlFor="reservation-product"
              className="block text-sm font-medium text-slate-700"
            >
              {t('common.product')}
            </label>
            <select id="reservation-product" className={fieldClass} {...register('productId')}>
              <option value="">{t('stockDialog.selectProduct')}</option>
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
                {t('common.quantity')}
              </label>
              <input
                id="reservation-quantity"
                type="text"
                dir="ltr"
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
                {t('stockDialog.reservation.expires')}
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
              {t('stockDialog.reservation.note')}
            </label>
            <input id="reservation-note" type="text" className={fieldClass} {...register('note')} />
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {formError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t('stockDialog.reserving')
                : t('stockDialog.reservation.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
