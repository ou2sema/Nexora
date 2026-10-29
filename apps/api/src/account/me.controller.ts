import { Controller, Get } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import type { MeResponse } from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantDatabase } from '../database/tenant-database.service';
import { memberships, organizations } from '../database/schema';

@Controller('me')
export class MeController {
  constructor(private readonly tenantDatabase: TenantDatabase) {}

  @Get()
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    const rows = await this.tenantDatabase.asUser(user.id, (tx) =>
      tx
        .select({
          organizationId: organizations.id,
          organizationName: organizations.name,
          organizationSlug: organizations.slug,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
        .where(eq(memberships.userId, user.id))
        .orderBy(asc(organizations.name)),
    );

    return {
      user: { id: user.id, email: user.email },
      memberships: rows,
    };
  }
}
