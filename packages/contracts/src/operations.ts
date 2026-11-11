import { z } from 'zod';

import { paginatedSchema, paginationQuerySchema } from './pagination';

/**
 * Quantities are numeric(18,4) in the database; the API accepts at most four
 * decimal places so the value the user sends is the value the ledger records.
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

const minorUnitsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format');

const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use a two-letter country code');

export const purchaseOrderStatusSchema = z.enum([
  'draft',
  'ordered',
  'partially_received',
  'received',
  'cancelled',
]);
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>;

export const salesOrderStatusSchema = z.enum(['draft', 'confirmed', 'fulfilled', 'cancelled']);
export type SalesOrderStatus = z.infer<typeof salesOrderStatusSchema>;

export const supplierSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  contactName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  taxId: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SupplierSummary = z.infer<typeof supplierSchema>;

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(160).nullish(),
  email: z.email().max(254).nullish(),
  phone: z.string().trim().max(40).nullish(),
  addressLine: z.string().trim().max(200).nullish(),
  city: z.string().trim().max(120).nullish(),
  countryCode: countryCodeSchema.nullish(),
  taxId: z.string().trim().max(60).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;

export const supplierUpdateSchema = supplierCreateSchema
  .partial()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'Provide at least one field to update',
  );

export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;

export const supplierActivationSchema = z.object({
  isActive: z.boolean(),
});

export type SupplierActivationInput = z.infer<typeof supplierActivationSchema>;

export const supplierListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;

export const supplierListResponseSchema = paginatedSchema(supplierSchema);
export type SupplierListResponse = z.infer<typeof supplierListResponseSchema>;

const orderLineCreateBaseSchema = z.object({
  productId: z.uuid(),
  quantity: positiveQuantitySchema,
});

function hasNoDuplicateProducts(lines: { productId: string }[]): boolean {
  return new Set(lines.map((line) => line.productId)).size === lines.length;
}

export const purchaseOrderLineCreateSchema = orderLineCreateBaseSchema.extend({
  unitCostMinor: minorUnitsSchema.nullish(),
});

export type PurchaseOrderLineCreateInput = z.infer<typeof purchaseOrderLineCreateSchema>;

export const purchaseOrderCreateSchema = z
  .object({
    supplierId: z.uuid(),
    warehouseId: z.uuid(),
    locationId: z.uuid(),
    expectedOn: isoDateSchema.nullish(),
    reference: z.string().trim().max(120).nullish(),
    notes: z.string().trim().max(2000).nullish(),
    lines: z.array(purchaseOrderLineCreateSchema).min(1).max(100),
  })
  .refine((value) => hasNoDuplicateProducts(value.lines), {
    message: 'Each product may appear only once',
    path: ['lines'],
  });

export type PurchaseOrderCreateInput = z.infer<typeof purchaseOrderCreateSchema>;

export const purchaseReceiptSerialSchema = z.object({
  serialNumber: z.string().trim().min(1).max(120),
  imei: z
    .string()
    .trim()
    .regex(/^[0-9]{14,17}$/, 'Use 14 to 17 digits')
    .nullish(),
});

export type PurchaseReceiptSerialInput = z.infer<typeof purchaseReceiptSerialSchema>;

export const purchaseReceiptLineSchema = z.object({
  lineId: z.uuid(),
  quantity: positiveQuantitySchema,
  serials: z.array(purchaseReceiptSerialSchema).max(100).optional(),
});

export type PurchaseReceiptLineInput = z.infer<typeof purchaseReceiptLineSchema>;

export const purchaseReceiptSchema = z
  .object({
    note: z.string().trim().max(500).nullish(),
    lines: z.array(purchaseReceiptLineSchema).min(1).max(100),
  })
  .refine((value) => new Set(value.lines.map((line) => line.lineId)).size === value.lines.length, {
    message: 'Each line may appear only once',
    path: ['lines'],
  });

export type PurchaseReceiptInput = z.infer<typeof purchaseReceiptSchema>;

export const orderCancelSchema = z.object({
  reason: z.string().trim().max(500).nullish(),
});

export type OrderCancelInput = z.infer<typeof orderCancelSchema>;

export const purchaseOrderCreateResultSchema = z.object({
  orderId: z.uuid(),
  number: z.string(),
  status: purchaseOrderStatusSchema,
  lineCount: z.number().int(),
  totalQuantity: z.number(),
  duplicate: z.boolean(),
});

export type PurchaseOrderCreateResult = z.infer<typeof purchaseOrderCreateResultSchema>;

export const purchaseOrderStatusResultSchema = z.object({
  orderId: z.uuid(),
  number: z.string(),
  status: purchaseOrderStatusSchema,
  duplicate: z.boolean(),
});

export type PurchaseOrderStatusResult = z.infer<typeof purchaseOrderStatusResultSchema>;

export const purchaseReceiptTrackedItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  lineId: z.uuid(),
  unitCode: z.string(),
  serialNumber: z.string().nullable(),
  imei: z.string().nullable(),
});

export type PurchaseReceiptTrackedItem = z.infer<typeof purchaseReceiptTrackedItemSchema>;

export const purchaseReceiptResultSchema = purchaseOrderStatusResultSchema.extend({
  receivedLines: z.number().int(),
  receivedQuantity: z.number(),
  trackedItems: z.array(purchaseReceiptTrackedItemSchema),
});

export type PurchaseReceiptResult = z.infer<typeof purchaseReceiptResultSchema>;

export const purchaseOrderLineSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  isSerialized: z.boolean(),
  isIndividuallyTracked: z.boolean(),
  quantityOrdered: z.number(),
  quantityReceived: z.number(),
  quantityReturned: z.number(),
  unitCostMinor: z.number().int().nullable(),
});

export type PurchaseOrderLineSummary = z.infer<typeof purchaseOrderLineSchema>;

export const purchaseOrderSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  number: z.string(),
  supplierId: z.uuid(),
  supplierName: z.string(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  status: purchaseOrderStatusSchema,
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  expectedOn: z.string().nullable(),
  orderedAt: z.string().nullable(),
  receivedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  lineCount: z.number().int(),
  totalQuantity: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PurchaseOrderSummary = z.infer<typeof purchaseOrderSchema>;

export const purchaseOrderDetailSchema = purchaseOrderSchema.extend({
  lines: z.array(purchaseOrderLineSchema),
});

export type PurchaseOrderDetail = z.infer<typeof purchaseOrderDetailSchema>;

export const purchaseOrderListQuerySchema = paginationQuerySchema.extend({
  status: purchaseOrderStatusSchema.optional(),
  supplierId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
});

export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;

export const purchaseOrderListResponseSchema = paginatedSchema(purchaseOrderSchema);
export type PurchaseOrderListResponse = z.infer<typeof purchaseOrderListResponseSchema>;

export const salesOrderLineCreateSchema = orderLineCreateBaseSchema.extend({
  unitPriceMinor: minorUnitsSchema.nullish(),
});

export type SalesOrderLineCreateInput = z.infer<typeof salesOrderLineCreateSchema>;

export const salesOrderCreateSchema = z
  .object({
    customerName: z.string().trim().min(1).max(160),
    customerEmail: z.email().max(254).nullish(),
    customerPhone: z.string().trim().max(40).nullish(),
    warehouseId: z.uuid(),
    locationId: z.uuid(),
    reference: z.string().trim().max(120).nullish(),
    notes: z.string().trim().max(2000).nullish(),
    lines: z.array(salesOrderLineCreateSchema).min(1).max(100),
  })
  .refine((value) => hasNoDuplicateProducts(value.lines), {
    message: 'Each product may appear only once',
    path: ['lines'],
  });

export type SalesOrderCreateInput = z.infer<typeof salesOrderCreateSchema>;

export const salesOrderCreateResultSchema = z.object({
  orderId: z.uuid(),
  number: z.string(),
  status: salesOrderStatusSchema,
  lineCount: z.number().int(),
  totalQuantity: z.number(),
  duplicate: z.boolean(),
});

export type SalesOrderCreateResult = z.infer<typeof salesOrderCreateResultSchema>;

export const salesOrderStatusResultSchema = z.object({
  orderId: z.uuid(),
  number: z.string(),
  status: salesOrderStatusSchema,
  duplicate: z.boolean(),
});

export type SalesOrderStatusResult = z.infer<typeof salesOrderStatusResultSchema>;

export const salesOrderConfirmResultSchema = salesOrderStatusResultSchema.extend({
  reservedQuantity: z.number(),
});

export type SalesOrderConfirmResult = z.infer<typeof salesOrderConfirmResultSchema>;

export const salesOrderFulfilResultSchema = salesOrderStatusResultSchema.extend({
  issuedQuantity: z.number(),
});

export type SalesOrderFulfilResult = z.infer<typeof salesOrderFulfilResultSchema>;

export const salesOrderCancelResultSchema = salesOrderStatusResultSchema.extend({
  releasedReservations: z.number().int(),
});

export type SalesOrderCancelResult = z.infer<typeof salesOrderCancelResultSchema>;

export const salesOrderLineSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  quantity: z.number(),
  quantityReturned: z.number(),
  unitPriceMinor: z.number().int().nullable(),
  reservationId: z.uuid().nullable(),
});

export type SalesOrderLineSummary = z.infer<typeof salesOrderLineSchema>;

export const salesOrderSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  number: z.string(),
  customerName: z.string(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  status: salesOrderStatusSchema,
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  fulfilledAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  lineCount: z.number().int(),
  totalQuantity: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SalesOrderSummary = z.infer<typeof salesOrderSchema>;

export const salesOrderDetailSchema = salesOrderSchema.extend({
  lines: z.array(salesOrderLineSchema),
});

export type SalesOrderDetail = z.infer<typeof salesOrderDetailSchema>;

export const salesOrderListQuerySchema = paginationQuerySchema.extend({
  status: salesOrderStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
});

export type SalesOrderListQuery = z.infer<typeof salesOrderListQuerySchema>;

export const salesOrderListResponseSchema = paginatedSchema(salesOrderSchema);
export type SalesOrderListResponse = z.infer<typeof salesOrderListResponseSchema>;

export const returnStatusSchema = z.enum(['draft', 'posted', 'cancelled']);
export type ReturnStatus = z.infer<typeof returnStatusSchema>;

const returnLinesUnique = (lines: { purchaseOrderLineId?: string; salesOrderLineId?: string }[]) =>
  new Set(lines.map((line) => line.purchaseOrderLineId ?? line.salesOrderLineId)).size ===
  lines.length;

export const purchaseReturnLineCreateSchema = z.object({
  purchaseOrderLineId: z.uuid(),
  quantity: positiveQuantitySchema,
  deviceIds: z.array(z.uuid()).min(1).max(100).optional(),
});

export type PurchaseReturnLineCreateInput = z.infer<typeof purchaseReturnLineCreateSchema>;

export const purchaseReturnCreateSchema = z
  .object({
    reason: z.string().trim().min(3, 'Explain why the goods are going back').max(500),
    reference: z.string().trim().max(120).nullish(),
    lines: z.array(purchaseReturnLineCreateSchema).min(1).max(100),
  })
  .refine((value) => returnLinesUnique(value.lines), {
    message: 'Each order line may appear only once',
    path: ['lines'],
  });

export type PurchaseReturnCreateInput = z.infer<typeof purchaseReturnCreateSchema>;

export const salesReturnLineCreateSchema = z.object({
  salesOrderLineId: z.uuid(),
  quantity: positiveQuantitySchema,
});

export type SalesReturnLineCreateInput = z.infer<typeof salesReturnLineCreateSchema>;

export const salesReturnCreateSchema = z
  .object({
    reason: z.string().trim().min(3, 'Explain why the goods are coming back').max(500),
    reference: z.string().trim().max(120).nullish(),
    lines: z.array(salesReturnLineCreateSchema).min(1).max(100),
  })
  .refine((value) => returnLinesUnique(value.lines), {
    message: 'Each order line may appear only once',
    path: ['lines'],
  });

export type SalesReturnCreateInput = z.infer<typeof salesReturnCreateSchema>;

export const returnCreateResultSchema = z.object({
  returnId: z.uuid(),
  number: z.string(),
  status: returnStatusSchema,
  lineCount: z.number().int(),
  quantity: z.number(),
  duplicate: z.boolean(),
});

export type ReturnCreateResult = z.infer<typeof returnCreateResultSchema>;

export const returnStatusResultSchema = z.object({
  returnId: z.uuid(),
  number: z.string(),
  status: returnStatusSchema,
  duplicate: z.boolean(),
});

export type ReturnStatusResult = z.infer<typeof returnStatusResultSchema>;

export const returnPostResultSchema = returnStatusResultSchema.extend({
  quantity: z.number(),
});

export type ReturnPostResult = z.infer<typeof returnPostResultSchema>;

export const returnCancelResultSchema = returnStatusResultSchema.extend({
  releasedDevices: z.number().int().optional(),
});

export type ReturnCancelResult = z.infer<typeof returnCancelResultSchema>;

export const purchaseReturnDeviceSchema = z.object({
  deviceId: z.uuid(),
  serialNumber: z.string(),
});

export type PurchaseReturnDevice = z.infer<typeof purchaseReturnDeviceSchema>;

export const purchaseReturnLineSchema = z.object({
  id: z.uuid(),
  purchaseOrderLineId: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  isSerialized: z.boolean(),
  quantity: z.number(),
  quantityReceived: z.number(),
  devices: z.array(purchaseReturnDeviceSchema),
});

export type PurchaseReturnLineSummary = z.infer<typeof purchaseReturnLineSchema>;

export const purchaseReturnSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  number: z.string(),
  purchaseOrderId: z.uuid(),
  purchaseOrderNumber: z.string(),
  supplierId: z.uuid(),
  supplierName: z.string(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  status: returnStatusSchema,
  reason: z.string(),
  reference: z.string().nullable(),
  postedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  lineCount: z.number().int(),
  totalQuantity: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PurchaseReturnSummary = z.infer<typeof purchaseReturnSchema>;

export const purchaseReturnDetailSchema = purchaseReturnSchema.extend({
  lines: z.array(purchaseReturnLineSchema),
});

export type PurchaseReturnDetail = z.infer<typeof purchaseReturnDetailSchema>;

export const salesReturnLineSchema = z.object({
  id: z.uuid(),
  salesOrderLineId: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  quantity: z.number(),
  quantityFulfilled: z.number(),
});

export type SalesReturnLineSummary = z.infer<typeof salesReturnLineSchema>;

export const salesReturnSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  number: z.string(),
  salesOrderId: z.uuid(),
  salesOrderNumber: z.string(),
  customerName: z.string(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  status: returnStatusSchema,
  reason: z.string(),
  reference: z.string().nullable(),
  postedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  lineCount: z.number().int(),
  totalQuantity: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SalesReturnSummary = z.infer<typeof salesReturnSchema>;

export const salesReturnDetailSchema = salesReturnSchema.extend({
  lines: z.array(salesReturnLineSchema),
});

export type SalesReturnDetail = z.infer<typeof salesReturnDetailSchema>;

export const returnListQuerySchema = paginationQuerySchema.extend({
  status: returnStatusSchema.optional(),
});

export type ReturnListQuery = z.infer<typeof returnListQuerySchema>;

export const purchaseReturnListResponseSchema = paginatedSchema(purchaseReturnSchema);
export type PurchaseReturnListResponse = z.infer<typeof purchaseReturnListResponseSchema>;

export const salesReturnListResponseSchema = paginatedSchema(salesReturnSchema);
export type SalesReturnListResponse = z.infer<typeof salesReturnListResponseSchema>;
