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
  type CustomerActivationInput,
  type CustomerCreateInput,
  type CustomerListQuery,
  type CustomerListResponse,
  type CustomerSummary,
  type CustomerUpdateInput,
  customerActivationSchema,
  customerCreateSchema,
  customerListQuerySchema,
  customerUpdateSchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  type CustomerParams,
  customerParamsSchema,
  organizationParamsSchema,
  type OrganizationParams,
} from './operations.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CustomersService } from './customers.service';

@Controller('organizations/:organizationId/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(customerListQuerySchema)) query: CustomerListQuery,
  ): Promise<CustomerListResponse> {
    return this.customers.list(user.id, params.organizationId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(customerCreateSchema)) input: CustomerCreateInput,
  ): Promise<CustomerSummary> {
    return this.customers.create(user.id, params.organizationId, input);
  }

  @Patch(':customerId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(customerParamsSchema)) params: CustomerParams,
    @Body(new ZodValidationPipe(customerUpdateSchema)) input: CustomerUpdateInput,
  ): Promise<CustomerSummary> {
    return this.customers.update(user.id, params.organizationId, params.customerId, input);
  }

  @Post(':customerId/activation')
  @HttpCode(HttpStatus.OK)
  setActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(customerParamsSchema)) params: CustomerParams,
    @Body(new ZodValidationPipe(customerActivationSchema)) input: CustomerActivationInput,
  ): Promise<CustomerSummary> {
    return this.customers.setActive(
      user.id,
      params.organizationId,
      params.customerId,
      input.isActive,
    );
  }
}
