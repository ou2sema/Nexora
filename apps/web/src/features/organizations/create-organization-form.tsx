import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { OrganizationSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { fieldClass } from '@/lib/form-field';
import { useCreateOrganization } from './api';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter an organization name').max(120),
    firstMemberEmail: z.string().trim().max(254),
    firstMemberRole: z.enum(['admin', 'manager', 'viewer']),
  })
  .superRefine((values, context) => {
    if (values.firstMemberEmail && !z.email().safeParse(values.firstMemberEmail).success) {
      context.addIssue({
        code: 'custom',
        path: ['firstMemberEmail'],
        message: 'Enter a valid email address',
      });
    }
  });

type Values = z.infer<typeof schema>;

interface CreateOrganizationFormProps {
  onCreated?: (organization: OrganizationSummary) => void;
  showFirstMember?: boolean;
}

export function CreateOrganizationForm({
  onCreated,
  showFirstMember = false,
}: CreateOrganizationFormProps) {
  const mutation = useCreateOrganization();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', firstMemberEmail: '', firstMemberRole: 'manager' },
  });

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'The organization could not be created.'
        : null;

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
          Organization name
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
          A URL-friendly slug is derived from the name.
        </p>
        {errors.name && (
          <p id="organization-name-error" role="alert" className="mt-1 text-xs text-rose-700">
            {errors.name.message}
          </p>
        )}
      </div>

      {showFirstMember && (
        <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">First member</legend>
          <p className="text-xs text-slate-500">
            Optional. You become the owner; this person receives an invitation for the selected
            role.
          </p>
          <div>
            <label
              htmlFor="organization-first-member-email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="organization-first-member-email"
              type="email"
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
              Role
            </label>
            <select
              id="organization-first-member-role"
              className={fieldClass}
              {...register('firstMemberRole')}
            >
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </fieldset>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessage}
        </p>
      )}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating…' : 'Create organization'}
      </Button>
    </form>
  );
}
