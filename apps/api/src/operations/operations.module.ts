import { Module } from '@nestjs/common';

import { PurchaseDocumentsService } from '../documents/purchase-documents.service';
import { SalesDocumentsService } from '../documents/sales-documents.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SalesInvoicesController } from './sales-invoices.controller';
import { SalesInvoicesService } from './sales-invoices.service';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [
    SuppliersController,
    CustomersController,
    PurchaseOrdersController,
    SalesOrdersController,
    SalesInvoicesController,
  ],
  providers: [
    SuppliersService,
    CustomersService,
    PurchaseOrdersService,
    SalesOrdersService,
    SalesInvoicesService,
    PurchaseDocumentsService,
    SalesDocumentsService,
  ],
})
export class OperationsModule {}
