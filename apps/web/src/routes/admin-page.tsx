import { Activity, Building2, Mail, Plus, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router';

import type { AdminAuditEvent } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AdminInviteDialog } from '@/features/admin/admin-invite-dialog';
import {
  adminAuditKey,
  adminOrganizationsKey,
  useAdminAudit,
  useAdminOrganizations,
} from '@/features/admin/api';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/features/organizations/organization-provider';
import { CreateOrganizationForm } from '@/features/organizations/create-organization-form';
import { useI18n } from '@/i18n/provider';
import type { MessageKey } from '@/i18n/messages';

const auditActionKeys: Record<string, MessageKey> = {
  organization_created: 'admin.audit.action.organizationCreated',
  invitation_created: 'admin.audit.action.invitationCreated',
  invitation_revoked: 'admin.audit.action.invitationRevoked',
  member_role_changed: 'admin.audit.action.memberRoleChanged',
  member_removed: 'admin.audit.action.memberRemoved',
};

export function AdminPage() {
  const { t, formatNumber, formatDate, formatDateTime, errorMessage } = useI18n();
  const { platformAdmin } = useOrganization();
  const queryClient = useQueryClient();
  const organizations = useAdminOrganizations();
  const audit = useAdminAudit();

  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteOrganizationId, setInviteOrganizationId] = useState('');

  if (!platformAdmin) {
    return <Navigate to="/" replace />;
  }

  const items = organizations.data?.items ?? [];
  const auditItems = audit.data?.items ?? [];

  const openInvite = (organizationId = '') => {
    setInviteOrganizationId(organizationId);
    setInviteOpen(true);
  };

  const auditDetail = (event: AdminAuditEvent): string => {
    const detail = event.detail;

    switch (event.action) {
      case 'organization_created':
        return typeof detail.slug === 'string' ? detail.slug : '';
      case 'invitation_created':
      case 'invitation_revoked':
        return typeof detail.role === 'string'
          ? t('admin.audit.invitationDetail', { role: detail.role })
          : '';
      case 'member_role_changed':
        return typeof detail.from === 'string' && typeof detail.to === 'string'
          ? `${detail.from} → ${detail.to}`
          : '';
      case 'member_removed':
        return typeof detail.role === 'string'
          ? t('admin.audit.memberRemovedDetail', { role: detail.role })
          : '';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            <ShieldCheck aria-hidden="true" className="size-6 text-indigo-600" />
            {t('admin.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t('admin.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void organizations.refetch()}
            disabled={organizations.isFetching}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {t('common.refresh')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={items.length === 0}
            onClick={() => openInvite()}
          >
            <Mail aria-hidden="true" className="size-4" />
            {t('admin.inviteMember')}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t('admin.newOrganization')}
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
            {t('admin.organizationsHeading')}
          </h2>
          <span className="ms-auto text-xs text-slate-500">
            {organizations.data ? t('admin.total', { count: formatNumber(items.length) }) : ''}
          </span>
        </div>

        {organizations.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-800">
              {errorMessage(organizations.error, 'admin.organizationsLoadFailed')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void organizations.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        ) : organizations.isPending ? (
          <div
            className="divide-y divide-slate-100"
            role="status"
            aria-label={t('admin.loadingOrganizations')}
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
            <h3 className="mt-4 text-base font-semibold text-slate-900">{t('admin.emptyTitle')}</h3>
            <p className="mt-2 max-w-md text-sm text-slate-600">{t('admin.emptyBody')}</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              {t('admin.newOrganization')}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">{t('admin.organizationsCaption')}</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.organization')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('admin.membersColumn')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('admin.pendingInvitationsColumn')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('admin.createdColumn')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">
                    {t('common.actions')}
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
                          {t('admin.invite')}
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                          <Link to={`/admin/organizations/${organization.id}/team`}>
                            <Users aria-hidden="true" className="size-4" />
                            {t('admin.manageTeam')}
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

      <section
        aria-labelledby="admin-audit-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Activity aria-hidden="true" className="size-4 text-slate-500" />
          <h2 id="admin-audit-heading" className="text-sm font-semibold text-slate-900">
            {t('admin.auditHeading')}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            className="ms-auto"
            onClick={() => void audit.refetch()}
            disabled={audit.isFetching}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {t('common.refresh')}
          </Button>
        </div>

        {audit.isError ? (
          <p role="alert" className="px-4 py-6 text-sm text-rose-800">
            {errorMessage(audit.error, 'admin.auditLoadFailed')}
          </p>
        ) : audit.isPending ? (
          <p role="status" className="px-4 py-6 text-sm text-slate-500">
            {t('admin.auditLoading')}
          </p>
        ) : auditItems.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">{t('admin.auditEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <caption className="sr-only">{t('admin.auditCaption')}</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('admin.whenColumn')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('admin.actionColumn')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('common.organization')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('admin.targetColumn')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('admin.actorColumn')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditItems.map((event) => {
                  const detail = auditDetail(event);
                  const actionKey = auditActionKeys[event.action];

                  return (
                    <tr key={event.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(event.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {actionKey ? t(actionKey) : event.action}
                        </p>
                        {detail ? <p className="mt-0.5 text-xs text-slate-500">{detail}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {event.organizationName ?? t('common.notAvailable')}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span dir={event.targetEmail ? 'ltr' : undefined}>
                          {event.targetEmail ?? t('common.notAvailable')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span dir={event.actorEmail ? 'ltr' : undefined}>
                          {event.actorEmail ?? t('common.notAvailable')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">{t('admin.footer')}</p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogTitle>{t('organizations.createTitle')}</DialogTitle>
          <DialogDescription>{t('admin.createOrganizationDescription')}</DialogDescription>
          <div className="mt-4">
            <CreateOrganizationForm
              showFirstMember
              onCreated={() => {
                setCreateOpen(false);
                void queryClient.invalidateQueries({ queryKey: adminOrganizationsKey });
                void queryClient.invalidateQueries({ queryKey: adminAuditKey });
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
