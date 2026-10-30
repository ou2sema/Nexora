import { Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { ZodType } from 'zod';

import {
  type DeviceEventSummary,
  type DeviceListQuery,
  type DeviceListResponse,
  type DeviceMoveInput,
  type DeviceMoveResult,
  type DeviceRegisterInput,
  type DeviceRegistrationResult,
  type DeviceStatusChangeInput,
  type DeviceStatusChangeResult,
  type DeviceSummary,
  deviceConditionSchema,
  deviceEventSchema,
  deviceEventTypeSchema,
  deviceListResponseSchema,
  deviceMoveResultSchema,
  deviceRegistrationResultSchema,
  deviceStatusChangeResultSchema,
  deviceStatusSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { fingerprintOf, requireIdempotencyKey } from '../common/idempotency';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';

export interface DeviceRow {
  id: string;
  organization_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  serial_number: string;
  imei: string | null;
  condition: string;
  status: string;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  warranty_start_on: string | Date | null;
  warranty_end_on: string | Date | null;
  supplier_reference: string | null;
  note: string | null;
  received_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface DeviceEventRow {
  id: string;
  event_type: string;
  status_from: string | null;
  status_to: string | null;
  warehouse_from: string | null;
  location_from: string | null;
  warehouse_to: string | null;
  location_to: string | null;
  note: string | null;
  actor_id: string | null;
  created_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateString(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function parseResult<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError('internal_error', 'Unexpected device operation response.', 500);
  }
  return parsed.data;
}

export const DEVICE_SELECT = sql`
  select d.id, d.organization_id, d.product_id, p.sku as product_sku, p.name as product_name,
         d.serial_number, d.imei, d.condition, d.status, d.warehouse_id, w.code as warehouse_code,
         d.location_id, l.code as location_code, d.warranty_start_on, d.warranty_end_on,
         d.supplier_reference, d.note, d.received_at, d.created_at, d.updated_at
  from public.devices d
  join public.products p
    on p.id = d.product_id and p.organization_id = d.organization_id
  join public.warehouses w
    on w.id = d.warehouse_id and w.organization_id = d.organization_id
  join public.storage_locations l
    on l.id = d.location_id and l.organization_id = d.organization_id
    and l.warehouse_id = d.warehouse_id
`;

export function toDeviceSummary(row: DeviceRow): DeviceSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    productSku: row.product_sku,
    productName: row.product_name,
    serialNumber: row.serial_number,
    imei: row.imei,
    condition: deviceConditionSchema.parse(row.condition),
    status: deviceStatusSchema.parse(row.status),
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouse_code,
    locationId: row.location_id,
    locationCode: row.location_code,
    warrantyStartOn: toDateString(row.warranty_start_on),
    warrantyEndOn: toDateString(row.warranty_end_on),
    supplierReference: row.supplier_reference,
    note: row.note,
    receivedAt: toIso(row.received_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

@Injectable()
export class DevicesService {
  constructor(private readonly access: TenantAccessService) {}

  async list(
    userId: string,
    organizationId: string,
    query: DeviceListQuery,
  ): Promise<DeviceListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`d.organization_id = ${organizationId}`];

      if (query.status) {
        conditions.push(sql`d.status = ${query.status}::app.device_status`);
      }
      if (query.productId) conditions.push(sql`d.product_id = ${query.productId}`);
      if (query.warehouseId) conditions.push(sql`d.warehouse_id = ${query.warehouseId}`);
      if (query.search) {
        const pattern = `%${escapeLike(query.search)}%`;
        conditions.push(
          sql`(d.serial_number ilike ${pattern} or d.imei ilike ${pattern} or p.sku ilike ${pattern} or p.name ilike ${pattern})`,
        );
      }

      const where = sql.join(conditions, sql` and `);
      const offset = (query.page - 1) * query.pageSize;

      const totals = resultRows<{ total: number }>(
        await tx.execute(sql`
          select count(*)::int as total
          from public.devices d
          join public.products p
            on p.id = d.product_id and p.organization_id = d.organization_id
          where ${where}
        `),
      );

      const rows = resultRows<DeviceRow>(
        await tx.execute(sql`
          ${DEVICE_SELECT}
          where ${where}
          order by d.created_at desc, d.id desc
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return deviceListResponseSchema.parse({
        items: rows.map(toDeviceSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: totals[0]?.total ?? 0,
      });
    });
  }

  async get(userId: string, organizationId: string, deviceId: string): Promise<DeviceSummary> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const rows = resultRows<DeviceRow>(
        await tx.execute(sql`
          ${DEVICE_SELECT}
          where d.id = ${deviceId} and d.organization_id = ${organizationId}
        `),
      );

      const row = rows[0];
      if (!row) throw new AppError('device_not_found', 'Device not found.', 404);
      return toDeviceSummary(row);
    });
  }

  async events(
    userId: string,
    organizationId: string,
    deviceId: string,
  ): Promise<DeviceEventSummary[]> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const device = resultRows<{ id: string }>(
        await tx.execute(
          sql`select id from public.devices where id = ${deviceId} and organization_id = ${organizationId}`,
        ),
      );
      if (device.length === 0) throw new AppError('device_not_found', 'Device not found.', 404);

      const rows = resultRows<DeviceEventRow>(
        await tx.execute(sql`
          select id, event_type, status_from, status_to, warehouse_from, location_from,
                 warehouse_to, location_to, note, actor_id, created_at
          from public.device_events
          where device_id = ${deviceId} and organization_id = ${organizationId}
          order by created_at, id
        `),
      );

      return rows.map((row) =>
        deviceEventSchema.parse({
          id: row.id,
          eventType: deviceEventTypeSchema.parse(row.event_type),
          statusFrom: row.status_from ? deviceStatusSchema.parse(row.status_from) : null,
          statusTo: row.status_to ? deviceStatusSchema.parse(row.status_to) : null,
          warehouseFrom: row.warehouse_from,
          locationFrom: row.location_from,
          warehouseTo: row.warehouse_to,
          locationTo: row.location_to,
          note: row.note,
          actorId: row.actor_id,
          createdAt: toIso(row.created_at),
        }),
      );
    });
  }

  async register(
    userId: string,
    organizationId: string,
    idempotencyKey: string | undefined,
    input: DeviceRegisterInput,
  ): Promise<DeviceRegistrationResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.register_device(
            ${organizationId}::uuid, ${input.productId}::uuid, ${input.serialNumber},
            ${key}, ${fingerprintOf(input)}, ${input.imei ?? null},
            ${input.condition ?? 'new'}::app.device_condition,
            ${input.warehouseId}::uuid, ${input.locationId}::uuid,
            ${input.warrantyStartOn ?? null}::date, ${input.warrantyEndOn ?? null}::date,
            ${input.supplierReference ?? null}, ${input.note ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(deviceRegistrationResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async changeStatus(
    userId: string,
    organizationId: string,
    deviceId: string,
    idempotencyKey: string | undefined,
    input: DeviceStatusChangeInput,
  ): Promise<DeviceStatusChangeResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.change_device_status(
            ${organizationId}::uuid, ${deviceId}::uuid, ${input.status}::app.device_status,
            ${key}, ${fingerprintOf({ deviceId, ...input })}, ${input.note ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(deviceStatusChangeResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async move(
    userId: string,
    organizationId: string,
    deviceId: string,
    idempotencyKey: string | undefined,
    input: DeviceMoveInput,
  ): Promise<DeviceMoveResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.move_device(
            ${organizationId}::uuid, ${deviceId}::uuid, ${input.warehouseId}::uuid,
            ${input.locationId}::uuid, ${key}, ${fingerprintOf({ deviceId, ...input })},
            ${input.note ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResult(deviceMoveResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }
}
