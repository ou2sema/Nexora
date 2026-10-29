import { Body, Controller, Post } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  createOrganizationSchema,
  type CreateOrganizationInput,
  type OrganizationSummary,
} from '@mystock/contracts';
import { slugify } from '@mystock/domain';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { AppError } from '../common/errors/app-error';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { organizations } from '../database/schema';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantDatabase } from '../database/tenant-database.service';

const createdIdSchema = z.uuid();

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly tenantDatabase: TenantDatabase) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createOrganizationSchema)) input: CreateOrganizationInput,
  ): Promise<OrganizationSummary> {
    const slug = input.slug ?? defaultSlug(input.name);

    const organization = await this.tenantDatabase.asUser(user.id, async (tx) => {
      const result = await tx.execute(
        sql`select app.create_organization(${input.name}, ${slug}) as id`,
      );
      const [createdRow] = resultRows<{ id?: unknown }>(result);
      const created = createdIdSchema.safeParse(createdRow?.id);
      if (!created.success) {
        throw new AppError('internal_error', 'The organization could not be created.', 500);
      }

      const [row] = await tx
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .where(eq(organizations.id, created.data));

      if (!row) {
        throw new AppError(
          'internal_error',
          'The organization could not be read after creation.',
          500,
        );
      }

      return row;
    });

    return { ...organization, createdAt: organization.createdAt.toISOString(), role: 'owner' };
  }
}

function defaultSlug(name: string): string {
  try {
    return slugify(name, 60);
  } catch {
    throw new AppError(
      'validation_error',
      'Provide an explicit slug: the name contains no letters or digits.',
      400,
    );
  }
}
