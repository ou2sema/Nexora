import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { CustomerSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MessageKey, MessageValues } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';

import { useCreateCustomer, useUpdateCustomer } from './api';

type Translator = (key: MessageKey, values?: MessageValues) => string;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildCustomerSchema(t: Translator) {
  return z.object({
    name: z.string().trim().min(1, t('customer.form.nameRequired')).max(160),
    email: z
      .string()
      .trim()
      .max(254)
      .refine((value) => value === '' || EMAIL_PATTERN.test(value), {
        message: t('customer.form.invalidEmail'),
      }),
    phone: z.string().trim().max(40),
    addressLine: z.string().trim().max(200),
    city: z.string().trim().max(120),
    countryCode: z
      .string()
      .trim()
      .regex(/^$|^[A-Za-z]{2}$/, {
        message: t('customer.form.invalidCountry'),
      }),
    taxId: z.string().trim().max(60),
  });
}

type CustomerValues = z.infer<ReturnType<typeof buildCustomerSchema>>;

const blankValues: CustomerValues = {
  name: '',
  email: '',
  phone: '',
  addressLine: '',
  city: '',
  countryCode: '',
  taxId: '',
};

function valuesOf(customer: CustomerSummary | null): CustomerValues {
  if (!customer) return blankValues;

  return {
    name: customer.name,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    addressLine: customer.addressLine ?? '',
    city: customer.city ?? '',
    countryCode: customer.countryCode ?? '',
    taxId: customer.taxId ?? '',
  };
}

interface CustomerDialogProps {
  organizationId: string;
  /** A customer to edit; null creates one. */
  customer: CustomerSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The counter selects the saved customer; a directory page only needs the refreshed list. */
  onSaved?: (customer: CustomerSummary) => void;
}

/**
 * The whole of the customer model the depot needs: who bought, and the two
 * identification fields a Tunisian invoice prints. No purchase history, no
 * loyalty, no bank data.
 */
export function CustomerDialog({
  organizationId,
  customer,
  open,
  onOpenChange,
  onSaved,
}: CustomerDialogProps) {
  const { t, errorMessage } = useI18n();
  const schema = useMemo(() => buildCustomerSchema(t), [t]);
  const createMutation = useCreateCustomer(organizationId);
  const updateMutation = useUpdateCustomer(organizationId);
  const isEdit = customer !== null;
  const mutation = isEdit ? updateMutation : createMutation;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerValues>({
    resolver: zodResolver(schema),
    defaultValues: blankValues,
  });

  useEffect(() => {
    if (open) reset(valuesOf(customer));
  }, [open, customer, reset]);

  const submitError = mutation.error ? errorMessage(mutation.error, 'customer.save.failed') : null;

  const submit = handleSubmit(async (values) => {
    const input = {
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      addressLine: values.addressLine || null,
      city: values.city || null,
      countryCode: values.countryCode ? values.countryCode.toUpperCase() : null,
      taxId: values.taxId || null,
    };

    try {
      const saved = isEdit
        ? await updateMutation.mutateAsync({ customerId: customer.id, input })
        : await createMutation.mutateAsync(input);
      onSaved?.(saved);
      reset(valuesOf(saved));
      onOpenChange(false);
    } catch {
      // mutation.error renders in the footer.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t(isEdit ? 'customer.editTitle' : 'customer.newTitle')}</DialogTitle>
        <DialogDescription>{t('customer.form.description')}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="customer-name" className="block text-sm font-medium text-slate-700">
              {t('customer.form.name')}
            </label>
            <input
              id="customer-name"
              type="text"
              autoComplete="organization"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="customer-email" className="block text-sm font-medium text-slate-700">
                {t('customer.form.email')}
              </label>
              <input
                id="customer-email"
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
              <label htmlFor="customer-phone" className="block text-sm font-medium text-slate-700">
                {t('customer.form.phone')}
              </label>
              <input
                id="customer-phone"
                type="tel"
                dir="ltr"
                className={fieldClass}
                {...register('phone')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="customer-address" className="block text-sm font-medium text-slate-700">
              {t('customer.form.address')}
            </label>
            <input
              id="customer-address"
              type="text"
              className={fieldClass}
              {...register('addressLine')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="customer-city" className="block text-sm font-medium text-slate-700">
                {t('customer.form.city')}
              </label>
              <input id="customer-city" type="text" className={fieldClass} {...register('city')} />
            </div>
            <div>
              <label
                htmlFor="customer-country"
                className="block text-sm font-medium text-slate-700"
              >
                {t('customer.form.country')}
              </label>
              <input
                id="customer-country"
                type="text"
                dir="ltr"
                maxLength={2}
                placeholder="TN"
                className={`${fieldClass} font-mono uppercase`}
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
              <label htmlFor="customer-tax-id" className="block text-sm font-medium text-slate-700">
                {t('customer.form.taxId')}
              </label>
              <input
                id="customer-tax-id"
                type="text"
                dir="ltr"
                className={`${fieldClass} font-mono`}
                {...register('taxId')}
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">{t('customer.form.fiscalNote')}</p>

          {submitError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {submitError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t(isEdit ? 'customer.form.save' : 'customer.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
