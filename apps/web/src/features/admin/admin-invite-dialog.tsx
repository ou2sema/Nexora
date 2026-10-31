import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { AdminOrganizationSummary, InvitationRole } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { roleLabels } from '@/features/team/labels';
import { ApiError } from '@/lib/api-client';
import { fieldClass } from '@/lib/form-field';
import { useAdminInviteMember } from './api';

const schema = z.object({
  organizationId: z.string().min(1, 'Choose an organization'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address')
    .max(254)
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Enter a valid email address',
    }),
  role: z.enum(['admin', 'manager', 'viewer']),
});

type Values = z.infer<typeof schema>;

interface AdminInviteDialogProps {
  organizations: AdminOrganizationSummary[];
  initialOrganizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminInviteDialog({
  organizations,
  initialOrganizationId,
  open,
  onOpenChange,
}: AdminInviteDialogProps) {
  const mutation = useAdminInviteMember();
  const defaultOrganizationId = initialOrganizationId || organizations[0]?.id || '';
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { organizationId: defaultOrganizationId, email: '', role: 'manager' },
  });

  useEffect(() => {
    if (open) {
      reset({ organizationId: defaultOrganizationId, email: '', role: 'manager' });
    }
  }, [open, reset, defaultOrganizationId]);

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'The invitation could not be created.'
        : null;

  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        organizationId: values.organizationId,
        email: values.email,
        role: values.role as InvitationRole,
      });
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Invite a member</DialogTitle>
        <DialogDescription>
          Choose the organization and role. MyStock does not send email, so share the pending
          invitation with the person; it appears after they sign in with this address.
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label
              htmlFor="admin-invite-organization"
              className="block text-sm font-medium text-slate-700"
            >
              Organization
            </label>
            <select
              id="admin-invite-organization"
              className={fieldClass}
              aria-invalid={Boolean(errors.organizationId)}
              {...register('organizationId')}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} ({organization.slug})
                </option>
              ))}
            </select>
            {errors.organizationId && (
              <p role="alert" className="mt-1 text-xs text-rose-700">
                {errors.organizationId.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="admin-invite-email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="admin-invite-email"
              type="email"
              autoComplete="off"
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
            <label htmlFor="admin-invite-role" className="block text-sm font-medium text-slate-700">
              Role
            </label>
            <select id="admin-invite-role" className={fieldClass} {...register('role')}>
              <option value="manager">{roleLabels.manager}</option>
              <option value="admin">{roleLabels.admin}</option>
              <option value="viewer">{roleLabels.viewer}</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Ownership is transferred by changing an existing member, not by invitation.
            </p>
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
            <Button type="submit" disabled={mutation.isPending || organizations.length === 0}>
              {mutation.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
