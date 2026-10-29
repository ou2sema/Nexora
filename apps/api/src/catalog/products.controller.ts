import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  type ProductCreateInput,
  type ProductListQuery,
  type ProductListResponse,
  type ProductSummary,
  type ProductUpdateInput,
  productCreateSchema,
  productListQuerySchema,
  productUpdateSchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CatalogService } from './catalog.service';
import {
  organizationParamsSchema,
  type OrganizationParams,
  type ProductParams,
  productParamsSchema,
} from './catalog.schemas';

@Controller('organizations/:organizationId/products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(productListQuerySchema)) query: ProductListQuery,
  ): Promise<ProductListResponse> {
    return this.catalog.listProducts(user.id, params.organizationId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(productCreateSchema)) input: ProductCreateInput,
  ): Promise<ProductSummary> {
    return this.catalog.createProduct(user.id, params.organizationId, input);
  }

  @Get(':productId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(productParamsSchema)) params: ProductParams,
  ): Promise<ProductSummary> {
    return this.catalog.getProduct(user.id, params.organizationId, params.productId);
  }

  @Patch(':productId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(productParamsSchema)) params: ProductParams,
    @Body(new ZodValidationPipe(productUpdateSchema)) input: ProductUpdateInput,
  ): Promise<ProductSummary> {
    return this.catalog.updateProduct(user.id, params.organizationId, params.productId, input);
  }
}
