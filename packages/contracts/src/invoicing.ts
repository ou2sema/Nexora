import { z } from 'zod';

import { paginatedSchema, paginationQuerySchema } from './pagination';

/**
 * Quantities mirror numeric(18,4) and amounts mirror the integer minor units
 * (`bigint` millimes) the invoice is stored in. The client never sends totals:
 * net, tax and total are computed by `app.create_sales_invoice` and read back.
 */
const positiveQuantitySchema = z
  .number()
  .finite()
  .refine((value) => Math.abs(value * 10_000 - Math.round(value * 10_000)) < 1e-6, {
    message: 'Use at most four decimal places',
  })
  .refine((value) => value > 0, 'Quantity must be greater than zero');

const minorUnitsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** A per-line rate captured at the moment of sale; 0 means the line is not taxed. */
const taxRateSchema = z
  .number()
  .finite()
  .min(0)
  .max(100)
  .refine((value) => Math.abs(value * 10_000 - Math.round(value * 10_000)) < 1e-6, {
    message: 'Use at most four decimal places',
  });

const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use a two-letter country code');

export const paymentStatusSchema = z.enum(['unpaid', 'partial', 'paid']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/**
 * The ways a depot actually settles a counter sale. No card network, token or
 * account data belongs here: `card_manual` means the terminal slip was keyed by hand.
 */
export const paymentMethodSchema = z.enum(['cash', 'bank_transfer', 'card_manual', 'credit']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const customerSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  taxId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CustomerSummary = z.infer<typeof customerSchema>;

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.email().max(254).nullish(),
  phone: z.string().trim().max(40).nullish(),
  addressLine: z.string().trim().max(200).nullish(),
  city: z.string().trim().max(120).nullish(),
  countryCode: countryCodeSchema.nullish(),
  taxId: z.string().trim().max(60).nullish(),
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

export const customerUpdateSchema = customerCreateSchema
  .partial()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'Provide at least one field to update',
  );

export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

export const customerActivationSchema = z.object({
  isActive: z.boolean(),
});

export type CustomerActivationInput = z.infer<typeof customerActivationSchema>;

export const customerListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

export const customerListResponseSchema = paginatedSchema(customerSchema);
export type CustomerListResponse = z.infer<typeof customerListResponseSchema>;

export const customerSaveResultSchema = z.object({
  customerId: z.uuid(),
  name: z.string(),
  isActive: z.boolean(),
});

export type CustomerSaveResult = z.infer<typeof customerSaveResultSchema>;

/**
 * A basket line. `product` sells a quantity out of the ledger; `device` sells one
 * serialized unit out of the device lifecycle. A serialized product is never a
 * quantity line, so the scanner resolves it to a `device` line.
 */
export const invoiceProductLineSchema = z.object({
  kind: z.literal('product'),
  productId: z.uuid(),
  quantity: positiveQuantitySchema,
  unitPriceMinor: minorUnitsSchema.nullish(),
  taxRatePercent: taxRateSchema.nullish(),
});

export const invoiceDeviceLineSchema = z.object({
  kind: z.literal('device'),
  deviceId: z.uuid(),
  unitPriceMinor: minorUnitsSchema.nullish(),
  taxRatePercent: taxRateSchema.nullish(),
});

export const invoiceLineSchema = z.discriminatedUnion('kind', [
  invoiceProductLineSchema,
  invoiceDeviceLineSchema,
]);

export type InvoiceProductLineInput = z.infer<typeof invoiceProductLineSchema>;
export type InvoiceDeviceLineInput = z.infer<typeof invoiceDeviceLineSchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;

function hasNoDuplicateSources(lines: InvoiceLineInput[]): boolean {
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.kind === 'product' ? `product:${line.productId}` : `device:${line.deviceId}`;
    seen.add(key);
  }

  return seen.size === lines.length;
}

function hasCustomer(value: { customerId?: string | null; customerName?: string | null }): boolean {
  return Boolean(value.customerId) || Boolean(value.customerName?.trim());
}

export const salesInvoiceCreateSchema = z
  .object({
    warehouseId: z.uuid(),
    locationId: z.uuid(),
    customerId: z.uuid().nullish(),
    customerName: z.string().trim().max(160).nullish(),
    customerEmail: z.email().max(254).nullish(),
    customerPhone: z.string().trim().max(40).nullish(),
    lines: z.array(invoiceLineSchema).min(1).max(100),
    paidAmountMinor: minorUnitsSchema.default(0),
    paymentMethod: paymentMethodSchema.default('cash'),
    paymentNote: z.string().trim().max(500).nullish(),
    reference: z.string().trim().max(120).nullish(),
    notes: z.string().trim().max(2000).nullish(),
  })
  .refine((value) => hasCustomer(value), {
    message: 'Select a customer or name the buyer',
    path: ['customerName'],
  })
  .refine((value) => hasNoDuplicateSources(value.lines), {
    message: 'Each product and each device may appear only once',
    path: ['lines'],
  });

export type SalesInvoiceCreateInput = z.infer<typeof salesInvoiceCreateSchema>;

/** What `app.create_sales_invoice` returns: the invoice as the database computed it. */
export const salesInvoiceCreateResultSchema = z.object({
  invoiceId: z.uuid(),
  number: z.string(),
  orderId: z.uuid().nullable(),
  lineCount: z.number().int(),
  totalQuantity: z.number(),
  netAmountMinor: z.number().int(),
  taxAmountMinor: z.number().int(),
  totalAmountMinor: z.number().int(),
  paidAmountMinor: z.number().int(),
  remainingAmountMinor: z.number().int(),
  paymentStatus: paymentStatusSchema,
  paymentMethod: paymentMethodSchema.nullable(),
  issuedAt: z.string(),
  duplicate: z.boolean(),
});

export type SalesInvoiceCreateResult = z.infer<typeof salesInvoiceCreateResultSchema>;

export const salesInvoicePaymentCreateSchema = z.object({
  amountMinor: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  method: paymentMethodSchema,
  note: z.string().trim().max(500).nullish(),
});

export type SalesInvoicePaymentCreateInput = z.infer<typeof salesInvoicePaymentCreateSchema>;

export const salesInvoicePaymentResultSchema = z.object({
  invoiceId: z.uuid(),
  number: z.string(),
  paidAmountMinor: z.number().int(),
  remainingAmountMinor: z.number().int(),
  paymentStatus: paymentStatusSchema,
  paymentMethod: paymentMethodSchema.nullable(),
  duplicate: z.boolean(),
});

export type SalesInvoicePaymentResult = z.infer<typeof salesInvoicePaymentResultSchema>;

export const salesInvoiceLineSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['product', 'device']),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  deviceId: z.uuid().nullable(),
  serialNumber: z.string().nullable(),
  quantity: z.number(),
  unitPriceMinor: z.number().int(),
  taxRatePercent: z.number(),
  netAmountMinor: z.number().int(),
  taxAmountMinor: z.number().int(),
});

export type SalesInvoiceLineSummary = z.infer<typeof salesInvoiceLineSchema>;

export const salesInvoicePaymentSchema = z.object({
  id: z.uuid(),
  amountMinor: z.number().int(),
  method: paymentMethodSchema,
  note: z.string().nullable(),
  recordedAt: z.string(),
  recordedByEmail: z.string().nullable(),
});

export type SalesInvoicePaymentSummary = z.infer<typeof salesInvoicePaymentSchema>;

export const salesInvoiceSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  number: z.string(),
  salesOrderId: z.uuid().nullable(),
  salesOrderNumber: z.string().nullable(),
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  customerId: z.uuid().nullable(),
  customerName: z.string(),
  customerEmail: z.string().nullable(),
  customerPhone: z.string().nullable(),
  netAmountMinor: z.number().int(),
  taxAmountMinor: z.number().int(),
  totalAmountMinor: z.number().int(),
  paidAmountMinor: z.number().int(),
  remainingAmountMinor: z.number().int(),
  paymentStatus: paymentStatusSchema,
  paymentMethod: paymentMethodSchema.nullable(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  lineCount: z.number().int(),
  totalQuantity: z.number(),
  issuedAt: z.string(),
  createdByEmail: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SalesInvoiceSummary = z.infer<typeof salesInvoiceSchema>;

export const salesInvoiceDetailSchema = salesInvoiceSchema.extend({
  lines: z.array(salesInvoiceLineSchema),
  payments: z.array(salesInvoicePaymentSchema),
});

export type SalesInvoiceDetail = z.infer<typeof salesInvoiceDetailSchema>;

export const salesInvoiceListQuerySchema = paginationQuerySchema.extend({
  paymentStatus: paymentStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
});

export type SalesInvoiceListQuery = z.infer<typeof salesInvoiceListQuerySchema>;

export const salesInvoiceListResponseSchema = paginatedSchema(salesInvoiceSchema);
export type SalesInvoiceListResponse = z.infer<typeof salesInvoiceListResponseSchema>;
