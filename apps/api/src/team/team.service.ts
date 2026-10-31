import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  type InvitationListResponse,
  type InvitationStatus,
  type InvitationSummary,
  type MembershipSummary,
  type PendingInvitationsResponse,
  type TeamMemberSummary,
  type TeamMembersResponse,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
import { memberships, organizationInvitations, organizations, profiles } from '../database/schema';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantDatabase } from '../database/tenant-database.service';
import { toIso } from '../operations/operations.utils';
// The class is a DI token at runtime, so it cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ORG_ADMINS, TenantAccessService } from '../tenancy/tenant-access.service';

const INVITATION_LIMIT = 100;

function invitationStatus(row: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InvitationStatus {
  if (row.acceptedAt) return 'accepted';
  if (row.revokedAt) return 'revoked';
  if (row.expiresAt.getTime() <= Date.now()) return 'expired';
  return 'pending';
}

function toMemberSummary(row: {
  userId: string;
  email: string | null;
  role: TeamMemberSummary['role'];
  createdAt: Date;
}): TeamMemberSummary {
  return {
    userId: row.userId,
    email: row.email,
    role: row.role,
    joinedAt: toIso(row.createdAt),
  };
}

@Injectable()
export class TeamService {
  constructor(
    private readonly access: TenantAccessService,
    private readonly database: TenantDatabase,
  ) {}

  async listMembers(userId: string, organizationId: string): Promise<TeamMembersResponse> {
    return this.access.runAsTeamMember(userId, organizationId, async (tx) => {
      const rows = await tx
        .select({
          userId: memberships.userId,
          email: profiles.email,
          role: memberships.role,
          createdAt: memberships.createdAt,
        })
        .from(memberships)
        .leftJoin(profiles, eq(profiles.id, memberships.userId))
        .where(eq(memberships.organizationId, organizationId))
        .orderBy(
          sql`case ${memberships.role}
            when 'owner' then 0
            when 'admin' then 1
            when 'manager' then 2
            else 3
          end`,
          sql`lower(${profiles.email}) nulls last`,
          asc(memberships.userId),
        );

      return { items: rows.map(toMemberSummary) };
    });
  }

  async changeMemberRole(
    userId: string,
    organizationId: string,
    targetUserId: string,
    role: TeamMemberSummary['role'],
  ): Promise<TeamMemberSummary> {
    return this.access.runAsTeamMember(
      userId,
      organizationId,
      async (tx) => {
        await tx.execute(sql`
          select app.change_member_role(
            ${organizationId}::uuid, ${targetUserId}::uuid, ${role}::app.member_role
          )
        `);

        return this.findMember(tx, organizationId, targetUserId);
      },
      { roles: ORG_ADMINS },
    );
  }

  async removeMember(userId: string, organizationId: string, targetUserId: string): Promise<void> {
    await this.access.runAsTeamMember(
      userId,
      organizationId,
      async (tx) => {
        await tx.execute(sql`
          select app.remove_organization_member(
            ${organizationId}::uuid, ${targetUserId}::uuid
          )
        `);
      },
      { roles: ORG_ADMINS },
    );
  }

  async listInvitations(userId: string, organizationId: string): Promise<InvitationListResponse> {
    return this.access.runAsTeamMember(
      userId,
      organizationId,
      async (tx) => {
        const inviter = alias(profiles, 'inviter');
        const rows = await tx
          .select({
            id: organizationInvitations.id,
            email: organizationInvitations.email,
            role: organizationInvitations.role,
            invitedByEmail: inviter.email,
            createdAt: organizationInvitations.createdAt,
            expiresAt: organizationInvitations.expiresAt,
            acceptedAt: organizationInvitations.acceptedAt,
            revokedAt: organizationInvitations.revokedAt,
          })
          .from(organizationInvitations)
          .leftJoin(inviter, eq(inviter.id, organizationInvitations.invitedBy))
          .where(eq(organizationInvitations.organizationId, organizationId))
          .orderBy(sql`${organizationInvitations.createdAt} desc`)
          .limit(INVITATION_LIMIT);

        return {
          items: rows.map((row): InvitationSummary => ({
            id: row.id,
            email: row.email,
            role: row.role,
            status: invitationStatus(row),
            invitedByEmail: row.invitedByEmail,
            createdAt: toIso(row.createdAt),
            expiresAt: toIso(row.expiresAt),
          })),
        };
      },
      { roles: ['owner', 'admin', 'manager'] },
    );
  }

  async createInvitation(
    userId: string,
    organizationId: string,
    email: string,
    role: InvitationSummary['role'],
  ): Promise<InvitationSummary> {
    return this.access.runAsTeamMember(
      userId,
      organizationId,
      async (tx, access) => {
        if (!access.platformAdmin && access.role === 'manager' && role !== 'viewer') {
          throw new AppError(
            'manager_invites_viewers_only',
            'Managers can invite viewers only. Ask an owner or admin to add a manager.',
            403,
          );
        }

        const [saved] = resultRows<{ id: string | null }>(
          await tx.execute(sql`
            select app.create_organization_invitation(
              ${organizationId}::uuid, ${email}, ${role}::app.member_role
            ) as id
          `),
        );

        if (!saved?.id) {
          throw new AppError('internal_error', 'Unexpected invitation response.', 500);
        }

        return this.findInvitation(tx, organizationId, saved.id);
      },
      { roles: ['owner', 'admin', 'manager'] },
    );
  }

  async revokeInvitation(
    userId: string,
    organizationId: string,
    invitationId: string,
  ): Promise<InvitationSummary> {
    return this.access.runAsTeamMember(
      userId,
      organizationId,
      async (tx) => {
        await tx.execute(sql`
          select app.revoke_organization_invitation(
            ${organizationId}::uuid, ${invitationId}::uuid
          )
        `);

        return this.findInvitation(tx, organizationId, invitationId);
      },
      { roles: ORG_ADMINS },
    );
  }

  async listMyInvitations(
    userId: string,
    email: string | null,
  ): Promise<PendingInvitationsResponse> {
    if (!email) return { items: [] };

    return this.database.asUser(
      userId,
      async (tx) => {
        const rows = resultRows<{
          invitation_id: string;
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          role: InvitationSummary['role'];
          expires_at: Date | string;
        }>(await tx.execute(sql`select * from app.my_pending_invitations()`));

        return {
          items: rows.map((row) => ({
            id: row.invitation_id,
            organizationId: row.organization_id,
            organizationName: row.organization_name,
            organizationSlug: row.organization_slug,
            role: row.role,
            expiresAt: toIso(row.expires_at),
          })),
        };
      },
      { email },
    );
  }

  async acceptInvitation(
    userId: string,
    email: string | null,
    invitationId: string,
  ): Promise<MembershipSummary> {
    return this.database.asUser(
      userId,
      async (tx) => {
        const [result] = resultRows<{ organization_id: string | null }>(
          await tx.execute(sql`
            select app.accept_invitation(${invitationId}::uuid) as organization_id
          `),
        );

        if (!result?.organization_id) {
          throw new AppError('internal_error', 'Unexpected invitation response.', 500);
        }

        const [membership] = await tx
          .select({
            organizationId: organizations.id,
            organizationName: organizations.name,
            organizationSlug: organizations.slug,
            role: memberships.role,
          })
          .from(memberships)
          .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
          .where(
            and(
              eq(memberships.organizationId, result.organization_id),
              eq(memberships.userId, userId),
            ),
          )
          .limit(1);

        if (!membership) {
          throw new AppError('internal_error', 'Membership was not created.', 500);
        }

        return membership;
      },
      { email },
    );
  }

  private async findMember(
    tx: AppTransaction,
    organizationId: string,
    userId: string,
  ): Promise<TeamMemberSummary> {
    const [row] = await tx
      .select({
        userId: memberships.userId,
        email: profiles.email,
        role: memberships.role,
        createdAt: memberships.createdAt,
      })
      .from(memberships)
      .leftJoin(profiles, eq(profiles.id, memberships.userId))
      .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId)))
      .limit(1);

    if (!row) {
      throw new AppError('member_not_found', 'Team member not found.', 404);
    }

    return toMemberSummary(row);
  }

  private async findInvitation(
    tx: AppTransaction,
    organizationId: string,
    invitationId: string,
  ): Promise<InvitationSummary> {
    const inviter = alias(profiles, 'inviter');
    const [row] = await tx
      .select({
        id: organizationInvitations.id,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        invitedByEmail: inviter.email,
        createdAt: organizationInvitations.createdAt,
        expiresAt: organizationInvitations.expiresAt,
        acceptedAt: organizationInvitations.acceptedAt,
        revokedAt: organizationInvitations.revokedAt,
      })
      .from(organizationInvitations)
      .leftJoin(inviter, eq(inviter.id, organizationInvitations.invitedBy))
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          eq(organizationInvitations.id, invitationId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new AppError('invitation_not_found', 'Invitation not found.', 404);
    }

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status: invitationStatus(row),
      invitedByEmail: row.invitedByEmail,
      createdAt: toIso(row.createdAt),
      expiresAt: toIso(row.expiresAt),
    };
  }
}
