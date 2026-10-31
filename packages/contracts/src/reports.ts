import { z } from 'zod';

import { paginatedSchema, paginationQuerySchema } from './pagination';
import { stockMovementTypeSchema } from './stock';

const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const reportOverviewQuerySchema = z
  .object({
    warehouseId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
  })
  .refine((value) => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to), {
    message: 'The start of the window must not be after its end.',
    path: ['to'],
  })
  .refine(
    (value) =>
      !value.from || !value.to || Date.parse(value.to) - Date.parse(value.from) <= 366 * 86_400_000,
    { message: 'The reporting window cannot exceed 366 days.', path: ['from'] },
  );

export type ReportOverviewQuery = z.infer<typeof reportOverviewQuerySchema>;

export const reportTotalsSchema = z.object({
  /** Ledger quantities; serialized products are counted through devices instead. */
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  productCount: z.number().int().nonnegative(),
  locationCount: z.number().int().nonnegative(),
  warehouseCount: z.number().int().nonnegative(),
  serializedInStock: z.number().int().nonnegative(),
});

export type ReportTotals = z.infer<typeof reportTotalsSchema>;

export const reportValuationSchema = z.object({
  /** Integer millimes (TND). Quantities without a price contribute zero. */
  purchaseValueMinor: z.number().int().nonnegative(),
  saleValueMinor: z.number().int().nonnegative(),
  unpricedProductCount: z.number().int().nonnegative(),
});

export type ReportValuation = z.infer<typeof reportValuationSchema>;

export const reportMovementTotalsSchema = z.object({
  count: z.number().int().nonnegative(),
  receivedQuantity: z.number(),
  issuedQuantity: z.number(),
  adjustedQuantity: z.number(),
  netQuantity: z.number(),
});

export type ReportMovementTotals = z.infer<typeof reportMovementTotalsSchema>;

export const reportSeriesPointSchema = z.object({
  /** UTC calendar day, YYYY-MM-DD. */
  date: z.string(),
  receivedQuantity: z.number(),
  issuedQuantity: z.number(),
  netQuantity: z.number(),
});

export type ReportSeriesPoint = z.infer<typeof reportSeriesPointSchema>;

export const reportWarehouseRowSchema = z.object({
  warehouseId: z.uuid(),
  code: z.string(),
  name: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  purchaseValueMinor: z.number().int().nonnegative(),
  saleValueMinor: z.number().int().nonnegative(),
  serializedInStock: z.number().int().nonnegative(),
});

export type ReportWarehouseRow = z.infer<typeof reportWarehouseRowSchema>;

export const reportOverviewSchema = z.object({
  generatedAt: z.string(),
  window: z.object({ from: z.string(), to: z.string() }),
  totals: reportTotalsSchema,
  valuation: reportValuationSchema,
  movements: reportMovementTotalsSchema,
  series: z.array(reportSeriesPointSchema),
  warehouses: z.array(reportWarehouseRowSchema),
});

export type ReportOverview = z.infer<typeof reportOverviewSchema>;

export const lowStockQuerySchema = paginationQuerySchema.extend({
  warehouseId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
});

export type LowStockQuery = z.infer<typeof lowStockQuerySchema>;

export const lowStockItemSchema = z.object({
  productId: z.uuid(),
  sku: z.string(),
  productName: z.string(),
  categoryName: z.string().nullable(),
  isSerialized: z.boolean(),
  reorderThreshold: z.number(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  shortfall: z.number(),
});

export type LowStockItem = z.infer<typeof lowStockItemSchema>;

export const lowStockResponseSchema = paginatedSchema(lowStockItemSchema);
export type LowStockResponse = z.infer<typeof lowStockResponseSchema>;

export const stockLevelExportQuerySchema = z.object({
  warehouseId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
});

export type StockLevelExportQuery = z.infer<typeof stockLevelExportQuerySchema>;

export const movementExportQuerySchema = z
  .object({
    warehouseId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    movementType: stockMovementTypeSchema.optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
  })
  .refine((value) => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to), {
    message: 'The start of the window must not be after its end.',
    path: ['to'],
  });

export type MovementExportQuery = z.infer<typeof movementExportQuerySchema>;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format');

export const supplierPerformanceQuerySchema = z
  .object({
    supplierId: z.uuid().optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine(
    (value) =>
      !value.from ||
      !value.to ||
      Date.parse(`${value.from}T00:00:00Z`) <= Date.parse(`${value.to}T00:00:00Z`),
    { message: 'The start of the window must not be after its end.', path: ['to'] },
  )
  .refine(
    (value) =>
      !value.from ||
      !value.to ||
      Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`) <=
        366 * 86_400_000,
    { message: 'The reporting window cannot exceed 366 days.', path: ['from'] },
  );

export type SupplierPerformanceQuery = z.infer<typeof supplierPerformanceQuerySchema>;

export const supplierPerformanceRowSchema = z.object({
  supplierId: z.uuid(),
  supplierName: z.string(),
  ordersCreated: z.number().int().nonnegative(),
  ordersReceived: z.number().int().nonnegative(),
  onTimeOrders: z.number().int().nonnegative(),
  lateOrders: z.number().int().nonnegative(),
  /** Null when no fully received order in the window had an expected date. */
  onTimeRate: z.number().min(0).max(1).nullable(),
  /** Null when no order in the window has both an order and a receipt date. */
  averageLeadTimeDays: z.number().nonnegative().nullable(),
  orderedValueMinor: z.number().int().nonnegative(),
  receivedValueMinor: z.number().int().nonnegative(),
  receivedQuantity: z.number(),
  returnedQuantity: z.number(),
  /** Posted return quantity divided by received quantity; null without receipts. */
  returnRate: z.number().nonnegative().nullable(),
});

export type SupplierPerformanceRow = z.infer<typeof supplierPerformanceRowSchema>;

export const supplierPerformanceResponseSchema = z.object({
  generatedAt: z.string(),
  window: z.object({ from: z.string(), to: z.string() }),
  suppliers: z.array(supplierPerformanceRowSchema),
});

export type SupplierPerformanceResponse = z.infer<typeof supplierPerformanceResponseSchema>;
