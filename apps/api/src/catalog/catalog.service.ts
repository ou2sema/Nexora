import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';

import type {
  BrandCreateInput,
  BrandSummary,
  CategoryCreateInput,
  CategorySummary,
  ProductCreateInput,
  ProductListQuery,
  ProductListResponse,
  ProductSummary,
  ProductUpdateInput,
  StorageLocationCreateInput,
  StorageLocationSummary,
  WarehouseCreateInput,
  WarehouseSummary,
} from '@mystock/contracts';
import { slugify } from '@mystock/domain';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { brands, categories, products, storageLocations, warehouses } from '../database/schema';
// The class is a DI token at runtime, so it cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';

export interface ProductRow {
  product: typeof products.$inferSelect;
  categoryName: string | null;
  brandName: string | null;
}

export function toProductSummary({ product, categoryName, brandName }: ProductRow): ProductSummary {
  return {
    id: product.id,
    organizationId: product.organizationId,
    sku: product.sku,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    categoryName,
    brandId: product.brandId,
    brandName,
    manufacturerModel: product.manufacturerModel,
    barcode: product.barcode,
    internalCode: product.internalCode,
    unitOfMeasure: product.unitOfMeasure,
    purchasePriceMinor: product.purchasePriceMinor,
    salePriceMinor: product.salePriceMinor,
    reorderThreshold: Number(product.reorderThreshold),
    isSerialized: product.isSerialized,
    isIndividuallyTracked: product.isIndividuallyTracked,
    status: product.status,
    attributes: product.attributes,
    imagePath: product.imagePath,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

@Injectable()
export class CatalogService {
  constructor(private readonly access: TenantAccessService) {}

  async listProducts(
    userId: string,
    organizationId: string,
    query: ProductListQuery,
  ): Promise<ProductListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [eq(products.organizationId, organizationId)];

      if (query.status) conditions.push(eq(products.status, query.status));
      if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));
      if (query.brandId) conditions.push(eq(products.brandId, query.brandId));
      if (query.search) {
        const pattern = `%${escapeLike(query.search)}%`;
        const search = or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern),
          ilike(products.barcode, pattern),
        );
        if (search) conditions.push(search);
      }

      const where = and(...conditions);
      const offset = (query.page - 1) * query.pageSize;

      const [totals] = await tx.select({ total: count() }).from(products).where(where);

      const rows = await tx
        .select({ product: products, categoryName: categories.name, brandName: brands.name })
        .from(products)
        .leftJoin(
          categories,
          and(
            eq(categories.id, products.categoryId),
            eq(categories.organizationId, products.organizationId),
          ),
        )
        .leftJoin(
          brands,
          and(eq(brands.id, products.brandId), eq(brands.organizationId, products.organizationId)),
        )
        .where(where)
        .orderBy(sql`lower(${products.name})`, asc(products.id))
        .limit(query.pageSize)
        .offset(offset);

      return {
        items: rows.map(toProductSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: totals?.total ?? 0,
      };
    });
  }

  async getProduct(
    userId: string,
    organizationId: string,
    productId: string,
  ): Promise<ProductSummary> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const row = await this.findProduct(tx, organizationId, productId);
      if (!row) throw new AppError('product_not_found', 'Product not found.', 404);
      return toProductSummary(row);
    });
  }

  async createProduct(
    userId: string,
    organizationId: string,
    input: ProductCreateInput,
  ): Promise<ProductSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const [created] = await tx
          .insert(products)
          .values({
            organizationId,
            sku: input.sku,
            name: input.name,
            description: input.description ?? null,
            categoryId: input.categoryId ?? null,
            brandId: input.brandId ?? null,
            manufacturerModel: input.manufacturerModel ?? null,
            barcode: input.barcode ?? null,
            internalCode: input.internalCode ?? null,
            unitOfMeasure: input.unitOfMeasure ?? 'unit',
            purchasePriceMinor: input.purchasePriceMinor ?? null,
            salePriceMinor: input.salePriceMinor ?? null,
            reorderThreshold: String(input.reorderThreshold ?? 0),
            isSerialized: input.isSerialized ?? false,
            isIndividuallyTracked: input.isIndividuallyTracked ?? false,
            status: input.status ?? 'active',
            attributes: input.attributes ?? {},
            imagePath: input.imagePath ?? null,
          })
          .returning({ id: products.id });

        if (!created)
          throw new AppError('internal_error', 'The product could not be created.', 500);

        const row = await this.findProduct(tx, organizationId, created.id);
        if (!row) throw new AppError('internal_error', 'The product could not be read.', 500);
        return toProductSummary(row);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async updateProduct(
    userId: string,
    organizationId: string,
    productId: string,
    input: ProductUpdateInput,
  ): Promise<ProductSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const updates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input)) {
          if (value !== undefined) updates[key] = value;
        }
        if (updates.reorderThreshold !== undefined) {
          updates.reorderThreshold = String(updates.reorderThreshold);
        }

        const updated = await tx
          .update(products)
          .set(updates as Partial<typeof products.$inferInsert>)
          .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
          .returning({ id: products.id });

        if (updated.length === 0) {
          throw new AppError('product_not_found', 'Product not found.', 404);
        }

        const row = await this.findProduct(tx, organizationId, productId);
        if (!row) throw new AppError('internal_error', 'The product could not be read.', 500);
        return toProductSummary(row);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async listCategories(userId: string, organizationId: string): Promise<CategorySummary[]> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const rows = await tx
        .select()
        .from(categories)
        .where(eq(categories.organizationId, organizationId))
        .orderBy(sql`lower(${categories.name})`);

      return rows.map((row) => ({
        id: row.id,
        parentId: row.parentId,
        name: row.name,
        slug: row.slug,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  }

  async createCategory(
    userId: string,
    organizationId: string,
    input: CategoryCreateInput,
  ): Promise<CategorySummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const [row] = await tx
          .insert(categories)
          .values({
            organizationId,
            name: input.name,
            slug: input.slug ?? defaultSlug(input.name, 80),
            parentId: input.parentId ?? null,
          })
          .returning();

        if (!row) throw new AppError('internal_error', 'The category could not be created.', 500);

        return {
          id: row.id,
          parentId: row.parentId,
          name: row.name,
          slug: row.slug,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async listBrands(userId: string, organizationId: string): Promise<BrandSummary[]> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const rows = await tx
        .select()
        .from(brands)
        .where(eq(brands.organizationId, organizationId))
        .orderBy(sql`lower(${brands.name})`);

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  }

  async createBrand(
    userId: string,
    organizationId: string,
    input: BrandCreateInput,
  ): Promise<BrandSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const [row] = await tx
          .insert(brands)
          .values({ organizationId, name: input.name })
          .returning();

        if (!row) throw new AppError('internal_error', 'The brand could not be created.', 500);

        return {
          id: row.id,
          name: row.name,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async listWarehouses(userId: string, organizationId: string): Promise<WarehouseSummary[]> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const warehouseRows = await tx
        .select()
        .from(warehouses)
        .where(eq(warehouses.organizationId, organizationId))
        .orderBy(sql`lower(${warehouses.name})`);

      const locationRows = await tx
        .select()
        .from(storageLocations)
        .where(eq(storageLocations.organizationId, organizationId))
        .orderBy(asc(storageLocations.code));

      const byWarehouse = new Map<string, StorageLocationSummary[]>();
      for (const location of locationRows) {
        const list = byWarehouse.get(location.warehouseId) ?? [];
        list.push(toLocationSummary(location));
        byWarehouse.set(location.warehouseId, list);
      }

      return warehouseRows.map((warehouse) => ({
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        addressLine: warehouse.addressLine,
        city: warehouse.city,
        countryCode: warehouse.countryCode?.trim() ?? null,
        isActive: warehouse.isActive,
        createdAt: warehouse.createdAt.toISOString(),
        updatedAt: warehouse.updatedAt.toISOString(),
        locations: byWarehouse.get(warehouse.id) ?? [],
      }));
    });
  }

  async createWarehouse(
    userId: string,
    organizationId: string,
    input: WarehouseCreateInput,
  ): Promise<WarehouseSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const [row] = await tx
          .insert(warehouses)
          .values({
            organizationId,
            code: input.code,
            name: input.name,
            addressLine: input.addressLine ?? null,
            city: input.city ?? null,
            countryCode: input.countryCode ?? null,
            isActive: input.isActive ?? true,
          })
          .returning();

        if (!row) throw new AppError('internal_error', 'The warehouse could not be created.', 500);

        return {
          id: row.id,
          code: row.code,
          name: row.name,
          addressLine: row.addressLine,
          city: row.city,
          countryCode: row.countryCode?.trim() ?? null,
          isActive: row.isActive,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          locations: [],
        };
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async createStorageLocation(
    userId: string,
    organizationId: string,
    warehouseId: string,
    input: StorageLocationCreateInput,
  ): Promise<StorageLocationSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const [warehouse] = await tx
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(and(eq(warehouses.id, warehouseId), eq(warehouses.organizationId, organizationId)))
          .limit(1);

        if (!warehouse) {
          throw new AppError('warehouse_not_found', 'Warehouse not found.', 404);
        }

        const [row] = await tx
          .insert(storageLocations)
          .values({
            organizationId,
            warehouseId,
            code: input.code,
            name: input.name,
            isActive: input.isActive ?? true,
          })
          .returning();

        if (!row) {
          throw new AppError('internal_error', 'The storage location could not be created.', 500);
        }

        return toLocationSummary(row);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  private async findProduct(
    tx: AppTransaction,
    organizationId: string,
    productId: string,
  ): Promise<ProductRow | undefined> {
    const [row] = await tx
      .select({ product: products, categoryName: categories.name, brandName: brands.name })
      .from(products)
      .leftJoin(
        categories,
        and(
          eq(categories.id, products.categoryId),
          eq(categories.organizationId, products.organizationId),
        ),
      )
      .leftJoin(
        brands,
        and(eq(brands.id, products.brandId), eq(brands.organizationId, products.organizationId)),
      )
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .limit(1);

    return row;
  }
}

function toLocationSummary(row: typeof storageLocations.$inferSelect): StorageLocationSummary {
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function defaultSlug(name: string, maxLength: number): string {
  try {
    return slugify(name, maxLength);
  } catch {
    throw new AppError(
      'validation_error',
      'Provide an explicit slug: the name contains no letters or digits.',
      400,
    );
  }
}
