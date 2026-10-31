import { Building2, Mail, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AdminInviteDialog } from '@/features/admin/admin-invite-dialog';
import { adminOrganizationsKey, useAdminOrganizations } from '@/features/admin/api';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/features/organizations/organization-provider';
import { CreateOrganizationForm } from '@/features/organizations/create-organization-form';
import { formatDate } from '@/features/team/labels';

export function AdminPage() {
  const { platformAdmin } = useOrganization();
  const queryClient = useQueryClient();
  const organizations = useAdminOrganizations();

  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteOrganizationId, setInviteOrganizationId] = useState('');

  if (!platformAdmin) {
    return <Navigate to="/" replace />;
  }

  const items = organizations.data?.items ?? [];

  const openInvite = (organizationId = '') => {
    setInviteOrganizationId(organizationId);
    setInviteOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            <ShieldCheck aria-hidden="true" className="size-6 text-indigo-600" />
            Administration
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create organizations and manage membership across the platform. Business data stays
            scoped to each organization's members.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void organizations.refetch()}
            disabled={organizations.isFetching}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={items.length === 0}
            onClick={() => openInvite()}
          >
            <Mail aria-hidden="true" className="size-4" />
            Invite member
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            New organization
          </Button>
        </div>
      </header>

      <section
        aria-labelledby="admin-organizations-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Building2 aria-hidden="true" className="size-4 text-slate-500" />
          <h2 id="admin-organizations-heading" className="text-sm font-semibold text-slate-900">
            Organizations
          </h2>
          <span className="ml-auto text-xs text-slate-500">
            {organizations.data ? `${items.length} total` : ''}
          </span>
        </div>

        {organizations.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-800">
              {organizations.error instanceof Error
                ? organizations.error.message
                : 'Organizations failed to load.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void organizations.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : organizations.isPending ? (
          <div
            className="divide-y divide-slate-100"
            role="status"
            aria-label="Loading organizations"
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-4 w-1/5 rounded bg-slate-100" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <Building2 aria-hidden="true" className="size-6" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No organizations yet</h3>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Create the first organization and optionally invite its first manager or viewer.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              New organization
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Organizations on this platform</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Organization
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Members
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Pending invitations
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Created
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((organization) => (
                  <tr key={organization.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{organization.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">{organization.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{organization.memberCount}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {organization.pendingInvitationCount}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(organization.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openInvite(organization.id)}
                        >
                          <Mail aria-hidden="true" className="size-4" />
                          Invite
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                          <Link to={`/admin/organizations/${organization.id}/team`}>
                            <Users aria-hidden="true" className="size-4" />
                            Manage team
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Platform administration covers organizations, memberships and invitations. Stock, catalog,
        devices and orders require a membership in the relevant organization.
      </p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            You become the owner. Optionally invite the first manager or viewer, choosing their role
            below.
          </DialogDescription>
          <div className="mt-4">
            <CreateOrganizationForm
              showFirstMember
              onCreated={() => {
                setCreateOpen(false);
                void queryClient.invalidateQueries({ queryKey: adminOrganizationsKey });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AdminInviteDialog
        organizations={items}
        initialOrganizationId={inviteOrganizationId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  );
}
