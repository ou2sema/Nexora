import { z } from 'zod';

import { productSchema } from './catalog';
import { deviceSchema } from './devices';
import { paginatedSchema, paginationQuerySchema } from './pagination';

export const scanQuerySchema = z.object({
  code: z.string().trim().min(1, 'Enter a barcode, serial or SKU').max(120),
});

export type ScanQuery = z.infer<typeof scanQuerySchema>;

export const scanStockLineSchema = z.object({
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
});

export type ScanStockLine = z.infer<typeof scanStockLineSchema>;

export const scanProductResultSchema = z.object({
  kind: z.literal('product'),
  product: productSchema,
  stockLines: z.array(scanStockLineSchema),
  totals: z.object({
    onHand: z.number(),
    reserved: z.number(),
    available: z.number(),
  }),
});

export type ScanProductResult = z.infer<typeof scanProductResultSchema>;

export const scanDeviceResultSchema = z.object({
  kind: z.literal('device'),
  device: deviceSchema,
});

export type ScanDeviceResult = z.infer<typeof scanDeviceResultSchema>;

export const trackedItemStatusSchema = z.enum(['in_stock', 'sold', 'returned', 'lost']);
export type TrackedItemStatus = z.infer<typeof trackedItemStatusSchema>;

export const trackedItemEventTypeSchema = z.enum([
  'received',
  'moved',
  'sold',
  'returned',
  'marked_lost',
  'status_changed',
]);
export type TrackedItemEventType = z.infer<typeof trackedItemEventTypeSchema>;

export const trackedItemEventSchema = z.object({
  id: z.uuid(),
  eventType: trackedItemEventTypeSchema,
  statusFrom: trackedItemStatusSchema.nullable(),
  statusTo: trackedItemStatusSchema.nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export type TrackedItemEvent = z.infer<typeof trackedItemEventSchema>;

export const trackedItemSummarySchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  unitCode: z.string(),
  serialNumber: z.string().nullable(),
  imei: z.string().nullable(),
  status: trackedItemStatusSchema,
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  purchaseOrderNumber: z.string().nullable(),
  receivedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TrackedItemSummary = z.infer<typeof trackedItemSummarySchema>;

export const scanTrackedItemResultSchema = z.object({
  kind: z.literal('tracked_item'),
  item: trackedItemSummarySchema,
  product: productSchema,
  events: z.array(trackedItemEventSchema),
});

export type ScanTrackedItemResult = z.infer<typeof scanTrackedItemResultSchema>;

export const scanResultSchema = z.discriminatedUnion('kind', [
  scanTrackedItemResultSchema,
  scanProductResultSchema,
  scanDeviceResultSchema,
]);

export type ScanResult = z.infer<typeof scanResultSchema>;

export const barcodeAssignmentResultSchema = z.object({
  productId: z.uuid(),
  barcode: z.string(),
});

export type BarcodeAssignmentResult = z.infer<typeof barcodeAssignmentResultSchema>;

const labelCopiesSchema = z.number().int().min(1).max(20).optional();

export const labelRequestSchema = z.object({
  items: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('product'), productId: z.uuid(), copies: labelCopiesSchema }),
        z.object({ kind: z.literal('device'), deviceId: z.uuid(), copies: labelCopiesSchema }),
        z.object({ kind: z.literal('item'), itemId: z.uuid(), copies: labelCopiesSchema }),
      ]),
    )
    .min(1)
    .max(50),
});

export type LabelRequest = z.infer<typeof labelRequestSchema>;

const countQuantitySchema = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000_000)
  .refine(
    (value) => Math.abs(value * 10_000 - Math.round(value * 10_000)) < 1e-6,
    'Use at most four decimal places',
  );

export const stockCountStatusSchema = z.enum(['open', 'posted', 'cancelled']);
export type StockCountStatus = z.infer<typeof stockCountStatusSchema>;

export const stockCountLineSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  countedQuantity: z.number(),
  onHand: z.number(),
  variance: z.number(),
  updatedAt: z.string(),
});

export type StockCountLine = z.infer<typeof stockCountLineSchema>;

export const stockCountSummarySchema = z.object({
  id: z.uuid(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  status: stockCountStatusSchema,
  note: z.string().nullable(),
  lineCount: z.number().int(),
  createdAt: z.string(),
  postedAt: z.string().nullable(),
});

export type StockCountSummary = z.infer<typeof stockCountSummarySchema>;

export const stockCountSchema = stockCountSummarySchema.extend({
  lines: z.array(stockCountLineSchema),
});

export type StockCount = z.infer<typeof stockCountSchema>;

export const stockCountListQuerySchema = paginationQuerySchema.extend({
  status: stockCountStatusSchema.optional(),
});

export type StockCountListQuery = z.infer<typeof stockCountListQuerySchema>;

export const stockCountListResponseSchema = paginatedSchema(stockCountSummarySchema);
export type StockCountListResponse = z.infer<typeof stockCountListResponseSchema>;

export const stockCountStartSchema = z.object({
  warehouseId: z.uuid(),
  locationId: z.uuid(),
  note: z.string().trim().max(500).nullish(),
});

export type StockCountStartInput = z.infer<typeof stockCountStartSchema>;

export const stockCountStartResultSchema = z.object({
  countId: z.uuid(),
  warehouseId: z.uuid(),
  locationId: z.uuid(),
  status: stockCountStatusSchema,
  createdAt: z.string(),
});

export type StockCountStartResult = z.infer<typeof stockCountStartResultSchema>;

export const stockCountRecordSchema = z.object({
  productId: z.uuid(),
  quantity: countQuantitySchema,
  mode: z.enum(['increment', 'set']).optional(),
});

export type StockCountRecordInput = z.infer<typeof stockCountRecordSchema>;

export const stockCountRecordResultSchema = z.object({
  lineId: z.uuid(),
  productId: z.uuid(),
  countedQuantity: z.number(),
});

export type StockCountRecordResult = z.infer<typeof stockCountRecordResultSchema>;

export const stockCountPostResultSchema = z.object({
  countId: z.uuid(),
  status: stockCountStatusSchema,
  lineCount: z.number().int(),
  adjustedLines: z.number().int(),
  adjustments: z.array(
    z.object({
      productId: z.uuid(),
      previousOnHand: z.number(),
      countedQuantity: z.number(),
      delta: z.number(),
    }),
  ),
  duplicate: z.boolean(),
});

export type StockCountPostResult = z.infer<typeof stockCountPostResultSchema>;

export const stockCountDiscardResultSchema = z.object({
  countId: z.uuid(),
  status: stockCountStatusSchema,
});

export type StockCountDiscardResult = z.infer<typeof stockCountDiscardResultSchema>;
