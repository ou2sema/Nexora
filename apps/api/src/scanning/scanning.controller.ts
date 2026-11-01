import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';

import {
  type LabelRequest,
  type ScanQuery,
  type ScanResult,
  type StockCount,
  type StockCountDiscardResult,
  type StockCountListQuery,
  type StockCountListResponse,
  type StockCountPostResult,
  type StockCountRecordInput,
  type StockCountRecordResult,
  type StockCountStartInput,
  type StockCountStartResult,
  labelRequestSchema,
  scanQuerySchema,
  stockCountListQuerySchema,
  stockCountRecordSchema,
  stockCountStartSchema,
  type BarcodeAssignmentResult,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LabelsService } from './labels.service';
import {
  organizationParamsSchema,
  type OrganizationParams,
  type ProductParams,
  productParamsSchema,
  type StockCountParams,
  stockCountParamsSchema,
} from './scanning.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ScanningService } from './scanning.service';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { StockCountsService } from './stock-counts.service';

@Controller('organizations/:organizationId')
export class ScanningController {
  constructor(
    private readonly scanning: ScanningService,
    private readonly counts: StockCountsService,
    private readonly labels: LabelsService,
  ) {}

  @Get('scan')
  scan(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(scanQuerySchema)) query: ScanQuery,
  ): Promise<ScanResult> {
    return this.scanning.scan(user.id, params.organizationId, query);
  }

  @Post('products/:productId/barcode')
  @HttpCode(HttpStatus.OK)
  assignBarcode(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(productParamsSchema)) params: ProductParams,
  ): Promise<BarcodeAssignmentResult> {
    return this.scanning.assignBarcode(user.id, params.organizationId, params.productId);
  }

  @Post('labels')
  @HttpCode(HttpStatus.OK)
  async labelsPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(labelRequestSchema)) input: LabelRequest,
  ): Promise<StreamableFile> {
    const pdf = await this.labels.render(user.id, params.organizationId, input);
    const date = new Date().toISOString().slice(0, 10);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="nexora-labels-${date}.pdf"`,
      length: pdf.byteLength,
    });
  }

  @Get('stock-counts')
  listCounts(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(stockCountListQuerySchema)) query: StockCountListQuery,
  ): Promise<StockCountListResponse> {
    return this.counts.list(user.id, params.organizationId, query);
  }

  @Post('stock-counts')
  startCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(stockCountStartSchema)) input: StockCountStartInput,
  ): Promise<StockCountStartResult> {
    return this.counts.start(user.id, params.organizationId, input);
  }

  @Get('stock-counts/:countId')
  getCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(stockCountParamsSchema)) params: StockCountParams,
  ): Promise<StockCount> {
    return this.counts.get(user.id, params.organizationId, params.countId);
  }

  @Post('stock-counts/:countId/lines')
  @HttpCode(HttpStatus.OK)
  recordCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(stockCountParamsSchema)) params: StockCountParams,
    @Body(new ZodValidationPipe(stockCountRecordSchema)) input: StockCountRecordInput,
  ): Promise<StockCountRecordResult> {
    return this.counts.record(user.id, params.organizationId, params.countId, input);
  }

  @Post('stock-counts/:countId/post')
  @HttpCode(HttpStatus.OK)
  postCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(stockCountParamsSchema)) params: StockCountParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<StockCountPostResult> {
    return this.counts.post(user.id, params.organizationId, params.countId, idempotencyKey);
  }

  @Post('stock-counts/:countId/discard')
  @HttpCode(HttpStatus.OK)
  discardCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(stockCountParamsSchema)) params: StockCountParams,
  ): Promise<StockCountDiscardResult> {
    return this.counts.discard(user.id, params.organizationId, params.countId);
  }
}
