import 'reflect-metadata';

import type { ServerEnv } from '@mystock/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { SERVER_ENV } from './config/env.tokens';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const env = app.get<ServerEnv>(SERVER_ENV);
  configureApp(app, env);
  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
}

bootstrap().catch((error: unknown) => {
  console.error('API failed to start', error);
  process.exitCode = 1;
});
