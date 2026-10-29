import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { type BrandCreateInput, type BrandSummary, brandCreateSchema } from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CatalogService } from './catalog.service';
import { organizationParamsSchema, type OrganizationParams } from './catalog.schemas';

@Controller('organizations/:organizationId/brands')
export class BrandsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
  ): Promise<BrandSummary[]> {
    return this.catalog.listBrands(user.id, params.organizationId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(brandCreateSchema)) input: BrandCreateInput,
  ): Promise<BrandSummary> {
    return this.catalog.createBrand(user.id, params.organizationId, input);
  }
}
