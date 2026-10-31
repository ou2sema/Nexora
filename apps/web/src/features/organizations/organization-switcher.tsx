import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreateOrganizationForm } from './create-organization-form';
import { useOrganization } from './organization-provider';

export function OrganizationSwitcher() {
  const { memberships, organization, platformAdmin, selectOrganization } = useOrganization();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {organization ? (
        <label className="flex min-w-0 items-center gap-2">
          <Building2 aria-hidden="true" className="hidden size-4 text-slate-400 sm:block" />
          <span className="sr-only">Organization</span>
          <select
            value={organization.organizationId}
            onChange={(event) => selectOrganization(event.target.value)}
            className="max-w-[10rem] truncate rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-500 sm:max-w-[16rem]"
          >
            {memberships.map((membership) => (
              <option key={membership.organizationId} value={membership.organizationId}>
                {membership.organizationName}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm font-medium text-slate-500">No organization</p>
      )}

      {platformAdmin && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Create organization">
              <Plus aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">New org</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>
              You become the owner. The slug is derived from the name and must be unique.
            </DialogDescription>
            <div className="mt-4">
              <CreateOrganizationForm onCreated={() => setCreateOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
