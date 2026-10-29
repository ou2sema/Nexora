import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../errors/app-error';
import type { RequestWithId } from '../http/request-id';

export interface ErrorDescriptor {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

const HTTP_ERROR_CODES: Record<number, string> = {
  400: 'validation_error',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'unprocessable_entity',
  429: 'rate_limited',
};

export function toErrorDescriptor(exception: unknown): ErrorDescriptor {
  if (exception instanceof AppError) {
    return {
      status: exception.status,
      code: exception.code,
      message: exception.message,
      details: exception.details,
    };
  }

  if (exception instanceof ZodError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'validation_error',
      message: 'Request validation failed',
      details: exception.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const message =
      typeof body === 'string'
        ? body
        : typeof (body as { message?: unknown }).message === 'string'
          ? (body as { message: string }).message
          : exception.message;

    return {
      status,
      code: HTTP_ERROR_CODES[status] ?? `http_${status}`,
      message,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'internal_error',
    message: 'Internal server error',
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithId>();
    const requestId = request.id ?? 'unknown';

    const { status, code, message, details } = toErrorDescriptor(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${code} on ${request.method} ${request.originalUrl} (request ${requestId})`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${code} on ${request.method} ${request.originalUrl} (request ${requestId})`,
      );
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
        requestId,
      },
    });
  }
}
