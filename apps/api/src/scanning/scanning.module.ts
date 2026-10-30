import { Module } from '@nestjs/common';

import { LabelsService } from './labels.service';
import { ScanningController } from './scanning.controller';
import { ScanningService } from './scanning.service';
import { StockCountsService } from './stock-counts.service';

@Module({
  controllers: [ScanningController],
  providers: [ScanningService, StockCountsService, LabelsService],
})
export class ScanningModule {}
