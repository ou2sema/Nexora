import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';

import {
  type LowStockQuery,
  type LowStockResponse,
  type MovementExportQuery,
  type ReportOverview,
  type ReportOverviewQuery,
  type StockLevelExportQuery,
  type SupplierPerformanceQuery,
  type SupplierPerformanceResponse,
  lowStockQuerySchema,
  movementExportQuerySchema,
  reportOverviewQuerySchema,
  stockLevelExportQuerySchema,
  supplierPerformanceQuerySchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReportsService } from './reports.service';
import { organizationParamsSchema, type OrganizationParams } from './reports.schemas';

@Controller('organizations/:organizationId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(reportOverviewQuerySchema)) query: ReportOverviewQuery,
  ): Promise<ReportOverview> {
    return this.reports.overview(user.id, params.organizationId, query);
  }

  @Get('low-stock')
  lowStock(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(lowStockQuerySchema)) query: LowStockQuery,
  ): Promise<LowStockResponse> {
    return this.reports.lowStock(user.id, params.organizationId, query);
  }

  @Get('supplier-performance')
  supplierPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(supplierPerformanceQuerySchema)) query: SupplierPerformanceQuery,
  ): Promise<SupplierPerformanceResponse> {
    return this.reports.supplierPerformance(user.id, params.organizationId, query);
  }

  @Get('exports/stock-levels.csv')
  async exportStockLevels(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(stockLevelExportQuerySchema)) query: StockLevelExportQuery,
  ): Promise<StreamableFile> {
    const file = await this.reports.exportStockLevels(user.id, params.organizationId, query);
    return new StreamableFile(file.body, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${file.filename}"`,
      length: file.body.byteLength,
    });
  }

  @Get('exports/movements.csv')
  async exportMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(movementExportQuerySchema)) query: MovementExportQuery,
  ): Promise<StreamableFile> {
    const file = await this.reports.exportMovements(user.id, params.organizationId, query);
    return new StreamableFile(file.body, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${file.filename}"`,
      length: file.body.byteLength,
    });
  }
}
