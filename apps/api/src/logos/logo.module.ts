import { Module } from '@nestjs/common';

import { DocumentPrintModule } from '../documents/print/print.module';
import { OrganizationLogosController } from './organization-logos.controller';
import { OrganizationLogosService } from './organization-logos.service';

@Module({
  imports: [DocumentPrintModule],
  controllers: [OrganizationLogosController],
  providers: [OrganizationLogosService],
})
export class LogosModule {}
