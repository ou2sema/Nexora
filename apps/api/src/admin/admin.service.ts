import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { AdminOrganizationsResponse } from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
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

@Injectable()
export class AdminService {
  constructor(private readonly database: TenantDatabase) {}

  async listOrganizations(userId: string): Promise<AdminOrganizationsResponse> {
    return this.database.asUser(userId, async (tx) => {
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
}
