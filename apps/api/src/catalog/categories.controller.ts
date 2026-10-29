import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import {
  type CategoryCreateInput,
  type CategorySummary,
  categoryCreateSchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CatalogService } from './catalog.service';
import { organizationParamsSchema, type OrganizationParams } from './catalog.schemas';

@Controller('organizations/:organizationId/categories')
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
  ): Promise<CategorySummary[]> {
    return this.catalog.listCategories(user.id, params.organizationId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(categoryCreateSchema)) input: CategoryCreateInput,
  ): Promise<CategorySummary> {
    return this.catalog.createCategory(user.id, params.organizationId, input);
  }
}
