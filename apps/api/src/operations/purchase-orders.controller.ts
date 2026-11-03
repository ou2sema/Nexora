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
  type OrderCancelInput,
  type PurchaseOrderCreateInput,
  type PurchaseOrderCreateResult,
  type PurchaseOrderDetail,
  type PurchaseOrderListQuery,
  type PurchaseOrderListResponse,
  type PurchaseOrderStatusResult,
  type PurchaseReceiptInput,
  type PurchaseReceiptResult,
  type PurchaseReturnCreateInput,
  type ReturnCreateResult,
  type PurchaseReturnDetail,
  type PurchaseReturnListResponse,
  type ReturnCancelResult,
  type ReturnListQuery,
  type ReturnPostResult,
  orderCancelSchema,
  purchaseOrderCreateSchema,
  purchaseOrderListQuerySchema,
  purchaseReceiptSchema,
  purchaseReturnCreateSchema,
  returnListQuerySchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { RenderedDocument } from '../documents/rendered-document';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PurchaseDocumentsService } from '../documents/purchase-documents.service';
import {
  organizationParamsSchema,
  type OrganizationParams,
  type PurchaseOrderParams,
  type PurchaseReturnParams,
  purchaseOrderParamsSchema,
  purchaseReturnParamsSchema,
} from './operations.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('organizations/:organizationId/purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly documents: PurchaseDocumentsService,
  ) {}

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

  @Get(':purchaseOrderId/pdf')
  async purchaseOrderPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseOrderParamsSchema)) params: PurchaseOrderParams,
  ): Promise<StreamableFile> {
    const file = await this.documents.purchaseOrderPdf(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
    );
    return this.stream(file);
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

  @Get(':purchaseOrderId/returns')
  listReturns(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseOrderParamsSchema)) params: PurchaseOrderParams,
    @Query(new ZodValidationPipe(returnListQuerySchema)) query: ReturnListQuery,
  ): Promise<PurchaseReturnListResponse> {
    return this.purchaseOrders.listReturns(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
      query,
    );
  }

  @Post(':purchaseOrderId/returns')
  createReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseOrderParamsSchema)) params: PurchaseOrderParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(purchaseReturnCreateSchema)) input: PurchaseReturnCreateInput,
  ): Promise<ReturnCreateResult> {
    return this.purchaseOrders.createReturn(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
      idempotencyKey,
      input,
    );
  }

  @Get(':purchaseOrderId/returns/:returnId')
  getReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseReturnParamsSchema)) params: PurchaseReturnParams,
  ): Promise<PurchaseReturnDetail> {
    return this.purchaseOrders.getReturn(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
      params.returnId,
    );
  }

  @Get(':purchaseOrderId/returns/:returnId/pdf')
  async purchaseReturnPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseReturnParamsSchema)) params: PurchaseReturnParams,
  ): Promise<StreamableFile> {
    const file = await this.documents.purchaseReturnPdf(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
      params.returnId,
    );
    return this.stream(file);
  }

  @Post(':purchaseOrderId/returns/:returnId/post')
  @HttpCode(HttpStatus.OK)
  postReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseReturnParamsSchema)) params: PurchaseReturnParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<ReturnPostResult> {
    return this.purchaseOrders.postReturn(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
      params.returnId,
      idempotencyKey,
    );
  }

  @Post(':purchaseOrderId/returns/:returnId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(purchaseReturnParamsSchema)) params: PurchaseReturnParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(orderCancelSchema)) input: OrderCancelInput,
  ): Promise<ReturnCancelResult> {
    return this.purchaseOrders.cancelReturn(
      user.id,
      params.organizationId,
      params.purchaseOrderId,
      params.returnId,
      idempotencyKey,
      input,
    );
  }

  private stream(file: RenderedDocument): StreamableFile {
    return new StreamableFile(file.pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.fileName}"`,
      length: file.pdf.byteLength,
    });
  }
}
