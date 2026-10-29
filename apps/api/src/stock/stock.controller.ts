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
} from '@nestjs/common';

import {
  type StockLevelListQuery,
  type StockLevelListResponse,
  type StockMovementListQuery,
  type StockMovementListResponse,
  type StockPostingInput,
  type StockPostingResult,
  type StockReconciliationRow,
  type StockRepairInput,
  type StockRepairRow,
  type StockReservationCreateInput,
  type StockReservationListQuery,
  type StockReservationListResponse,
  type StockReservationReleaseResult,
  type StockReservationResult,
  type StockSummary,
  type StockTransferInput,
  type StockTransferResult,
  stockLevelListQuerySchema,
  stockMovementListQuerySchema,
  stockPostingSchema,
  stockRepairInputSchema,
  stockReservationCreateSchema,
  stockReservationListQuerySchema,
  stockTransferSchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { StockService } from './stock.service';
import {
  organizationParamsSchema,
  type OrganizationParams,
  type ReservationParams,
  reservationParamsSchema,
} from './stock.schemas';

@Controller('organizations/:organizationId')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('stock-levels')
  listLevels(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(stockLevelListQuerySchema)) query: StockLevelListQuery,
  ): Promise<StockLevelListResponse> {
    return this.stock.listLevels(user.id, params.organizationId, query);
  }

  @Get('stock-levels/summary')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
  ): Promise<StockSummary> {
    return this.stock.summary(user.id, params.organizationId);
  }

  @Get('stock-movements')
  listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(stockMovementListQuerySchema)) query: StockMovementListQuery,
  ): Promise<StockMovementListResponse> {
    return this.stock.listMovements(user.id, params.organizationId, query);
  }

  @Post('stock-movements')
  @HttpCode(HttpStatus.OK)
  postMovement(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(stockPostingSchema)) input: StockPostingInput,
  ): Promise<StockPostingResult> {
    return this.stock.postMovement(user.id, params.organizationId, idempotencyKey, input);
  }

  @Post('stock-transfers')
  @HttpCode(HttpStatus.OK)
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(stockTransferSchema)) input: StockTransferInput,
  ): Promise<StockTransferResult> {
    return this.stock.transfer(user.id, params.organizationId, idempotencyKey, input);
  }

  @Get('stock-reservations')
  listReservations(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(stockReservationListQuerySchema)) query: StockReservationListQuery,
  ): Promise<StockReservationListResponse> {
    return this.stock.listReservations(user.id, params.organizationId, query);
  }

  @Post('stock-reservations')
  @HttpCode(HttpStatus.OK)
  reserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(stockReservationCreateSchema)) input: StockReservationCreateInput,
  ): Promise<StockReservationResult> {
    return this.stock.reserve(user.id, params.organizationId, idempotencyKey, input);
  }

  @Post('stock-reservations/:reservationId/release')
  @HttpCode(HttpStatus.OK)
  releaseReservation(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(reservationParamsSchema)) params: ReservationParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<StockReservationReleaseResult> {
    return this.stock.releaseReservation(
      user.id,
      params.organizationId,
      params.reservationId,
      idempotencyKey,
    );
  }

  @Get('stock-reconciliation')
  reconciliation(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
  ): Promise<StockReconciliationRow[]> {
    return this.stock.reconciliation(user.id, params.organizationId);
  }

  @Post('stock-reconciliation/repair')
  @HttpCode(HttpStatus.OK)
  repair(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(stockRepairInputSchema)) input: StockRepairInput,
  ): Promise<StockRepairRow[]> {
    return this.stock.repair(user.id, params.organizationId, input);
  }
}
