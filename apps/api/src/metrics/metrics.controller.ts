import { timingSafeEqual } from 'node:crypto';

import type { ServerEnv } from '@mystock/config';
import { Controller, Get, Inject, NotFoundException, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { Public } from '../auth/public.decorator';
import { SERVER_ENV } from '../config/env.tokens';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MetricsService } from './metrics.service';

/**
 * Without a token the endpoint answers in development and test, and pretends
 * not to exist in production. That keeps a forgotten secret fail-closed
 * instead of publishing traffic and memory data to the internet.
 */
export function metricsAuthorized(request: Request, env: ServerEnv): boolean {
  const expected = env.METRICS_TOKEN;

  if (!expected) {
    return env.NODE_ENV !== 'production';
  }

  const authorization = request.headers.authorization;
  const bearer = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined;
  const header = bearer ?? request.headers['x-metrics-token'];
  const provided = Array.isArray(header) ? header[0] : header;

  if (!provided) {
    return false;
  }

  const given = Buffer.from(provided);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

@Public()
@SkipThrottle()
@Controller()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
  ) {}

  @Get('metrics')
  async scrape(@Req() request: Request, @Res() response: Response): Promise<void> {
    if (!metricsAuthorized(request, this.env)) {
      throw new NotFoundException();
    }

    response.setHeader('Content-Type', this.metrics.registry.contentType);
    response.setHeader('Cache-Control', 'no-store');
    response.send(await this.metrics.registry.metrics());
  }
}
