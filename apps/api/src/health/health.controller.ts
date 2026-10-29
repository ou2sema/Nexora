import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/public.decorator';

export interface HealthResponse {
  status: 'ok';
  service: 'mystock-api';
  uptimeSeconds: number;
  timestamp: string;
}

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'mystock-api',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
