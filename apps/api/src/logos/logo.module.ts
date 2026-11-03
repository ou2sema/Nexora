import { Module } from '@nestjs/common';

import { OrganizationLogosController } from './organization-logos.controller';
import { OrganizationLogosService } from './organization-logos.service';

@Module({
  controllers: [OrganizationLogosController],
  providers: [OrganizationLogosService],
})
export class LogosModule {}
