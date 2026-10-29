import {
  bigint,
  boolean,
  char,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import type { MemberRole, ProductStatus, UnitOfMeasure } from '@mystock/contracts';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  ...timestamps,
});

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: text('role').$type<MemberRole>().notNull(),
  ...timestamps,
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  parentId: uuid('parent_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  ...timestamps,
});

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  ...timestamps,
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  categoryId: uuid('category_id'),
  brandId: uuid('brand_id'),
  manufacturerModel: text('manufacturer_model'),
  barcode: text('barcode'),
  internalCode: text('internal_code'),
  unitOfMeasure: text('unit_of_measure').$type<UnitOfMeasure>().notNull().default('unit'),
  purchasePriceMinor: bigint('purchase_price_minor', { mode: 'number' }),
  salePriceMinor: bigint('sale_price_minor', { mode: 'number' }),
  reorderThreshold: numeric('reorder_threshold', { precision: 18, scale: 4 })
    .$type<string>()
    .notNull()
    .default('0'),
  isSerialized: boolean('is_serialized').notNull().default(false),
  status: text('status').$type<ProductStatus>().notNull().default('active'),
  attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
  imagePath: text('image_path'),
  ...timestamps,
});

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  addressLine: text('address_line'),
  city: text('city'),
  countryCode: char('country_code', { length: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const storageLocations = pgTable('storage_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  warehouseId: uuid('warehouse_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type StorageLocation = typeof storageLocations.$inferSelect;
