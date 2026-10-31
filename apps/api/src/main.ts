import 'reflect-metadata';

import type { ServerEnv } from '@mystock/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { SERVER_ENV } from './config/env.tokens';
import { DATABASE } from './database/database.tokens';
import type { DatabaseHandle } from './database/database.types';
import { assertSchemaCompatible } from './database/schema-guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const env = app.get<ServerEnv>(SERVER_ENV);
  configureApp(app, env);

  try {
    await assertSchemaCompatible(app.get<DatabaseHandle>(DATABASE), app.get(Logger));
  } catch (error) {
    await app.close();
    throw error;
  }

  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
}

bootstrap().catch((error: unknown) => {
  console.error('API failed to start', error);
  process.exitCode = 1;
});
