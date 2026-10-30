import { isValidGtinBarcode } from '@mystock/domain';
import { z } from 'zod';

import { paginatedSchema, paginationQuerySchema } from './pagination';

export const productStatusSchema = z.enum(['active', 'inactive', 'discontinued', 'archived']);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const unitOfMeasureSchema = z.enum(['unit', 'meter', 'kilogram', 'liter', 'box', 'set']);
export type UnitOfMeasure = z.infer<typeof unitOfMeasureSchema>;

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens')
  .max(80);

const barcodeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{8}$|^[0-9]{12,14}$/, 'Use 8, 12, 13 or 14 digits')
  .refine(isValidGtinBarcode, 'The barcode check digit is invalid');

const internalCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9-]{4,32}$/, 'Use 4 to 32 uppercase letters, digits or hyphens');

const minorUnitsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const productCreateSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullish(),
  categoryId: z.uuid().nullish(),
  brandId: z.uuid().nullish(),
  manufacturerModel: z.string().trim().max(120).nullish(),
  barcode: barcodeSchema.nullish(),
  internalCode: internalCodeSchema.nullish(),
  unitOfMeasure: unitOfMeasureSchema.optional(),
  purchasePriceMinor: minorUnitsSchema.nullish(),
  salePriceMinor: minorUnitsSchema.nullish(),
  reorderThreshold: z.number().min(0).max(1_000_000_000).optional(),
  isSerialized: z.boolean().optional(),
  status: productStatusSchema.optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  imagePath: z.string().trim().max(500).nullish(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema
  .partial()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'Provide at least one field to update',
  );

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const productSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  categoryId: z.uuid().nullable(),
  categoryName: z.string().nullable(),
  brandId: z.uuid().nullable(),
  brandName: z.string().nullable(),
  manufacturerModel: z.string().nullable(),
  barcode: z.string().nullable(),
  internalCode: z.string().nullable(),
  unitOfMeasure: unitOfMeasureSchema,
  purchasePriceMinor: z.number().int().nullable(),
  salePriceMinor: z.number().int().nullable(),
  reorderThreshold: z.number(),
  isSerialized: z.boolean(),
  status: productStatusSchema,
  attributes: z.record(z.string(), z.unknown()),
  imagePath: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProductSummary = z.infer<typeof productSchema>;

export const productListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: productStatusSchema.optional(),
  categoryId: z.uuid().optional(),
  brandId: z.uuid().optional(),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const productListResponseSchema = paginatedSchema(productSchema);
export type ProductListResponse = z.infer<typeof productListResponseSchema>;

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  parentId: z.uuid().nullish(),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categorySchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CategorySummary = z.infer<typeof categorySchema>;

export const brandCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export type BrandCreateInput = z.infer<typeof brandCreateSchema>;

export const brandSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BrandSummary = z.infer<typeof brandSchema>;

export const warehouseCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,16}$/, 'Use 2 to 16 uppercase letters, digits or hyphens'),
  name: z.string().trim().min(1).max(120),
  addressLine: z.string().trim().max(200).nullish(),
  city: z.string().trim().max(120).nullish(),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use a two-letter country code')
    .nullish(),
  isActive: z.boolean().optional(),
});

export type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;

export const storageLocationSchema = z.object({
  id: z.uuid(),
  warehouseId: z.uuid(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StorageLocationSummary = z.infer<typeof storageLocationSchema>;

export const warehouseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  locations: z.array(storageLocationSchema),
});

export type WarehouseSummary = z.infer<typeof warehouseSchema>;

export const storageLocationCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,24}$/, 'Use 1 to 24 uppercase letters, digits or hyphens'),
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional(),
});

export type StorageLocationCreateInput = z.infer<typeof storageLocationCreateSchema>;
