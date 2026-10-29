import { z } from 'zod';

import { paginatedSchema, paginationQuerySchema } from './pagination';

export const deviceStatusSchema = z.enum([
  'in_stock',
  'reserved',
  'sold',
  'returned',
  'in_repair',
  'lost',
  'disposed',
]);
export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

export const deviceConditionSchema = z.enum(['new', 'used', 'refurbished', 'damaged', 'defective']);
export type DeviceCondition = z.infer<typeof deviceConditionSchema>;

export const deviceEventTypeSchema = z.enum([
  'registered',
  'moved',
  'reserved',
  'released',
  'issued',
  'returned',
  'repair_started',
  'repair_completed',
  'marked_lost',
  'disposed',
  'status_changed',
]);
export type DeviceEventType = z.infer<typeof deviceEventTypeSchema>;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format');

export const deviceRegisterSchema = z
  .object({
    productId: z.uuid(),
    serialNumber: z.string().trim().min(1).max(120),
    imei: z
      .string()
      .trim()
      .regex(/^[0-9]{14,17}$/, 'Use 14 to 17 digits')
      .nullish(),
    condition: deviceConditionSchema.optional(),
    warehouseId: z.uuid(),
    locationId: z.uuid(),
    warrantyStartOn: isoDateSchema.nullish(),
    warrantyEndOn: isoDateSchema.nullish(),
    supplierReference: z.string().trim().max(120).nullish(),
    note: z.string().trim().max(500).nullish(),
  })
  .refine(
    (value) =>
      !value.warrantyStartOn ||
      !value.warrantyEndOn ||
      value.warrantyEndOn >= value.warrantyStartOn,
    { message: 'Warranty end must not precede its start', path: ['warrantyEndOn'] },
  );

export type DeviceRegisterInput = z.infer<typeof deviceRegisterSchema>;

export const deviceRegistrationResultSchema = z.object({
  deviceId: z.uuid(),
  serialNumber: z.string(),
  status: deviceStatusSchema,
  duplicate: z.boolean(),
});

export type DeviceRegistrationResult = z.infer<typeof deviceRegistrationResultSchema>;

export const deviceSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  serialNumber: z.string(),
  imei: z.string().nullable(),
  condition: deviceConditionSchema,
  status: deviceStatusSchema,
  warehouseId: z.uuid(),
  warehouseCode: z.string(),
  locationId: z.uuid(),
  locationCode: z.string(),
  warrantyStartOn: z.string().nullable(),
  warrantyEndOn: z.string().nullable(),
  supplierReference: z.string().nullable(),
  note: z.string().nullable(),
  receivedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DeviceSummary = z.infer<typeof deviceSchema>;

export const deviceListQuerySchema = paginationQuerySchema.extend({
  status: deviceStatusSchema.optional(),
  productId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
});

export type DeviceListQuery = z.infer<typeof deviceListQuerySchema>;

export const deviceListResponseSchema = paginatedSchema(deviceSchema);
export type DeviceListResponse = z.infer<typeof deviceListResponseSchema>;

export const deviceEventSchema = z.object({
  id: z.uuid(),
  eventType: deviceEventTypeSchema,
  statusFrom: deviceStatusSchema.nullable(),
  statusTo: deviceStatusSchema.nullable(),
  warehouseFrom: z.uuid().nullable(),
  locationFrom: z.uuid().nullable(),
  warehouseTo: z.uuid().nullable(),
  locationTo: z.uuid().nullable(),
  note: z.string().nullable(),
  actorId: z.uuid().nullable(),
  createdAt: z.string(),
});

export type DeviceEventSummary = z.infer<typeof deviceEventSchema>;

export const deviceStatusChangeSchema = z.object({
  status: deviceStatusSchema,
  note: z.string().trim().max(500).nullish(),
});

export type DeviceStatusChangeInput = z.infer<typeof deviceStatusChangeSchema>;

export const deviceStatusChangeResultSchema = z.object({
  deviceId: z.uuid(),
  status: deviceStatusSchema,
  previousStatus: deviceStatusSchema,
  duplicate: z.boolean(),
});

export type DeviceStatusChangeResult = z.infer<typeof deviceStatusChangeResultSchema>;

export const deviceMoveSchema = z.object({
  warehouseId: z.uuid(),
  locationId: z.uuid(),
  note: z.string().trim().max(500).nullish(),
});

export type DeviceMoveInput = z.infer<typeof deviceMoveSchema>;

export const deviceMoveResultSchema = z.object({
  deviceId: z.uuid(),
  warehouseId: z.uuid(),
  locationId: z.uuid(),
  duplicate: z.boolean(),
});

export type DeviceMoveResult = z.infer<typeof deviceMoveResultSchema>;
