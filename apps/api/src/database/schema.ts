import {
  bigint,
  boolean,
  char,
  customType,
  date,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import type {
  LogoMimeType,
  MemberRole,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  PurchaseOrderStatus,
  SalesOrderStatus,
  UnitOfMeasure,
} from '@mystock/contracts';

// drizzle-orm 0.45 ships no bytea builder. Only reads go through this column, and both
// drivers hand back a byte array the caller treats as opaque.
const bytea = customType<{ data: Uint8Array }>({
  dataType: () => 'bytea',
});

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

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  ...timestamps,
});

export const organizationInvitations = pgTable('organization_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  email: text('email').notNull(),
  role: text('role').$type<MemberRole>().notNull(),
  invitedBy: uuid('invited_by'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ...timestamps,
});

export const organizationLogos = pgTable('organization_logos', {
  organizationId: uuid('organization_id').primaryKey(),
  mime: text('mime').$type<LogoMimeType>().notNull(),
  bytes: bytea('bytes').notNull(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
  isIndividuallyTracked: boolean('is_individually_tracked').notNull().default(false),
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

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  addressLine: text('address_line'),
  city: text('city'),
  countryCode: char('country_code', { length: 2 }),
  taxId: text('tax_id'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  number: text('number').notNull(),
  supplierId: uuid('supplier_id').notNull(),
  warehouseId: uuid('warehouse_id').notNull(),
  locationId: uuid('location_id').notNull(),
  status: text('status').$type<PurchaseOrderStatus>().notNull().default('draft'),
  reference: text('reference'),
  notes: text('notes'),
  expectedOn: date('expected_on', { mode: 'string' }),
  orderedAt: timestamp('ordered_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  ...timestamps,
});

export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  purchaseOrderId: uuid('purchase_order_id').notNull(),
  productId: uuid('product_id').notNull(),
  quantityOrdered: numeric('quantity_ordered', { precision: 18, scale: 4 })
    .$type<string>()
    .notNull(),
  quantityReceived: numeric('quantity_received', { precision: 18, scale: 4 })
    .$type<string>()
    .notNull()
    .default('0'),
  unitCostMinor: bigint('unit_cost_minor', { mode: 'number' }),
  ...timestamps,
});

export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  number: text('number').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  warehouseId: uuid('warehouse_id').notNull(),
  locationId: uuid('location_id').notNull(),
  status: text('status').$type<SalesOrderStatus>().notNull().default('draft'),
  reference: text('reference'),
  notes: text('notes'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  ...timestamps,
});

export const salesOrderLines = pgTable('sales_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  salesOrderId: uuid('sales_order_id').notNull(),
  productId: uuid('product_id').notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).$type<string>().notNull(),
  unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }),
  reservationId: uuid('reservation_id'),
  ...timestamps,
});

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  addressLine: text('address_line'),
  city: text('city'),
  countryCode: char('country_code', { length: 2 }),
  taxId: text('tax_id'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const salesInvoices = pgTable('sales_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  number: text('number').notNull(),
  salesOrderId: uuid('sales_order_id'),
  warehouseId: uuid('warehouse_id').notNull(),
  locationId: uuid('location_id').notNull(),
  customerId: uuid('customer_id'),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  netAmountMinor: bigint('net_amount_minor', { mode: 'number' }).notNull(),
  taxAmountMinor: bigint('tax_amount_minor', { mode: 'number' }).notNull(),
  totalAmountMinor: bigint('total_amount_minor', { mode: 'number' }).notNull(),
  paidAmountMinor: bigint('paid_amount_minor', { mode: 'number' }).notNull().default(0),
  paymentStatus: text('payment_status').$type<PaymentStatus>().notNull().default('unpaid'),
  paymentMethod: text('payment_method').$type<PaymentMethod>(),
  reference: text('reference'),
  notes: text('notes'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  ...timestamps,
});

export const salesInvoiceLines = pgTable('sales_invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  salesInvoiceId: uuid('sales_invoice_id').notNull(),
  salesOrderLineId: uuid('sales_order_line_id'),
  deviceId: uuid('device_id'),
  productId: uuid('product_id').notNull(),
  kind: text('kind').$type<'product' | 'device'>().notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).$type<string>().notNull(),
  unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }).notNull(),
  taxRatePercent: numeric('tax_rate_percent', { precision: 7, scale: 4 })
    .$type<string>()
    .notNull()
    .default('0'),
  netAmountMinor: bigint('net_amount_minor', { mode: 'number' }).notNull(),
  taxAmountMinor: bigint('tax_amount_minor', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const salesInvoicePayments = pgTable('sales_invoice_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  salesInvoiceId: uuid('sales_invoice_id').notNull(),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  method: text('method').$type<PaymentMethod>().notNull(),
  note: text('note'),
  recordedBy: uuid('recorded_by'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type StorageLocation = typeof storageLocations.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type SalesOrderLine = typeof salesOrderLines.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type SalesInvoice = typeof salesInvoices.$inferSelect;
export type SalesInvoiceLine = typeof salesInvoiceLines.$inferSelect;
export type SalesInvoicePayment = typeof salesInvoicePayments.$inferSelect;
