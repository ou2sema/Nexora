import { Module } from '@nestjs/common';

import { BrandsController } from './brands.controller';
import { CatalogService } from './catalog.service';
import { CategoriesController } from './categories.controller';
import { ProductsController } from './products.controller';
import { WarehousesController } from './warehouses.controller';

@Module({
  controllers: [ProductsController, CategoriesController, BrandsController, WarehousesController],
  providers: [CatalogService],
})
export class CatalogModule {}
