import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { OrganizationSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { useCreateOrganization } from './api';

type Values = {
  name: string;
  firstMemberEmail: string;
  firstMemberRole: 'admin' | 'manager' | 'viewer';
};

interface CreateOrganizationFormProps {
  onCreated?: (organization: OrganizationSummary) => void;
  showFirstMember?: boolean;
}

export function CreateOrganizationForm({
  onCreated,
  showFirstMember = false,
}: CreateOrganizationFormProps) {
  const mutation = useCreateOrganization();
  const { t, errorMessage } = useI18n();

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, t('organizations.form.nameRequired')).max(120),
          firstMemberEmail: z.string().trim().max(254),
          firstMemberRole: z.enum(['admin', 'manager', 'viewer']),
        })
        .superRefine((values, context) => {
          if (values.firstMemberEmail && !z.email().safeParse(values.firstMemberEmail).success) {
            context.addIssue({
              code: 'custom',
              path: ['firstMemberEmail'],
              message: t('organizations.form.invalidEmail'),
            });
          }
        }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', firstMemberEmail: '', firstMemberRole: 'manager' },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        try {
          const organization = await mutation.mutateAsync({
            name: values.name,
            ...(showFirstMember && values.firstMemberEmail
              ? {
                  firstMemberEmail: values.firstMemberEmail,
                  firstMemberRole: values.firstMemberRole,
                }
              : {}),
          });
          reset();
          onCreated?.(organization);
        } catch {
          // mutation.error renders below the field.
        }
      })}
    >
      <div>
        <label htmlFor="organization-name" className="block text-sm font-medium text-slate-700">
          {t('organizations.form.name')}
        </label>
        <input
          id="organization-name"
          autoFocus
          type="text"
          autoComplete="organization"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'organization-name-error' : 'organization-name-hint'}
          className={fieldClass}
          placeholder="SBS VISION"
          {...register('name')}
        />
        <p id="organization-name-hint" className="mt-1 text-xs text-slate-500">
          {t('organizations.form.slugHint')}
        </p>
        {errors.name && (
          <p id="organization-name-error" role="alert" className="mt-1 text-xs text-rose-700">
            {errors.name.message}
          </p>
        )}
      </div>

      {showFirstMember && (
        <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">
            {t('organizations.form.firstMember')}
          </legend>
          <p className="text-xs text-slate-500">{t('organizations.form.firstMemberHint')}</p>
          <div>
            <label
              htmlFor="organization-first-member-email"
              className="block text-sm font-medium text-slate-700"
            >
              {t('organizations.form.email')}
            </label>
            <input
              id="organization-first-member-email"
              type="email"
              dir="ltr"
              autoComplete="off"
              aria-invalid={Boolean(errors.firstMemberEmail)}
              className={fieldClass}
              placeholder="manager@example.com"
              {...register('firstMemberEmail')}
            />
            {errors.firstMemberEmail && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                {errors.firstMemberEmail.message}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="organization-first-member-role"
              className="block text-sm font-medium text-slate-700"
            >
              {t('organizations.form.role')}
            </label>
            <select
              id="organization-first-member-role"
              className={fieldClass}
              {...register('firstMemberRole')}
            >
              <option value="manager">{t('common.role.manager')}</option>
              <option value="admin">{t('common.role.admin')}</option>
              <option value="viewer">{t('common.role.viewer')}</option>
            </select>
          </div>
        </fieldset>
      )}

      {mutation.error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessage(mutation.error, 'organizations.form.failed')}
        </p>
      )}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t('organizations.form.creating') : t('organizations.form.create')}
      </Button>
    </form>
  );
}
