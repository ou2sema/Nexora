import type { ServerEnv } from '@mystock/config';
import { type INestApplication, RequestMethod } from '@nestjs/common';
import helmet from 'helmet';

export function configureApp(app: INestApplication, env: ServerEnv): void {
  app.use(helmet());
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: false,
    maxAge: 600,
    // Downloads name themselves from this header, which browsers hide cross-origin by default.
    exposedHeaders: ['content-disposition'],
  });
}
