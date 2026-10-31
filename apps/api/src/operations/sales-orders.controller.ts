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
  type OrderCancelInput,
  type ReturnCancelResult,
  type ReturnListQuery,
  type ReturnPostResult,
  type SalesOrderCancelResult,
  type SalesOrderConfirmResult,
  type SalesOrderCreateInput,
  type SalesOrderCreateResult,
  type SalesOrderDetail,
  type SalesOrderFulfilResult,
  type SalesOrderListQuery,
  type SalesOrderListResponse,
  type SalesReturnCreateInput,
  type ReturnCreateResult,
  type SalesReturnDetail,
  type SalesReturnListResponse,
  orderCancelSchema,
  returnListQuerySchema,
  salesOrderCreateSchema,
  salesOrderListQuerySchema,
  salesReturnCreateSchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  organizationParamsSchema,
  type OrganizationParams,
  type SalesOrderParams,
  type SalesReturnParams,
  salesOrderParamsSchema,
  salesReturnParamsSchema,
} from './operations.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SalesOrdersService } from './sales-orders.service';

@Controller('organizations/:organizationId/sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrders: SalesOrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(salesOrderListQuerySchema)) query: SalesOrderListQuery,
  ): Promise<SalesOrderListResponse> {
    return this.salesOrders.list(user.id, params.organizationId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(salesOrderCreateSchema)) input: SalesOrderCreateInput,
  ): Promise<SalesOrderCreateResult> {
    return this.salesOrders.create(user.id, params.organizationId, idempotencyKey, input);
  }

  @Get(':salesOrderId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesOrderParamsSchema)) params: SalesOrderParams,
  ): Promise<SalesOrderDetail> {
    return this.salesOrders.get(user.id, params.organizationId, params.salesOrderId);
  }

  @Post(':salesOrderId/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesOrderParamsSchema)) params: SalesOrderParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<SalesOrderConfirmResult> {
    return this.salesOrders.confirm(
      user.id,
      params.organizationId,
      params.salesOrderId,
      idempotencyKey,
    );
  }

  @Post(':salesOrderId/fulfil')
  @HttpCode(HttpStatus.OK)
  fulfil(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesOrderParamsSchema)) params: SalesOrderParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<SalesOrderFulfilResult> {
    return this.salesOrders.fulfil(
      user.id,
      params.organizationId,
      params.salesOrderId,
      idempotencyKey,
    );
  }

  @Post(':salesOrderId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesOrderParamsSchema)) params: SalesOrderParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(orderCancelSchema)) input: OrderCancelInput,
  ): Promise<SalesOrderCancelResult> {
    return this.salesOrders.cancel(
      user.id,
      params.organizationId,
      params.salesOrderId,
      idempotencyKey,
      input,
    );
  }

  @Get(':salesOrderId/returns')
  listReturns(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesOrderParamsSchema)) params: SalesOrderParams,
    @Query(new ZodValidationPipe(returnListQuerySchema)) query: ReturnListQuery,
  ): Promise<SalesReturnListResponse> {
    return this.salesOrders.listReturns(user.id, params.organizationId, params.salesOrderId, query);
  }

  @Post(':salesOrderId/returns')
  createReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesOrderParamsSchema)) params: SalesOrderParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(salesReturnCreateSchema)) input: SalesReturnCreateInput,
  ): Promise<ReturnCreateResult> {
    return this.salesOrders.createReturn(
      user.id,
      params.organizationId,
      params.salesOrderId,
      idempotencyKey,
      input,
    );
  }

  @Get(':salesOrderId/returns/:returnId')
  getReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesReturnParamsSchema)) params: SalesReturnParams,
  ): Promise<SalesReturnDetail> {
    return this.salesOrders.getReturn(
      user.id,
      params.organizationId,
      params.salesOrderId,
      params.returnId,
    );
  }

  @Post(':salesOrderId/returns/:returnId/post')
  @HttpCode(HttpStatus.OK)
  postReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesReturnParamsSchema)) params: SalesReturnParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<ReturnPostResult> {
    return this.salesOrders.postReturn(
      user.id,
      params.organizationId,
      params.salesOrderId,
      params.returnId,
      idempotencyKey,
    );
  }

  @Post(':salesOrderId/returns/:returnId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesReturnParamsSchema)) params: SalesReturnParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(orderCancelSchema)) input: OrderCancelInput,
  ): Promise<ReturnCancelResult> {
    return this.salesOrders.cancelReturn(
      user.id,
      params.organizationId,
      params.salesOrderId,
      params.returnId,
      idempotencyKey,
      input,
    );
  }
}
