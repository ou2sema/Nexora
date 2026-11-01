import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../auth/public.decorator';
import { AppError } from '../common/errors/app-error';
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
}

/**
 * Liveness answers from the process alone, readiness proves the database pool
 * answers. Probes are polled by infrastructure, so they are exempt from the
 * throttle budget that belongs to users.
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
    const database = await this.readiness.checkDatabase();

    if (database.status === 'down') {
      throw new AppError('service_unavailable', 'The database is not answering.', 503, {
        database: database.reason,
        timeoutMs: DATABASE_PROBE_TIMEOUT_MS,
      });
    }

    return {
      ...snapshot(),
      database: {
        status: 'up',
        latencyMs: database.latencyMs,
        timeoutMs: DATABASE_PROBE_TIMEOUT_MS,
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
