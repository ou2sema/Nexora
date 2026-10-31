import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
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
import { ApiError } from '@/lib/api-client';
import { fieldClass } from '@/lib/form-field';
import { useCreateSupplier, useUpdateSupplier } from './api';

const optionalText = (max: number) => z.string().trim().max(max);

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the supplier name').max(160),
  contactName: optionalText(160),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Enter a valid email address',
    }),
  phone: optionalText(40),
  addressLine: optionalText(200),
  city: optionalText(120),
  countryCode: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[A-Za-z]{2}$/.test(value), {
      message: 'Use a two-letter country code',
    }),
  taxId: optionalText(60),
  notes: optionalText(2000),
});

type Values = z.infer<typeof schema>;

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
  const createMutation = useCreateSupplier(organizationId);
  const updateMutation = useUpdateSupplier(organizationId);
  const mutation = supplier ? updateMutation : createMutation;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) reset(valuesOf(supplier));
  }, [open, supplier, reset]);

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'The supplier could not be saved.'
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
        <DialogTitle>{supplier ? 'Edit supplier' : 'New supplier'}</DialogTitle>
        <DialogDescription>
          Suppliers are shared by every purchase order in this organization.
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-name" className="block text-sm font-medium text-slate-700">
                Name
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
                Contact name (optional)
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
                Email (optional)
              </label>
              <input
                id="supplier-email"
                type="email"
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
                Phone (optional)
              </label>
              <input id="supplier-phone" type="tel" className={fieldClass} {...register('phone')} />
            </div>
          </div>

          <div>
            <label htmlFor="supplier-address" className="block text-sm font-medium text-slate-700">
              Address (optional)
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
                City (optional)
              </label>
              <input id="supplier-city" type="text" className={fieldClass} {...register('city')} />
            </div>

            <div>
              <label
                htmlFor="supplier-country"
                className="block text-sm font-medium text-slate-700"
              >
                Country code (optional)
              </label>
              <input
                id="supplier-country"
                type="text"
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
                Tax ID (optional)
              </label>
              <input
                id="supplier-tax-id"
                type="text"
                className={fieldClass}
                {...register('taxId')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="supplier-notes" className="block text-sm font-medium text-slate-700">
              Notes (optional)
            </label>
            <textarea id="supplier-notes" rows={3} className={fieldClass} {...register('notes')} />
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
              {mutation.isPending ? 'Saving…' : supplier ? 'Save supplier' : 'Create supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
