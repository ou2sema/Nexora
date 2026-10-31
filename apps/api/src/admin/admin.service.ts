import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type {
  AdminAuditQuery,
  AdminAuditResponse,
  AdminOrganizationsResponse,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantDatabase } from '../database/tenant-database.service';
import { toIso } from '../operations/operations.utils';

interface AdminOrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: Date | string;
  member_count: number | string;
  pending_invitation_count: number | string;
}

interface AdminAuditRow {
  id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  organization_id: string | null;
  organization_name: string | null;
  target_user_id: string | null;
  target_email: string | null;
  detail: unknown;
  created_at: Date | string;
}

@Injectable()
export class AdminService {
  constructor(private readonly database: TenantDatabase) {}

  async listOrganizations(userId: string): Promise<AdminOrganizationsResponse> {
    return this.database.asUser(userId, async (tx) => {
      await this.requirePlatformAdmin(tx);

      const rows = resultRows<AdminOrganizationRow>(
        await tx.execute(sql`
        select
          o.id,
          o.name,
          o.slug,
          o.created_at,
          (
            select count(*)
            from public.memberships m
            where m.organization_id = o.id
          ) as member_count,
          (
            select count(*)
            from public.organization_invitations i
            where i.organization_id = o.id
              and i.accepted_at is null
              and i.revoked_at is null
              and i.expires_at > now()
          ) as pending_invitation_count
        from public.organizations o
        order by lower(o.name), o.id
      `),
      );

      return {
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          createdAt: toIso(row.created_at),
          memberCount: Number(row.member_count),
          pendingInvitationCount: Number(row.pending_invitation_count),
        })),
      };
    });
  }

  async listAudit(userId: string, query: AdminAuditQuery): Promise<AdminAuditResponse> {
    return this.database.asUser(userId, async (tx) => {
      await this.requirePlatformAdmin(tx);

      const rows = resultRows<AdminAuditRow>(
        await tx.execute(sql`
          select
            e.id,
            e.action,
            e.actor_id,
            actor.email as actor_email,
            e.organization_id,
            o.name as organization_name,
            e.target_user_id,
            e.target_email,
            e.detail,
            e.created_at
          from public.admin_audit_events e
          left join public.profiles actor on actor.id = e.actor_id
          left join public.organizations o on o.id = e.organization_id
          order by e.created_at desc, e.id desc
          limit ${query.limit}
        `),
      );

      return {
        items: rows.map((row) => ({
          id: row.id,
          action: row.action,
          actorId: row.actor_id,
          actorEmail: row.actor_email,
          organizationId: row.organization_id,
          organizationName: row.organization_name,
          targetUserId: row.target_user_id,
          targetEmail: row.target_email,
          detail:
            typeof row.detail === 'object' && row.detail !== null && !Array.isArray(row.detail)
              ? (row.detail as Record<string, unknown>)
              : {},
          createdAt: toIso(row.created_at),
        })),
      };
    });
  }

  private async requirePlatformAdmin(tx: AppTransaction): Promise<void> {
    const [admin] = resultRows<{ is_platform_admin: boolean }>(
      await tx.execute(sql`select app.is_platform_admin() as is_platform_admin`),
    );

    if (admin?.is_platform_admin !== true) {
      throw new AppError(
        'platform_admin_required',
        'Platform administrator access is required.',
        403,
      );
    }
  }
}
