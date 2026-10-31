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
import { ApiError } from '@/lib/api-client';
import { useRemoveMember } from './api';
import { roleLabels } from './labels';

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
  const mutation = useRemoveMember(organizationId);

  const label = member?.email ?? 'this member';
  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'The member could not be removed.'
        : null;

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
        <DialogTitle>Remove team member</DialogTitle>
        <DialogDescription>
          {label} loses access to this organization immediately. Their stock history stays intact.
        </DialogDescription>

        {member && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {member.email ?? 'Unnamed member'} · {roleLabels[member.role]}
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errorMessage}
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={mutation.isPending}
            className="bg-rose-600 hover:bg-rose-700"
            onClick={() => void submit()}
          >
            {mutation.isPending ? 'Removing…' : 'Remove member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
