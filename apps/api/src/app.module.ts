import { randomUUID } from 'node:crypto';

import type { ServerEnv } from '@mystock/config';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AccountModule } from './account/account.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvModule } from './config/env.module';
import { SERVER_ENV } from './config/env.tokens';
import { CatalogModule } from './catalog/catalog.module';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { StockModule } from './stock/stock.module';
import { TenancyModule } from './tenancy/tenancy.module';

@Module({
  imports: [
    EnvModule,
    LoggerModule.forRootAsync({
      imports: [EnvModule],
      inject: [SERVER_ENV],
      useFactory: (env: ServerEnv) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
            censor: '[redacted]',
          },
          genReqId: (req, res) => {
            const provided = req.headers['x-request-id'];
            const requestId =
              typeof provided === 'string' && provided.length > 0 && provided.length <= 128
                ? provided
                : randomUUID();
            res.setHeader('x-request-id', requestId);
            return requestId;
          },
          transport:
            env.NODE_ENV === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [EnvModule],
      inject: [SERVER_ENV],
      useFactory: (env: ServerEnv) => [
        { ttl: env.RATE_LIMIT_TTL_SECONDS * 1000, limit: env.RATE_LIMIT_LIMIT },
      ],
    }),
    DatabaseModule,
    TenancyModule,
    AuthModule,
    AccountModule,
    CatalogModule,
    StockModule,
    DevicesModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
