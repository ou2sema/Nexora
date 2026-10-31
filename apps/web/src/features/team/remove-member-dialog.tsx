import type { TeamMemberSummary } from '@mystock/contracts';

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
import { useRemoveMember } from './api';
import { roleKeys } from './labels';

interface RemoveMemberDialogProps {
  organizationId: string;
  member: TeamMemberSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveMemberDialog({
  organizationId,
  member,
  open,
  onOpenChange,
}: RemoveMemberDialogProps) {
  const { t, errorMessage } = useI18n();
  const mutation = useRemoveMember(organizationId);

  const label = member?.email ?? t('memberDialog.thisMember');
  const error = mutation.error ? errorMessage(mutation.error, 'memberDialog.removeFailed') : null;

  const submit = async () => {
    if (!member) return;

    try {
      await mutation.mutateAsync(member.userId);
      onOpenChange(false);
    } catch {
      // mutation.error renders inside the dialog.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('memberDialog.title')}</DialogTitle>
        <DialogDescription>{t('memberDialog.description', { name: label })}</DialogDescription>

        {member && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span dir={member.email ? 'ltr' : undefined}>
              {member.email ?? t('team.unnamedMember')}
            </span>{' '}
            · {t(roleKeys[member.role])}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={mutation.isPending}
            className="bg-rose-600 hover:bg-rose-700"
            onClick={() => void submit()}
          >
            {mutation.isPending ? t('memberDialog.removing') : t('memberDialog.removeMember')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
