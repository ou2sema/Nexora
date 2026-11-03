import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { type LogoSummary, MAX_LOGO_BYTES } from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { AppError } from '../common/errors/app-error';
import { readLimitedBody } from '../common/http/read-limited-body';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LOGO_MEDIA_TYPES, type LogoParams, logoParamsSchema, mediaTypeOf } from './logo.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { OrganizationLogosService } from './organization-logos.service';

@Controller('organizations/:organizationId/logo')
export class OrganizationLogosController {
  constructor(private readonly logos: OrganizationLogosService) {}

  // The image is the request body, not a JSON field: no base64 inflation, no new
  // multipart dependency, and the byte cap is counted here instead of inherited
  // from the global JSON body limit.
  @Put()
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(logoParamsSchema)) params: LogoParams,
    @Headers('content-type') contentType: string | undefined,
    @Req() request: Request,
  ): Promise<LogoSummary> {
    const declared = mediaTypeOf(contentType);
    if (!declared || !LOGO_MEDIA_TYPES.includes(declared)) {
      throw new AppError('unsupported_logo_type', 'Upload a PNG or JPEG image.', 415);
    }

    const bytes = await readLimitedBody(request, MAX_LOGO_BYTES);
    if (bytes.byteLength === 0) {
      throw new AppError('invalid_logo_image', 'The upload is empty.', 400);
    }

    return this.logos.store(user.id, params.organizationId, declared, bytes);
  }

  @Get()
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(logoParamsSchema)) params: LogoParams,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const logo = await this.logos.readForMember(user.id, params.organizationId);

    // The interface asks for this URL with the upload timestamp as `version`, so a
    // replaced mark is a different URL and nothing here has to be revalidated.
    response.setHeader('cache-control', 'private, max-age=86400, immutable');

    return new StreamableFile(Buffer.from(logo.bytes), {
      type: logo.mime,
      length: logo.bytes.byteLength,
    });
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(logoParamsSchema)) params: LogoParams,
  ): Promise<{ removed: boolean }> {
    return this.logos.remove(user.id, params.organizationId);
  }
}
