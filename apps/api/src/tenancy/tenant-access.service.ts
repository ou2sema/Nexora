import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import type { MemberRole } from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { resultRows } from '../database/results';
import { memberships } from '../database/schema';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantDatabase } from '../database/tenant-database.service';
import type { AppTransaction } from '../database/database.types';

export const CATALOG_WRITERS: readonly MemberRole[] = ['owner', 'admin', 'manager'];
export const ORG_ADMINS: readonly MemberRole[] = ['owner', 'admin'];
export const ALL_MEMBER_ROLES: readonly MemberRole[] = ['owner', 'admin', 'manager', 'viewer'];

interface Options {
  roles?: readonly MemberRole[];
}

export interface TeamAccess {
  role: MemberRole | null;
  platformAdmin: boolean;
}

/**
 * Opens a caller-scoped transaction and proves membership before the handler
 * touches any tenant row. RLS remains the backstop; this layer turns silent
 * zero-row results into explicit 404/403 responses.
 */
@Injectable()
export class TenantAccessService {
  constructor(private readonly database: TenantDatabase) {}

  async runAsMember<T>(
    userId: string,
    organizationId: string,
    action: (tx: AppTransaction) => Promise<T>,
    options: Options = {},
  ): Promise<T> {
    return this.database.asUser(userId, async (tx) => {
      const [membership] = await tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId)))
        .limit(1);

      if (!membership) {
        throw new AppError('organization_not_found', 'Organization not found.', 404);
      }

      if (options.roles && !options.roles.includes(membership.role)) {
        throw new AppError('forbidden', 'Your role does not allow this action.', 403);
      }

      return action(tx);
    });
  }

  /**
   * Team endpoints need two facts the tenant data paths do not: whether the caller is
   * a platform admin (who may act without a membership) and, when they are a member,
   * which role they hold (managers have a narrower invitation right). The database
   * functions and RLS remain the authority; this only shapes the HTTP response.
   */
  async runAsTeamMember<T>(
    userId: string,
    organizationId: string,
    action: (tx: AppTransaction, access: TeamAccess) => Promise<T>,
    options: Options = {},
  ): Promise<T> {
    return this.database.asUser(userId, async (tx) => {
      const [admin] = resultRows<{ is_platform_admin: boolean }>(
        await tx.execute(sql`select app.is_platform_admin() as is_platform_admin`),
      );
      const platformAdmin = admin?.is_platform_admin === true;

      const [membership] = await tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId)))
        .limit(1);

      if (!membership && !platformAdmin) {
        throw new AppError('organization_not_found', 'Organization not found.', 404);
      }

      if (
        !platformAdmin &&
        options.roles &&
        (!membership || !options.roles.includes(membership.role))
      ) {
        throw new AppError('forbidden', 'Your role does not allow this action.', 403);
      }

      return action(tx, { role: membership?.role ?? null, platformAdmin });
    });
  }
}
