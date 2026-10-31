import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  type SupplierActivationInput,
  type SupplierCreateInput,
  type SupplierListQuery,
  type SupplierListResponse,
  type SupplierSummary,
  type SupplierUpdateInput,
  supplierActivationSchema,
  supplierCreateSchema,
  supplierListQuerySchema,
  supplierUpdateSchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  organizationParamsSchema,
  type OrganizationParams,
  type SupplierParams,
  supplierParamsSchema,
} from './operations.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SuppliersService } from './suppliers.service';

@Controller('organizations/:organizationId/suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(supplierListQuerySchema)) query: SupplierListQuery,
  ): Promise<SupplierListResponse> {
    return this.suppliers.list(user.id, params.organizationId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(supplierCreateSchema)) input: SupplierCreateInput,
  ): Promise<SupplierSummary> {
    return this.suppliers.create(user.id, params.organizationId, input);
  }

  @Patch(':supplierId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(supplierParamsSchema)) params: SupplierParams,
    @Body(new ZodValidationPipe(supplierUpdateSchema)) input: SupplierUpdateInput,
  ): Promise<SupplierSummary> {
    return this.suppliers.update(user.id, params.organizationId, params.supplierId, input);
  }

  @Post(':supplierId/activation')
  @HttpCode(HttpStatus.OK)
  setActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(supplierParamsSchema)) params: SupplierParams,
    @Body(new ZodValidationPipe(supplierActivationSchema)) input: SupplierActivationInput,
  ): Promise<SupplierSummary> {
    return this.suppliers.setActive(
      user.id,
      params.organizationId,
      params.supplierId,
      input.isActive,
    );
  }
}
