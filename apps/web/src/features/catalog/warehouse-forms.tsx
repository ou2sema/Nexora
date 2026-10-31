import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
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
import { useI18n } from '@/i18n/provider';
import { useCreateLocation, useCreateWarehouse } from './api';

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500';

type WarehouseValues = {
  code: string;
  name: string;
  city: string;
  countryCode: string;
  addressLine: string;
};

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
  const { t, errorMessage } = useI18n();
  const mutation = useCreateWarehouse(organizationId);

  const warehouseSchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9-]{2,16}$/, t('warehouseForms.codeInvalid')),
        name: z.string().trim().min(1, t('warehouseForms.nameRequired')).max(120),
        city: z.string().trim().max(120),
        countryCode: z
          .string()
          .trim()
          .refine(
            (value) => value === '' || /^[A-Za-z]{2}$/.test(value),
            t('warehouseForms.countryCodeInvalid'),
          ),
        addressLine: z.string().trim().max(200),
      }),
    [t],
  );

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

  const saveError = mutation.error
    ? errorMessage(mutation.error, 'warehouseForms.warehouseCreateFailed')
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('warehouseForms.warehouseTitle')}</DialogTitle>
        <DialogDescription>{t('warehouseForms.warehouseDescription')}</DialogDescription>

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
                {t('warehouseForms.code')}
              </label>
              <input
                id="warehouse-code"
                dir="ltr"
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
                {t('common.name')}
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
                {t('warehouseForms.city')}
              </label>
              <input id="warehouse-city" className={fieldClass} {...register('city')} />
            </div>
            <div>
              <label
                htmlFor="warehouse-country"
                className="block text-sm font-medium text-slate-700"
              >
                {t('warehouseForms.country')}
              </label>
              <input
                id="warehouse-country"
                dir="ltr"
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
              {t('warehouseForms.address')}
            </label>
            <input id="warehouse-address" className={fieldClass} {...register('addressLine')} />
          </div>

          {saveError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {saveError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('warehouseForms.createWarehouse')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type LocationValues = {
  code: string;
  name: string;
};

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
  const { t, errorMessage } = useI18n();
  const mutation = useCreateLocation(organizationId, warehouse.id);

  const locationSchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9-]{1,24}$/, t('warehouseForms.locationCodeInvalid')),
        name: z.string().trim().min(1, t('warehouseForms.locationNameRequired')).max(120),
      }),
    [t],
  );

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

  const saveError = mutation.error
    ? errorMessage(mutation.error, 'warehouseForms.locationCreateFailed')
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('warehouseForms.locationTitle')}</DialogTitle>
        <DialogDescription>
          {t('warehouseForms.locationDescription', { warehouseName: warehouse.name })}
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
              {t('warehouseForms.code')}
            </label>
            <input
              id="location-code"
              dir="ltr"
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
              {t('common.name')}
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

          {saveError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {saveError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('warehouseForms.createLocation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
