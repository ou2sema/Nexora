import { Mail, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import type {
  InvitationRole,
  InvitationStatus,
  InvitationSummary,
  MemberRole,
  TeamMemberSummary,
} from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-provider';
import { useOrganization } from '@/features/organizations/organization-provider';
import {
  useChangeMemberRole,
  useInvitations,
  useRevokeInvitation,
  useTeamMembers,
} from '@/features/team/api';
import { InviteDialog } from '@/features/team/invite-dialog';
import { formatDate, invitationStatusLabels, roleLabels } from '@/features/team/labels';
import { RemoveMemberDialog } from '@/features/team/remove-member-dialog';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';

const invitationStatusClasses: Record<InvitationStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  expired: 'bg-slate-100 text-slate-600 ring-slate-200',
  accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  revoked: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const ALL_ROLES: MemberRole[] = ['owner', 'admin', 'manager', 'viewer'];
const NON_OWNER_ROLES: MemberRole[] = ['admin', 'manager', 'viewer'];

function errorText(error: unknown, fallback: string): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : fallback;
}

interface TeamViewProps {
  organizationId: string;
  organizationName: string;
  role: MemberRole | null;
  platformAdmin?: boolean;
}

export function TeamView({
  organizationId,
  organizationName,
  role,
  platformAdmin = false,
}: TeamViewProps) {
  const { session } = useAuth();
  const currentUserId = session?.user.id ?? null;

  const canManageMembers = platformAdmin || role === 'owner' || role === 'admin';
  const canManageInvitations = canManageMembers || role === 'manager';
  const canAssignAnyRole = platformAdmin || role === 'owner' || role === 'admin';
  const canTouchOwners = platformAdmin || role === 'owner';

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<TeamMemberSummary | null>(null);

  const members = useTeamMembers(organizationId);
  const invitations = useInvitations(organizationId, canManageInvitations);
  const changeRole = useChangeMemberRole(organizationId);
  const revoke = useRevokeInvitation(organizationId);

  const roleOptions: MemberRole[] = canTouchOwners ? ALL_ROLES : NON_OWNER_ROLES;
  const inviteRoles: InvitationRole[] = canAssignAnyRole
    ? ['viewer', 'manager', 'admin']
    : ['viewer'];
  const inviteLabel = canAssignAnyRole ? 'Invite member' : 'Invite viewer';

  const roleError = errorText(changeRole.error, 'The role could not be changed.');
  const revokeError = errorText(revoke.error, 'The invitation could not be revoked.');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-600">Members and access for {organizationName}.</p>
        </div>
        {canManageInvitations && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden="true" className="size-4" />
            {inviteLabel}
          </Button>
        )}
      </header>

      {!canManageMembers && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          {role === 'manager'
            ? 'Managers can invite viewers. Owners and admins manage roles and invitations.'
            : `Your ${role ? roleLabels[role].toLowerCase() : 'read-only'} role can view the team. Owners and admins manage members and invitations.`}
        </p>
      )}

      {roleError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {roleError}
        </p>
      )}

      <section
        aria-labelledby="team-members-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Users aria-hidden="true" className="size-4 text-slate-500" />
          <h2 id="team-members-heading" className="text-sm font-semibold text-slate-900">
            Members
          </h2>
          <span className="ml-auto text-xs text-slate-500">
            {members.data ? `${members.data.items.length} total` : ''}
          </span>
        </div>

        {members.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-700">
              {errorText(members.error, 'Team members failed to load.')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void members.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : members.isPending ? (
          <div className="divide-y divide-slate-100" role="status" aria-label="Loading members">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-4 w-1/5 rounded bg-slate-100" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Organization members</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Member
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Joined
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.data.items.map((member) => {
                  const isSelf = member.userId === currentUserId;
                  const ownerRow = member.role === 'owner';
                  const canChangeRole = canManageMembers && (canTouchOwners || !ownerRow);
                  const canRemove = canManageMembers && !isSelf && (canTouchOwners || !ownerRow);
                  const rolePending =
                    changeRole.isPending && changeRole.variables?.userId === member.userId;

                  return (
                    <tr key={member.userId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {member.email ?? 'Unnamed member'}
                          {isSelf && (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                              You
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">{member.userId}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(member.joinedAt)}</td>
                      <td className="px-4 py-3">
                        {canChangeRole ? (
                          <select
                            aria-label={`Role for ${member.email ?? 'member'}`}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
                            value={member.role}
                            disabled={rolePending}
                            onChange={(event) =>
                              changeRole.mutate({
                                userId: member.userId,
                                role: event.target.value as MemberRole,
                              })
                            }
                          >
                            {roleOptions.map((option) => (
                              <option key={option} value={option}>
                                {roleLabels[option]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            {roleLabels[member.role]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {canManageMembers ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-rose-700 ring-rose-200 hover:bg-rose-50"
                              disabled={!canRemove}
                              title={
                                isSelf
                                  ? 'You cannot remove yourself'
                                  : !canRemove
                                    ? 'Only an owner can remove an owner'
                                    : undefined
                              }
                              onClick={() => setRemoving(member)}
                            >
                              <UserMinus aria-hidden="true" className="size-4" />
                              Remove
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManageInvitations && (
        <section
          aria-labelledby="team-invitations-heading"
          className="rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <Mail aria-hidden="true" className="size-4 text-slate-500" />
            <h2 id="team-invitations-heading" className="text-sm font-semibold text-slate-900">
              Invitations
            </h2>
            <span className="ml-auto text-xs text-slate-500">Expire after 14 days</span>
          </div>

          <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            MyStock does not send email. Share the invitation with the person; it appears for them
            after they sign in with the invited address.
          </p>

          {revokeError && (
            <p
              role="alert"
              className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {revokeError}
            </p>
          )}

          {invitations.isError ? (
            <div className="p-6">
              <p role="alert" className="text-sm text-rose-700">
                {errorText(invitations.error, 'Invitations failed to load.')}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void invitations.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : invitations.isPending ? (
            <div
              className="divide-y divide-slate-100"
              role="status"
              aria-label="Loading invitations"
            >
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                  <div className="h-4 w-1/3 rounded bg-slate-200" />
                  <div className="h-4 w-1/5 rounded bg-slate-100" />
                  <div className="h-4 w-1/6 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : invitations.data.items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
                <ShieldCheck aria-hidden="true" className="size-6" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">No invitations yet</h3>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                Invite a colleague by email and share the invitation with them directly.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Organization invitations</caption>
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Timeline
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.data.items.map((invitation: InvitationSummary) => (
                    <tr key={invitation.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{invitation.email}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {invitation.invitedByEmail
                            ? `Invited by ${invitation.invitedByEmail}`
                            : 'Inviter account removed'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{roleLabels[invitation.role]}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                            invitationStatusClasses[invitation.status],
                          )}
                        >
                          {invitationStatusLabels[invitation.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {invitation.status === 'pending' || invitation.status === 'expired' ? (
                          <span>Expires {formatDate(invitation.expiresAt)}</span>
                        ) : (
                          <span>Sent {formatDate(invitation.createdAt)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {canManageMembers && invitation.status === 'pending' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={revoke.isPending && revoke.variables === invitation.id}
                              onClick={() => revoke.mutate(invitation.id)}
                            >
                              {revoke.isPending && revoke.variables === invitation.id
                                ? 'Revoking…'
                                : 'Revoke'}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <InviteDialog
        organizationId={organizationId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        allowedRoles={inviteRoles}
      />
      {removing && (
        <RemoveMemberDialog
          key={removing.userId}
          organizationId={organizationId}
          member={removing}
          open
          onOpenChange={(open) => {
            if (!open) setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

export function TeamPage() {
  const { organization } = useOrganization();

  if (!organization) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
        <p className="mt-2 text-sm text-slate-600">
          Select an organization to view its team, or ask a platform administrator to add you to
          one.
        </p>
        <Link
          to="/admin"
          className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          Administration →
        </Link>
      </div>
    );
  }

  return (
    <TeamView
      organizationId={organization.organizationId}
      organizationName={organization.organizationName}
      role={organization.role}
    />
  );
}
