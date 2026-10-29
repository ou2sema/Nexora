import { z } from 'zod';

import { paginatedSchema, paginationQuerySchema } from './pagination';

export const stockMovementTypeSchema = z.enum([
  'receipt',
  'issue',
  'adjustment',
  'transfer_out',
  'transfer_in',
]);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

export const stockReferenceTypeSchema = z.enum([
  'manual',
  'purchase_order',
  'outgoing_order',
  'transfer',
  'reservation',
  'adjustment',
  'inventory_count',
]);
export type StockReferenceType = z.infer<typeof stockReferenceTypeSchema>;

export const reservationStatusSchema = z.enum(['active', 'released', 'fulfilled', 'expired']);
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;

/**
 * Quantities are stored as numeric(18,4); the API accepts at most four decimal
 * places so the value the user sends is the value the ledger records.
 */
const decimalQuantitySchema = z
  .number()
  .finite()
  .refine(
    (value) => Math.abs(value * 10_000 - Math.round(value * 10_000)) < 1e-6,
    'Use at most four decimal places',
  );

const positiveQuantitySchema = decimalQuantitySchema.refine(
  (value) => value > 0,
  'Quantity must be greater than zero',
);

export const stockPostingSchema = z
  .object({
    productId: z.uuid(),
    warehouseId: z.uuid(),
    locationId: z.uuid(),
    type: z.enum(['receipt', 'issue', 'adjustment']),
    /** Positive for receipts and issues; signed (non-zero) for adjustments. */
    quantity: decimalQuantitySchema,
    reason: z.string().trim().min(3).max(500).nullish(),
    referenceType: stockReferenceTypeSchema.optional(),
    referenceId: z.uuid().nullish(),
    reservationId: z.uuid().nullish(),
  })
  .superRefine((value, context) => {
    if (value.type === 'adjustment') {
      if (value.quantity === 0) {
        context.addIssue({
          code: 'custom',
          path: ['quantity'],
          message: 'Adjustment quantity must not be zero.',
        });
      }
      if (!value.reason) {
        context.addIssue({
          code: 'custom',
          path: ['reason'],
          message: 'Adjustments require a reason.',
        });
      }
    } else if (value.quantity <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Quantity must be greater than zero.',
      });
    }

    if (value.reservationId && value.type !== 'issue') {
      context.addIssue({
        code: 'custom',
        path: ['reservationId'],
        message: 'Only an issue can fulfil a reservation.',
      });
    }
  });

export type StockPostingInput = z.infer<typeof stockPostingSchema>;

export const stockPostingResultSchema = z.object({
  movementId: z.uuid(),
  onHand: z.number(),
  available: z.number(),
  duplicate: z.boolean(),
});

export type StockPostingResult = z.infer<typeof stockPostingResultSchema>;

export const stockTransferSchema = z
  .object({
    productId: z.uuid(),
    sourceWarehouseId: z.uuid(),
    sourceLocationId: z.uuid(),
    targetWarehouseId: z.uuid(),
    targetLocationId: z.uuid(),
    quantity: positiveQuantitySchema,
    reason: z.string().trim().max(500).nullish(),
  })
  .refine(
    (value) =>
      value.sourceWarehouseId !== value.targetWarehouseId ||
      value.sourceLocationId !== value.targetLocationId,
    { message: 'Choose two different locations', path: ['targetLocationId'] },
  );

export type StockTransferInput = z.infer<typeof stockTransferSchema>;

export const stockTransferResultSchema = z.object({
  transferId: z.uuid(),
  quantity: z.number(),
  sourceOnHand: z.number(),
  targetOnHand: z.number(),
  duplicate: z.boolean(),
});

export type StockTransferResult = z.infer<typeof stockTransferResultSchema>;

export const stockLevelSchema = z.object({
  organizationId: z.uuid(),
  productId: z.uuid(),
  sku: z.string(),
  productName: z.string(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  updatedAt: z.string(),
});

export type StockLevelSummary = z.infer<typeof stockLevelSchema>;

export const stockLevelListQuerySchema = paginationQuerySchema.extend({
  productId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
});

export type StockLevelListQuery = z.infer<typeof stockLevelListQuerySchema>;

export const stockLevelListResponseSchema = paginatedSchema(stockLevelSchema);
export type StockLevelListResponse = z.infer<typeof stockLevelListResponseSchema>;

export const stockSummarySchema = z.object({
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  locationCount: z.number().int(),
  productCount: z.number().int(),
});

export type StockSummary = z.infer<typeof stockSummarySchema>;

export const stockMovementSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  movementType: stockMovementTypeSchema,
  quantityDelta: z.number(),
  onHandAfter: z.number(),
  reason: z.string().nullable(),
  referenceType: stockReferenceTypeSchema,
  referenceId: z.uuid().nullable(),
  transferId: z.uuid().nullable(),
  reservationId: z.uuid().nullable(),
  actorId: z.uuid().nullable(),
  correlationId: z.string().nullable(),
  createdAt: z.string(),
});

export type StockMovementSummary = z.infer<typeof stockMovementSchema>;

export const stockMovementListQuerySchema = paginationQuerySchema.extend({
  productId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  movementType: stockMovementTypeSchema.optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export type StockMovementListQuery = z.infer<typeof stockMovementListQuerySchema>;

export const stockMovementListResponseSchema = paginatedSchema(stockMovementSchema);
export type StockMovementListResponse = z.infer<typeof stockMovementListResponseSchema>;

export const stockReservationCreateSchema = z.object({
  productId: z.uuid(),
  warehouseId: z.uuid(),
  locationId: z.uuid(),
  quantity: positiveQuantitySchema,
  expiresAt: z.iso.datetime({ offset: true }).nullish(),
  referenceType: stockReferenceTypeSchema.optional(),
  referenceId: z.uuid().nullish(),
  note: z.string().trim().max(500).nullish(),
});

export type StockReservationCreateInput = z.infer<typeof stockReservationCreateSchema>;

export const stockReservationResultSchema = z.object({
  reservationId: z.uuid(),
  quantity: z.number(),
  reserved: z.number(),
  available: z.number(),
  duplicate: z.boolean(),
});

export type StockReservationResult = z.infer<typeof stockReservationResultSchema>;

export const stockReservationSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  quantity: z.number(),
  status: reservationStatusSchema,
  referenceType: stockReferenceTypeSchema,
  referenceId: z.uuid().nullable(),
  note: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdBy: z.uuid().nullable(),
  createdAt: z.string(),
  releasedAt: z.string().nullable(),
});

export type StockReservationSummary = z.infer<typeof stockReservationSchema>;

export const stockReservationListQuerySchema = paginationQuerySchema.extend({
  status: reservationStatusSchema.optional(),
  productId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
});

export type StockReservationListQuery = z.infer<typeof stockReservationListQuerySchema>;

export const stockReservationListResponseSchema = paginatedSchema(stockReservationSchema);
export type StockReservationListResponse = z.infer<typeof stockReservationListResponseSchema>;

export const stockReservationReleaseResultSchema = z.object({
  reservationId: z.uuid(),
  status: reservationStatusSchema,
  duplicate: z.boolean(),
});

export type StockReservationReleaseResult = z.infer<typeof stockReservationReleaseResultSchema>;

export const stockReconciliationRowSchema = z.object({
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  balanceOnHand: z.number(),
  ledgerOnHand: z.number(),
  difference: z.number(),
  movementCount: z.number().int(),
});

export type StockReconciliationRow = z.infer<typeof stockReconciliationRowSchema>;

export const stockRepairInputSchema = z.object({
  dryRun: z.boolean().default(true),
});

export type StockRepairInput = z.infer<typeof stockRepairInputSchema>;

export const stockRepairRowSchema = z.object({
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  previousOnHand: z.number(),
  ledgerOnHand: z.number(),
  repaired: z.boolean(),
});

export type StockRepairRow = z.infer<typeof stockRepairRowSchema>;
