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
  type SalesInvoiceCreateInput,
  type SalesInvoiceCreateResult,
  type SalesInvoiceDetail,
  type SalesInvoiceListQuery,
  type SalesInvoiceListResponse,
  type SalesInvoicePaymentCreateInput,
  type SalesInvoicePaymentResult,
  salesInvoiceCreateSchema,
  salesInvoiceListQuerySchema,
  salesInvoicePaymentCreateSchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { RenderedDocument } from '../documents/rendered-document';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SalesDocumentsService } from '../documents/sales-documents.service';
import {
  organizationParamsSchema,
  type OrganizationParams,
  type SalesInvoiceParams,
  salesInvoiceParamsSchema,
} from './operations.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SalesInvoicesService } from './sales-invoices.service';

@Controller('organizations/:organizationId/sales-invoices')
export class SalesInvoicesController {
  constructor(
    private readonly salesInvoices: SalesInvoicesService,
    private readonly documents: SalesDocumentsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(salesInvoiceListQuerySchema)) query: SalesInvoiceListQuery,
  ): Promise<SalesInvoiceListResponse> {
    return this.salesInvoices.list(user.id, params.organizationId, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(salesInvoiceCreateSchema)) input: SalesInvoiceCreateInput,
  ): Promise<SalesInvoiceCreateResult> {
    return this.salesInvoices.create(user.id, params.organizationId, idempotencyKey, input);
  }

  @Get(':invoiceId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesInvoiceParamsSchema)) params: SalesInvoiceParams,
  ): Promise<SalesInvoiceDetail> {
    return this.salesInvoices.get(user.id, params.organizationId, params.invoiceId);
  }

  @Post(':invoiceId/payments')
  @HttpCode(HttpStatus.OK)
  addPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesInvoiceParamsSchema)) params: SalesInvoiceParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(salesInvoicePaymentCreateSchema))
    input: SalesInvoicePaymentCreateInput,
  ): Promise<SalesInvoicePaymentResult> {
    return this.salesInvoices.addPayment(
      user.id,
      params.organizationId,
      params.invoiceId,
      idempotencyKey,
      input,
    );
  }

  @Get(':invoiceId/pdf')
  async invoicePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesInvoiceParamsSchema)) params: SalesInvoiceParams,
  ): Promise<StreamableFile> {
    const file = await this.documents.invoicePdf(user.id, params.organizationId, params.invoiceId);
    return this.stream(file);
  }

  @Get(':invoiceId/issue-note/pdf')
  async issueNotePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(salesInvoiceParamsSchema)) params: SalesInvoiceParams,
  ): Promise<StreamableFile> {
    const file = await this.documents.issueNotePdf(
      user.id,
      params.organizationId,
      params.invoiceId,
    );
    return this.stream(file);
  }

  private stream(file: RenderedDocument): StreamableFile {
    return new StreamableFile(file.pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.fileName}"`,
      length: file.pdf.byteLength,
    });
  }
}
