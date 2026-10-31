import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
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
import { roleKeys } from '@/features/team/labels';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { useAdminInviteMember } from './api';

type Values = { organizationId: string; email: string; role: InvitationRole };

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
  const { t, errorMessage } = useI18n();
  const mutation = useAdminInviteMember();
  const defaultOrganizationId = initialOrganizationId || organizations[0]?.id || '';

  const schema = useMemo(
    () =>
      z.object({
        organizationId: z.string().min(1, t('adminInvite.organizationRequired')),
        email: z
          .string()
          .trim()
          .min(1, t('adminInvite.emailRequired'))
          .max(254)
          .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
            message: t('adminInvite.emailInvalid'),
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
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { organizationId: defaultOrganizationId, email: '', role: 'manager' },
  });

  useEffect(() => {
    if (open) {
      reset({ organizationId: defaultOrganizationId, email: '', role: 'manager' });
    }
  }, [open, reset, defaultOrganizationId]);

  const error = mutation.error ? errorMessage(mutation.error, 'adminInvite.createFailed') : null;

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
        <DialogTitle>{t('adminInvite.title')}</DialogTitle>
        <DialogDescription>{t('adminInvite.description')}</DialogDescription>

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label
              htmlFor="admin-invite-organization"
              className="block text-sm font-medium text-slate-700"
            >
              {t('common.organization')}
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
              {t('common.email')}
            </label>
            <input
              id="admin-invite-email"
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
            <label htmlFor="admin-invite-role" className="block text-sm font-medium text-slate-700">
              {t('adminInvite.roleLabel')}
            </label>
            <select id="admin-invite-role" className={fieldClass} {...register('role')}>
              <option value="manager">{t(roleKeys.manager)}</option>
              <option value="admin">{t(roleKeys.admin)}</option>
              <option value="viewer">{t(roleKeys.viewer)}</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">{t('adminInvite.ownershipNote')}</p>
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
            <Button type="submit" disabled={mutation.isPending || organizations.length === 0}>
              {mutation.isPending ? t('adminInvite.sending') : t('adminInvite.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
