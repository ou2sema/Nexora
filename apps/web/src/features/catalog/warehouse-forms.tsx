import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { WarehouseSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import { useCreateLocation, useCreateWarehouse } from './api';

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500';

const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{2,16}$/, 'Use 2 to 16 letters, digits or hyphens'),
  name: z.string().trim().min(1, 'Enter a warehouse name').max(120),
  city: z.string().trim().max(120),
  countryCode: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[A-Za-z]{2}$/.test(value), 'Use a two-letter code'),
  addressLine: z.string().trim().max(200),
});

type WarehouseValues = z.infer<typeof warehouseSchema>;

interface WarehouseFormDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WarehouseFormDialog({
  organizationId,
  open,
  onOpenChange,
}: WarehouseFormDialogProps) {
  const mutation = useCreateWarehouse(organizationId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WarehouseValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { code: '', name: '', city: '', countryCode: 'TN', addressLine: '' },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'The warehouse could not be created.'
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Add warehouse</DialogTitle>
        <DialogDescription>
          Warehouse codes are unique within the organization and stored in uppercase.
        </DialogDescription>

        <form
          noValidate
          className="mt-5 space-y-4"
          onSubmit={handleSubmit(async (values) => {
            try {
              await mutation.mutateAsync({
                code: values.code.toUpperCase(),
                name: values.name,
                city: values.city || null,
                countryCode: values.countryCode ? values.countryCode.toUpperCase() : null,
                addressLine: values.addressLine || null,
              });
              reset();
              onOpenChange(false);
            } catch {
              // mutation.error renders below.
            }
          })}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="warehouse-code" className="block text-sm font-medium text-slate-700">
                Code
              </label>
              <input
                id="warehouse-code"
                className={fieldClass}
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? 'warehouse-code-error' : undefined}
                {...register('code')}
              />
              {errors.code && (
                <p id="warehouse-code-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.code.message}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="warehouse-name" className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="warehouse-name"
                className={fieldClass}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'warehouse-name-error' : undefined}
                {...register('name')}
              />
              {errors.name && (
                <p id="warehouse-name-error" role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.name.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="warehouse-city" className="block text-sm font-medium text-slate-700">
                City
              </label>
              <input id="warehouse-city" className={fieldClass} {...register('city')} />
            </div>
            <div>
              <label
                htmlFor="warehouse-country"
                className="block text-sm font-medium text-slate-700"
              >
                Country
              </label>
              <input
                id="warehouse-country"
                className={fieldClass}
                maxLength={2}
                {...register('countryCode')}
              />
              {errors.countryCode && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.countryCode.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="warehouse-address" className="block text-sm font-medium text-slate-700">
              Address
            </label>
            <input id="warehouse-address" className={fieldClass} {...register('addressLine')} />
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
              {mutation.isPending ? 'Saving…' : 'Create warehouse'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const locationSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,24}$/, 'Use 1 to 24 letters, digits or hyphens'),
  name: z.string().trim().min(1, 'Enter a location name').max(120),
});

type LocationValues = z.infer<typeof locationSchema>;

interface LocationFormDialogProps {
  organizationId: string;
  warehouse: WarehouseSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationFormDialog({
  organizationId,
  warehouse,
  open,
  onOpenChange,
}: LocationFormDialogProps) {
  const mutation = useCreateLocation(organizationId, warehouse.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LocationValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { code: '', name: '' },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'The storage location could not be created.'
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Add storage location</DialogTitle>
        <DialogDescription>
          {warehouse.name} · codes are unique inside this warehouse.
        </DialogDescription>

        <form
          noValidate
          className="mt-5 space-y-4"
          onSubmit={handleSubmit(async (values) => {
            try {
              await mutation.mutateAsync({
                code: values.code.toUpperCase(),
                name: values.name,
              });
              reset();
              onOpenChange(false);
            } catch {
              // mutation.error renders below.
            }
          })}
        >
          <div>
            <label htmlFor="location-code" className="block text-sm font-medium text-slate-700">
              Code
            </label>
            <input
              id="location-code"
              className={fieldClass}
              aria-invalid={Boolean(errors.code)}
              aria-describedby={errors.code ? 'location-code-error' : undefined}
              {...register('code')}
            />
            {errors.code && (
              <p id="location-code-error" role="alert" className="mt-1 text-xs text-rose-700">
                {errors.code.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="location-name" className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="location-name"
              className={fieldClass}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'location-name-error' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="location-name-error" role="alert" className="mt-1 text-xs text-rose-700">
                {errors.name.message}
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
              {mutation.isPending ? 'Saving…' : 'Create location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
