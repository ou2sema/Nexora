import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { SupplierSummary } from '@mystock/contracts';

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
import { fieldClass } from '@/lib/form-field';
import { useCreateSupplier, useUpdateSupplier } from './api';

const optionalText = (max: number) => z.string().trim().max(max);

type Values = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  countryCode: string;
  taxId: string;
  notes: string;
};

interface SupplierDialogProps {
  organizationId: string;
  supplier: SupplierSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyValues: Values = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  addressLine: '',
  city: '',
  countryCode: '',
  taxId: '',
  notes: '',
};

function valuesOf(supplier: SupplierSummary | null): Values {
  if (!supplier) return emptyValues;

  return {
    name: supplier.name,
    contactName: supplier.contactName ?? '',
    email: supplier.email ?? '',
    phone: supplier.phone ?? '',
    addressLine: supplier.addressLine ?? '',
    city: supplier.city ?? '',
    countryCode: supplier.countryCode ?? '',
    taxId: supplier.taxId ?? '',
    notes: supplier.notes ?? '',
  };
}

export function SupplierDialog({
  organizationId,
  supplier,
  open,
  onOpenChange,
}: SupplierDialogProps) {
  const { t, errorMessage } = useI18n();
  const createMutation = useCreateSupplier(organizationId);
  const updateMutation = useUpdateSupplier(organizationId);
  const mutation = supplier ? updateMutation : createMutation;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('supplierDialog.nameRequired')).max(160),
        contactName: optionalText(160),
        email: z
          .string()
          .trim()
          .max(254)
          .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
            message: t('supplierDialog.invalidEmail'),
          }),
        phone: optionalText(40),
        addressLine: optionalText(200),
        city: optionalText(120),
        countryCode: z
          .string()
          .trim()
          .refine((value) => value === '' || /^[A-Za-z]{2}$/.test(value), {
            message: t('supplierDialog.countryCodeInvalid'),
          }),
        taxId: optionalText(60),
        notes: optionalText(2000),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) reset(valuesOf(supplier));
  }, [open, supplier, reset]);

  const saveError = mutation.error
    ? errorMessage(mutation.error, 'supplierDialog.saveFailed')
    : null;

  const submit = handleSubmit(async (values) => {
    const details = {
      name: values.name,
      contactName: values.contactName || null,
      email: values.email || null,
      phone: values.phone || null,
      addressLine: values.addressLine || null,
      city: values.city || null,
      countryCode: values.countryCode ? values.countryCode.toUpperCase() : null,
      taxId: values.taxId || null,
      notes: values.notes || null,
    };

    try {
      if (supplier) {
        await updateMutation.mutateAsync({ supplierId: supplier.id, input: details });
      } else {
        await createMutation.mutateAsync(details);
      }
      reset(emptyValues);
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>
          {supplier ? t('supplierDialog.editTitle') : t('supplierDialog.newTitle')}
        </DialogTitle>
        <DialogDescription>{t('supplierDialog.description')}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-name" className="block text-sm font-medium text-slate-700">
                {t('common.name')}
              </label>
              <input
                id="supplier-name"
                type="text"
                className={fieldClass}
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
              {errors.name && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="supplier-contact"
                className="block text-sm font-medium text-slate-700"
              >
                {t('supplierDialog.contactName')}
              </label>
              <input
                id="supplier-contact"
                type="text"
                className={fieldClass}
                {...register('contactName')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-email" className="block text-sm font-medium text-slate-700">
                {t('supplierDialog.email')}
              </label>
              <input
                id="supplier-email"
                type="email"
                dir="ltr"
                className={fieldClass}
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="supplier-phone" className="block text-sm font-medium text-slate-700">
                {t('supplierDialog.phone')}
              </label>
              <input
                id="supplier-phone"
                type="tel"
                dir="ltr"
                className={fieldClass}
                {...register('phone')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="supplier-address" className="block text-sm font-medium text-slate-700">
              {t('supplierDialog.address')}
            </label>
            <input
              id="supplier-address"
              type="text"
              className={fieldClass}
              {...register('addressLine')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="supplier-city" className="block text-sm font-medium text-slate-700">
                {t('supplierDialog.city')}
              </label>
              <input id="supplier-city" type="text" className={fieldClass} {...register('city')} />
            </div>

            <div>
              <label
                htmlFor="supplier-country"
                className="block text-sm font-medium text-slate-700"
              >
                {t('supplierDialog.countryCode')}
              </label>
              <input
                id="supplier-country"
                type="text"
                dir="ltr"
                maxLength={2}
                placeholder="TN"
                className={fieldClass}
                aria-invalid={Boolean(errors.countryCode)}
                {...register('countryCode')}
              />
              {errors.countryCode && (
                <p role="alert" className="mt-1 text-xs text-rose-700">
                  {errors.countryCode.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="supplier-tax-id" className="block text-sm font-medium text-slate-700">
                {t('supplierDialog.taxId')}
              </label>
              <input
                id="supplier-tax-id"
                type="text"
                dir="ltr"
                className={fieldClass}
                {...register('taxId')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="supplier-notes" className="block text-sm font-medium text-slate-700">
              {t('supplierDialog.notes')}
            </label>
            <textarea id="supplier-notes" rows={3} className={fieldClass} {...register('notes')} />
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
              {mutation.isPending
                ? t('common.saving')
                : supplier
                  ? t('supplierDialog.save')
                  : t('supplierDialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
