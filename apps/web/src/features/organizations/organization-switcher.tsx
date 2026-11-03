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
import { useLogoImage } from '@/features/branding/api';
import { useI18n } from '@/i18n/provider';
import { CreateOrganizationForm } from './create-organization-form';
import { useOrganization } from './organization-provider';

export function OrganizationSwitcher() {
  const { memberships, organization, platformAdmin, selectOrganization } = useOrganization();
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const logoUrl = useLogoImage(organization?.logo ?? null);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {organization ? (
        <label className="flex min-w-0 items-center gap-2">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="hidden size-6 shrink-0 rounded-md bg-white object-contain p-0.5 ring-1 ring-slate-200 sm:block"
            />
          ) : (
            <Building2 aria-hidden="true" className="hidden size-4 text-slate-400 sm:block" />
          )}
          <span className="sr-only">{t('organizations.label')}</span>
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
        <p className="text-sm font-medium text-slate-500">{t('organizations.none')}</p>
      )}

      {platformAdmin && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={t('organizations.createAction')}>
              <Plus aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">{t('organizations.newShort')}</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{t('organizations.createTitle')}</DialogTitle>
            <DialogDescription>{t('organizations.createDescription')}</DialogDescription>
            <div className="mt-4">
              <CreateOrganizationForm onCreated={() => setCreateOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
