import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { InvitationRole } from '@mystock/contracts';

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
import { useCreateInvitation } from './api';
import { roleLabels } from './labels';

const schema = z.object({
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

const emptyValues: Values = { email: '', role: 'viewer' };

interface InviteDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteDialog({ organizationId, open, onOpenChange }: InviteDialogProps) {
  const mutation = useCreateInvitation(organizationId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) reset(emptyValues);
  }, [open, reset]);

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'The invitation could not be created.'
        : null;

  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({ email: values.email, role: values.role as InvitationRole });
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Invite a team member</DialogTitle>
        <DialogDescription>
          The invitation appears for this email after they sign in. MyStock does not send email, so
          tell them to look for the pending invitation.
        </DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="invite-email"
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
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700">
              Role
            </label>
            <select id="invite-role" className={fieldClass} {...register('role')}>
              <option value="viewer">{roleLabels.viewer}</option>
              <option value="manager">{roleLabels.manager}</option>
              <option value="admin">{roleLabels.admin}</option>
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
