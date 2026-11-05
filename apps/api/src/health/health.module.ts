import { Module } from '@nestjs/common';

import { DocumentPrintModule } from '../documents/print/print.module';
import { HealthController } from './health.controller';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [DocumentPrintModule],
  controllers: [HealthController],
  providers: [ReadinessService],
})
export class HealthModule {}
