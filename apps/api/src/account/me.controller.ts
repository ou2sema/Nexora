import { Controller, Get } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import type { MeResponse } from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantDatabase } from '../database/tenant-database.service';
import { memberships, organizations } from '../database/schema';
import { readVisibleLogoMetadata } from '../logos/logo.reader';

@Controller('me')
export class MeController {
  constructor(private readonly tenantDatabase: TenantDatabase) {}

  @Get()
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.tenantDatabase.asUser(user.id, async (tx) => {
      const rows = await tx
        .select({
          organizationId: organizations.id,
          organizationName: organizations.name,
          organizationSlug: organizations.slug,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
        .where(eq(memberships.userId, user.id))
        .orderBy(asc(organizations.name));

      const [profile] = resultRows<{ is_platform_admin: boolean }>(
        await tx.execute(sql`select app.is_platform_admin() as is_platform_admin`),
      );

      const logos = new Map(
        (await readVisibleLogoMetadata(tx)).map((logo) => [logo.organizationId, logo]),
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          platformAdmin: profile?.is_platform_admin === true,
        },
        memberships: rows.map((row) => ({
          ...row,
          logo: logos.get(row.organizationId) ?? null,
        })),
      };
    });
  }
}
