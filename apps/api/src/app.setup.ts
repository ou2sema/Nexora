import type { ServerEnv } from '@mystock/config';
import { type INestApplication, RequestMethod } from '@nestjs/common';
import helmet from 'helmet';

export function configureApp(app: INestApplication, env: ServerEnv): void {
  app.use(helmet());
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: false,
    maxAge: 600,
  });
}
