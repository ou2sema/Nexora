import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../auth/public.decorator';
import { AppError } from '../common/errors/app-error';
import { RENDERER_PROBE_TIMEOUT_MS } from '../documents/print/document-printer.service';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DATABASE_PROBE_TIMEOUT_MS, ReadinessService } from './readiness.service';

const SERVICE = 'mystock-api';

export interface HealthResponse {
  status: 'ok';
  service: 'mystock-api';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessResponse extends HealthResponse {
  database: { status: 'up'; latencyMs: number; timeoutMs: number };
  renderer: { status: 'up'; latencyMs: number; timeoutMs: number };
}

/**
 * Liveness answers from the process alone, readiness proves the database pool
 * answers and that a document can be printed. A machine with no browser is a boot-time
 * failure, not a 500 in front of a customer at the counter (ADR-0019 decision 5).
 * Probes are polled by infrastructure, so they are exempt from the throttle budget
 * that belongs to users.
 */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  check(): HealthResponse {
    return snapshot();
  }

  @Get('live')
  live(): HealthResponse {
    return snapshot();
  }

  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    const [database, renderer] = await Promise.all([
      this.readiness.checkDatabase(),
      this.readiness.checkRenderer(),
    ]);

    if (database.status === 'down') {
      throw new AppError('service_unavailable', 'The database is not answering.', 503, {
        database: database.reason,
        timeoutMs: DATABASE_PROBE_TIMEOUT_MS,
      });
    }

    if (renderer.status === 'down') {
      throw new AppError('service_unavailable', 'The document renderer is not answering.', 503, {
        renderer: renderer.error,
        timeoutMs: RENDERER_PROBE_TIMEOUT_MS,
      });
    }

    return {
      ...snapshot(),
      database: {
        status: 'up',
        latencyMs: database.latencyMs,
        timeoutMs: DATABASE_PROBE_TIMEOUT_MS,
      },
      renderer: {
        status: 'up',
        latencyMs: renderer.latencyMs,
        timeoutMs: RENDERER_PROBE_TIMEOUT_MS,
      },
    };
  }
}

function snapshot(): HealthResponse {
  return {
    status: 'ok',
    service: SERVICE,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
