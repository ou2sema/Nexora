import { Module } from '@nestjs/common';

import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [SuppliersController, PurchaseOrdersController, SalesOrdersController],
  providers: [SuppliersService, PurchaseOrdersService, SalesOrdersService],
})
export class OperationsModule {}
