import { Global, Module } from '@nestjs/common';

import { EnvModule } from '../config/env.module';
import { AuthGuard } from './auth.guard';
import { SupabaseJwtService } from './supabase-jwt.service';

@Global()
@Module({
  imports: [EnvModule],
  providers: [SupabaseJwtService, AuthGuard],
  exports: [SupabaseJwtService, AuthGuard],
})
export class AuthModule {}
