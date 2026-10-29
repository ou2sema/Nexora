import { Global, Module } from '@nestjs/common';

import { loadServerEnv, SERVER_ENV } from './env.tokens';

@Global()
@Module({
  providers: [{ provide: SERVER_ENV, useFactory: loadServerEnv }],
  exports: [SERVER_ENV],
})
export class EnvModule {}
