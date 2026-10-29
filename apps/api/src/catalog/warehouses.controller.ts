import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import {
  type StorageLocationCreateInput,
  type StorageLocationSummary,
  type WarehouseCreateInput,
  type WarehouseSummary,
  storageLocationCreateSchema,
  warehouseCreateSchema,
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
  type WarehouseParams,
  warehouseParamsSchema,
} from './catalog.schemas';

@Controller('organizations/:organizationId/warehouses')
export class WarehousesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
  ): Promise<WarehouseSummary[]> {
    return this.catalog.listWarehouses(user.id, params.organizationId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(warehouseCreateSchema)) input: WarehouseCreateInput,
  ): Promise<WarehouseSummary> {
    return this.catalog.createWarehouse(user.id, params.organizationId, input);
  }

  @Post(':warehouseId/locations')
  createLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(warehouseParamsSchema)) params: WarehouseParams,
    @Body(new ZodValidationPipe(storageLocationCreateSchema)) input: StorageLocationCreateInput,
  ): Promise<StorageLocationSummary> {
    return this.catalog.createStorageLocation(
      user.id,
      params.organizationId,
      params.warehouseId,
      input,
    );
  }
}
