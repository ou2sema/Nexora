import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { ServerEnv } from '@mystock/config';

import { EnvModule } from '../config/env.module';
import { SERVER_ENV } from '../config/env.tokens';
import { DATABASE } from './database.tokens';
import type { DatabaseHandle } from './database.types';
import * as schema from './schema';
import { TenantDatabase } from './tenant-database.service';

@Global()
@Module({
  imports: [EnvModule],
  providers: [
    {
      provide: DATABASE,
      inject: [SERVER_ENV],
      useFactory: (env: ServerEnv): DatabaseHandle => {
        const client = postgres(env.DATABASE_URL, {
          ssl: env.DATABASE_SSL ? 'require' : false,
          max: 10,
          idle_timeout: 20,
          connect_timeout: 15,
          onnotice: () => undefined,
        });

        return {
          db: drizzle(client, { schema }),
          close: () => client.end({ timeout: 5 }),
        };
      },
    },
    TenantDatabase,
  ],
  exports: [DATABASE, TenantDatabase],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly handle: DatabaseHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.close();
  }
}
