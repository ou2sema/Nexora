import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
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
import { roleKeys } from '@/features/team/labels';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { useCreateInvitation } from './api';

type Values = { email: string; role: InvitationRole };

interface InviteDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedRoles?: InvitationRole[];
}

export function InviteDialog({
  organizationId,
  open,
  onOpenChange,
  allowedRoles = ['viewer', 'manager', 'admin'],
}: InviteDialogProps) {
  const { t, errorMessage } = useI18n();
  const mutation = useCreateInvitation(organizationId);
  const defaultRole = allowedRoles[0] ?? 'viewer';
  const emptyValues: Values = { email: '', role: defaultRole };

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, t('invite.emailRequired'))
          .max(254)
          .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
            message: t('invite.emailInvalid'),
          }),
        role: z.enum(['admin', 'manager', 'viewer']),
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
    if (open) reset({ email: '', role: defaultRole });
  }, [open, reset, defaultRole]);

  const error = mutation.error ? errorMessage(mutation.error, 'invite.createFailed') : null;

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
        <DialogTitle>{t('invite.title')}</DialogTitle>
        <DialogDescription>{t('invite.description')}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700">
              {t('common.email')}
            </label>
            <input
              id="invite-email"
              type="email"
              dir="ltr"
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
              {t('team.roleLabel')}
            </label>
            {allowedRoles.length > 1 ? (
              <select id="invite-role" className={fieldClass} {...register('role')}>
                {allowedRoles.map((role) => (
                  <option key={role} value={role}>
                    {t(roleKeys[role])}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                {t(roleKeys[defaultRole])}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {allowedRoles.length === 1
                ? t('invite.managersViewersOnly')
                : t('invite.ownershipNote')}
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('invite.sending') : t('invite.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
