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
  type PurchaseOrderCreateInput,
  type PurchaseOrderCreateResult,
  type PurchaseOrderDetail,
  type PurchaseOrderListQuery,
  type PurchaseOrderListResponse,
  type PurchaseOrderStatusResult,
  type PurchaseReceiptInput,
  type PurchaseReceiptResult,
  orderCancelSchema,
  purchaseOrderCreateSchema,
  purchaseOrderListQuerySchema,
  purchaseReceiptSchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  organizationParamsSchema,
  type OrganizationParams,
  type PurchaseOrderParams,
  purchaseOrderParamsSchema,
} from './operations.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('organizations/:organizationId/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(purchaseOrderListQuerySchema)) query: PurchaseOrderListQuery,
  ): Promise<PurchaseOrderListResponse> {
    return this.purchaseOrders.list(user.id, params.organizationId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(purchaseOrderCreateSchema)) input: PurchaseOrderCreateInput,
  ): Promise<PurchaseOrderCreateResult> {
    return this.purchaseOrders.create(user.id, params.organizationId, idempotencyKey, input);
  }

  @Get(':purchaseOrderId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseOrderParamsSchema)) params: PurchaseOrderParams,
  ): Promise<PurchaseOrderDetail> {
    return this.purchaseOrders.get(user.id, params.organizationId, params.purchaseOrderId);
  }

  @Post(':purchaseOrderId/order')
  @HttpCode(HttpStatus.OK)
  markOrdered(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseOrderParamsSchema)) params: PurchaseOrderParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<PurchaseOrderStatusResult> {
    return this.purchaseOrders.markOrdered(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
      idempotencyKey,
    );
  }

  @Post(':purchaseOrderId/receipts')
  @HttpCode(HttpStatus.OK)
  receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseOrderParamsSchema)) params: PurchaseOrderParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(purchaseReceiptSchema)) input: PurchaseReceiptInput,
  ): Promise<PurchaseReceiptResult> {
    return this.purchaseOrders.receive(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
      idempotencyKey,
      input,
    );
  }

  @Post(':purchaseOrderId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseOrderParamsSchema)) params: PurchaseOrderParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(orderCancelSchema)) input: OrderCancelInput,
  ): Promise<PurchaseOrderStatusResult> {
    return this.purchaseOrders.cancel(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
      idempotencyKey,
      input,
    );
  }
}
