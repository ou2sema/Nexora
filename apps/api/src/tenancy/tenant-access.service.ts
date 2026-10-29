import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import type { MemberRole } from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { memberships } from '../database/schema';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantDatabase } from '../database/tenant-database.service';
import type { AppTransaction } from '../database/database.types';

export const CATALOG_WRITERS: readonly MemberRole[] = ['owner', 'admin', 'manager'];

interface Options {
  roles?: readonly MemberRole[];
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
}
