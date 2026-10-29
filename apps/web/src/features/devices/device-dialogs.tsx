import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type {
  DeviceCondition,
  DeviceStatus,
  ProductSummary,
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
import { cn } from '@/lib/cn';
import { fieldClass } from '@/lib/form-field';
import {
  useChangeDeviceStatus,
  useDevice,
  useDeviceEvents,
  useMoveDevice,
  useRegisterDevice,
} from './api';
import {
  deviceConditionLabels,
  deviceEventLabels,
  deviceStatusLabels,
  deviceStatusStyles,
} from './labels';

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function dialogError(error: unknown, fallback: string): string | null {
  if (error instanceof ApiError) return error.message;
  return error ? fallback : null;
}

const registerSchema = z
  .object({
    productId: z.string().min(1, 'Select a serialized product'),
    serialNumber: z.string().trim().min(1, 'Enter the serial number').max(120),
    imei: z
      .string()
      .trim()
      .refine((value) => value === '' || /^[0-9]{14,17}$/.test(value), {
        message: 'Use 14 to 17 digits',
      }),
    condition: z.enum(['new', 'used', 'refurbished', 'damaged', 'defective']),
    warehouseId: z.string().min(1, 'Select a warehouse'),
    locationId: z.string().min(1, 'Select a storage location'),
    warrantyStartOn: z.string(),
    warrantyEndOn: z.string(),
    supplierReference: z.string().trim().max(120),
    note: z.string().trim().max(500),
  })
  .refine(
    (values) =>
      !values.warrantyStartOn ||
      !values.warrantyEndOn ||
      values.warrantyEndOn >= values.warrantyStartOn,
    { message: 'Warranty end must not precede its start', path: ['warrantyEndOn'] },
  );

type RegisterValues = z.infer<typeof registerSchema>;

interface RegisterDeviceDialogProps {
  organizationId: string;
  warehouses: WarehouseSummary[];
  products: ProductSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterDeviceDialog({
  organizationId,
  warehouses,
  products,
  open,
  onOpenChange,
}: RegisterDeviceDialogProps) {
  const mutation = useRegisterDevice(organizationId);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      productId: '',
      serialNumber: '',
      imei: '',
      condition: 'new',
      warehouseId: '',
      locationId: '',
      warrantyStartOn: '',
      warrantyEndOn: '',
      supplierReference: '',
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

  const errorMessage = dialogError(mutation.error, 'The device could not be registered.');

  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        productId: values.productId,
        serialNumber: values.serialNumber,
        imei: values.imei || null,
        condition: values.condition,
        warehouseId: values.warehouseId,
        locationId: values.locationId,
        warrantyStartOn: values.warrantyStartOn || null,
        warrantyEndOn: values.warrantyEndOn || null,
        supplierReference: values.supplierReference || null,
        note: values.note || null,
      });
      reset();
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  });

  const serializedProducts = products.filter(
    (product) => product.isSerialized && product.status === 'active',
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Register device</DialogTitle>
        <DialogDescription>
          Each serial number is unique per organization and gets an append-only event history.
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="device-product" className="block text-sm font-medium text-slate-700">
              Serialized product
            </label>
            <select id="device-product" className={fieldClass} {...register('productId')}>
              <option value="">Select a product</option>
              {serializedProducts.map((product) => (
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
            {serializedProducts.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                No active serialized products. Enable serial tracking on a product first.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="device-serial" className="block text-sm font-medium text-slate-700">
                Serial number
              </label>
              <input
                id="device-serial"
                type="text"
                autoComplete="off"
                className={fieldClass}
                aria-invalid={Boolean(errors.serialNumber)}
                aria-describedby={errors.serialNumber ? 'device-serial-error' : undefined}
                {...register('serialNumber')}
              />
              {errors.serialNumber && (
                <p id="device-serial-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.serialNumber.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="device-condition"
                className="block text-sm font-medium text-slate-700"
              >
                Condition
              </label>
              <select id="device-condition" className={fieldClass} {...register('condition')}>
                {(Object.keys(deviceConditionLabels) as DeviceCondition[]).map((condition) => (
                  <option key={condition} value={condition}>
                    {deviceConditionLabels[condition]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="device-imei" className="block text-sm font-medium text-slate-700">
              IMEI (optional)
            </label>
            <input
              id="device-imei"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={fieldClass}
              aria-invalid={Boolean(errors.imei)}
              aria-describedby={errors.imei ? 'device-imei-error' : undefined}
              {...register('imei')}
            />
            {errors.imei && (
              <p id="device-imei-error" role="alert" className="mt-1 text-xs text-rose-700">
                {errors.imei.message}
              </p>
            )}
          </div>

          <WarehouseLocationFields
            idPrefix="device"
            warehouses={warehouses}
            warehouseField={register('warehouseId')}
            locationField={register('locationId')}
            selectedWarehouseId={warehouseId}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="device-warranty-start"
                className="block text-sm font-medium text-slate-700"
              >
                Warranty start (optional)
              </label>
              <input
                id="device-warranty-start"
                type="date"
                className={fieldClass}
                {...register('warrantyStartOn')}
              />
            </div>

            <div>
              <label
                htmlFor="device-warranty-end"
                className="block text-sm font-medium text-slate-700"
              >
                Warranty end (optional)
              </label>
              <input
                id="device-warranty-end"
                type="date"
                className={fieldClass}
                aria-invalid={Boolean(errors.warrantyEndOn)}
                {...register('warrantyEndOn')}
              />
              {errors.warrantyEndOn && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.warrantyEndOn.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="device-supplier-reference"
                className="block text-sm font-medium text-slate-700"
              >
                Supplier reference (optional)
              </label>
              <input
                id="device-supplier-reference"
                type="text"
                className={fieldClass}
                {...register('supplierReference')}
              />
            </div>

            <div>
              <label htmlFor="device-note" className="block text-sm font-medium text-slate-700">
                Note (optional)
              </label>
              <input id="device-note" type="text" className={fieldClass} {...register('note')} />
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
              {mutation.isPending ? 'Registering…' : 'Register device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const statusSchema = z.object({
  status: z.enum(['in_stock', 'reserved', 'sold', 'returned', 'in_repair', 'lost', 'disposed']),
  note: z.string().trim().max(500),
});

type StatusValues = z.infer<typeof statusSchema>;

const moveSchema = z.object({
  warehouseId: z.string().min(1, 'Select a warehouse'),
  locationId: z.string().min(1, 'Select a storage location'),
  note: z.string().trim().max(500),
});

type MoveValues = z.infer<typeof moveSchema>;

interface DeviceDetailDialogProps {
  organizationId: string;
  deviceId: string | null;
  warehouses: WarehouseSummary[];
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceDetailDialog({
  organizationId,
  deviceId,
  warehouses,
  canWrite,
  onOpenChange,
}: DeviceDetailDialogProps) {
  const device = useDevice(organizationId, deviceId);
  const events = useDeviceEvents(organizationId, deviceId);
  const statusMutation = useChangeDeviceStatus(organizationId, deviceId ?? '');
  const moveMutation = useMoveDevice(organizationId, deviceId ?? '');

  const statusForm = useForm<StatusValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: { status: 'in_stock', note: '' },
  });
  const moveForm = useForm<MoveValues>({
    resolver: zodResolver(moveSchema),
    defaultValues: { warehouseId: '', locationId: '', note: '' },
  });

  const moveWarehouseId = moveForm.watch('warehouseId');

  useEffect(() => {
    if (device.data) {
      statusForm.reset({ status: device.data.status, note: '' });
      moveForm.reset({ warehouseId: '', locationId: '', note: '' });
    }
  }, [deviceId, device.data?.status, statusForm, moveForm]);

  useEffect(() => {
    moveForm.setValue('locationId', '');
  }, [moveWarehouseId, moveForm]);

  const statusError = dialogError(statusMutation.error, 'The status change failed.');
  const moveError = dialogError(moveMutation.error, 'The move failed.');

  return (
    <Dialog open={Boolean(deviceId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>
          {device.data ? `${device.data.productName} · ${device.data.serialNumber}` : 'Device'}
        </DialogTitle>
        <DialogDescription>
          {device.data
            ? `${device.data.productSku} · ${deviceStatusLabels[device.data.status]}`
            : 'Loading device details…'}
        </DialogDescription>

        {device.isError ? (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {device.error instanceof Error ? device.error.message : 'The device failed to load.'}
          </p>
        ) : device.data ? (
          <div className="mt-5 space-y-6">
            <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                      deviceStatusStyles[device.data.status],
                    )}
                  >
                    {deviceStatusLabels[device.data.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Condition
                </dt>
                <dd className="mt-1 text-slate-800">
                  {deviceConditionLabels[device.data.condition]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </dt>
                <dd className="mt-1 font-mono text-xs text-slate-800">
                  {device.data.warehouseCode} / {device.data.locationCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  IMEI
                </dt>
                <dd className="mt-1 font-mono text-xs text-slate-800">{device.data.imei ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Warranty
                </dt>
                <dd className="mt-1 text-slate-800">
                  {device.data.warrantyStartOn || device.data.warrantyEndOn
                    ? `${device.data.warrantyStartOn ?? '—'} → ${device.data.warrantyEndOn ?? '—'}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Supplier reference
                </dt>
                <dd className="mt-1 text-slate-800">{device.data.supplierReference ?? '—'}</dd>
              </div>
            </dl>

            {canWrite && (
              <div className="grid gap-6 lg:grid-cols-2">
                <section aria-labelledby="device-status-heading">
                  <h3 id="device-status-heading" className="text-sm font-semibold text-slate-900">
                    Change status
                  </h3>
                  <form
                    noValidate
                    className="mt-2 space-y-3"
                    onSubmit={statusForm.handleSubmit(async (values) => {
                      try {
                        await statusMutation.mutateAsync({
                          status: values.status,
                          note: values.note || null,
                        });
                        statusForm.reset({ status: values.status, note: '' });
                      } catch {
                        // mutation.error renders below.
                      }
                    })}
                  >
                    <select
                      aria-label="New device status"
                      className={fieldClass}
                      {...statusForm.register('status')}
                    >
                      {(Object.keys(deviceStatusLabels) as DeviceStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {deviceStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      aria-label="Status change note"
                      placeholder="Note (optional)"
                      className={fieldClass}
                      {...statusForm.register('note')}
                    />
                    {statusError && (
                      <p role="alert" className="text-xs text-rose-700">
                        {statusError}
                      </p>
                    )}
                    <Button type="submit" size="sm" disabled={statusMutation.isPending}>
                      {statusMutation.isPending ? 'Updating…' : 'Update status'}
                    </Button>
                  </form>
                </section>

                <section aria-labelledby="device-move-heading">
                  <h3 id="device-move-heading" className="text-sm font-semibold text-slate-900">
                    Move to another location
                  </h3>
                  <form
                    noValidate
                    className="mt-2 space-y-3"
                    onSubmit={moveForm.handleSubmit(async (values) => {
                      try {
                        await moveMutation.mutateAsync({
                          warehouseId: values.warehouseId,
                          locationId: values.locationId,
                          note: values.note || null,
                        });
                        moveForm.setValue('note', '');
                      } catch {
                        // mutation.error renders below.
                      }
                    })}
                  >
                    <WarehouseLocationFields
                      idPrefix="device-move"
                      warehouses={warehouses}
                      warehouseField={moveForm.register('warehouseId')}
                      locationField={moveForm.register('locationId')}
                      selectedWarehouseId={moveWarehouseId}
                    />
                    <input
                      type="text"
                      aria-label="Move note"
                      placeholder="Note (optional)"
                      className={fieldClass}
                      {...moveForm.register('note')}
                    />
                    {moveForm.formState.errors.locationId && (
                      <p role="alert" className="text-xs text-rose-700">
                        {moveForm.formState.errors.locationId.message}
                      </p>
                    )}
                    {moveError && (
                      <p role="alert" className="text-xs text-rose-700">
                        {moveError}
                      </p>
                    )}
                    <Button type="submit" size="sm" disabled={moveMutation.isPending}>
                      {moveMutation.isPending ? 'Moving…' : 'Move device'}
                    </Button>
                  </form>
                </section>
              </div>
            )}

            <section aria-labelledby="device-history-heading">
              <h3 id="device-history-heading" className="text-sm font-semibold text-slate-900">
                Event history
              </h3>
              {events.isError ? (
                <p role="alert" className="mt-2 text-sm text-rose-700">
                  The event history failed to load.
                </p>
              ) : events.isPending ? (
                <p className="mt-2 text-sm text-slate-500" role="status">
                  Loading history…
                </p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {events.data.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">
                          {deviceEventLabels[event.eventType]}
                        </span>
                        <span className="text-xs text-slate-500">
                          {dateTime.format(new Date(event.createdAt))}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {event.statusFrom && event.statusTo
                          ? `${deviceStatusLabels[event.statusFrom]} → ${deviceStatusLabels[event.statusTo]}`
                          : null}
                        {event.locationTo && !event.statusFrom ? 'Location updated' : null}
                        {event.note ? ` · ${event.note}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500" role="status">
            Loading device…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
