import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { OrganizationSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useCreateOrganization } from './api';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter an organization name').max(120),
});

type Values = z.infer<typeof schema>;

interface CreateOrganizationFormProps {
  onCreated?: (organization: OrganizationSummary) => void;
}

export function CreateOrganizationForm({ onCreated }: CreateOrganizationFormProps) {
  const mutation = useCreateOrganization();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
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
          const organization = await mutation.mutateAsync({ name: values.name });
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
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
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
