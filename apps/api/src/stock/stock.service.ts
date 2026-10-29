import { Injectable } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import type { ZodType } from 'zod';

import {
  type StockLevelListQuery,
  type StockLevelListResponse,
  type StockMovementListQuery,
  type StockMovementListResponse,
  type StockPostingInput,
  type StockPostingResult,
  type StockReconciliationRow,
  type StockRepairInput,
  type StockRepairRow,
  type StockReservationCreateInput,
  type StockReservationListQuery,
  type StockReservationListResponse,
  type StockReservationReleaseResult,
  type StockReservationResult,
  type StockSummary,
  type StockTransferInput,
  type StockTransferResult,
  reservationStatusSchema,
  stockLevelListResponseSchema,
  stockSummarySchema,
  stockMovementListResponseSchema,
  stockMovementTypeSchema,
  stockPostingResultSchema,
  stockReconciliationRowSchema,
  stockReferenceTypeSchema,
  stockRepairRowSchema,
  stockReservationListResponseSchema,
  stockReservationReleaseResultSchema,
  stockReservationResultSchema,
  stockTransferResultSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import { fingerprintOf, requireIdempotencyKey } from '../common/idempotency';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, ORG_ADMINS, TenantAccessService } from '../tenancy/tenant-access.service';

interface StockLevelRow {
  organization_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  location_id: string;
  location_code: string;
  on_hand: string;
  reserved: string;
  available: string;
  updated_at: Date | string;
}

interface StockMovementRow {
  id: string;
  organization_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  movement_type: string;
  quantity_delta: string;
  on_hand_after: string;
  reason: string | null;
  reference_type: string;
  reference_id: string | null;
  transfer_id: string | null;
  reservation_id: string | null;
  actor_id: string | null;
  correlation_id: string | null;
  created_at: Date | string;
}

interface StockReservationRow {
  id: string;
  organization_id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  quantity: string;
  status: string;
  reference_type: string;
  reference_id: string | null;
  note: string | null;
  expires_at: Date | string | null;
  created_by: string | null;
  created_at: Date | string;
  released_at: Date | string | null;
}

interface StockSummaryRow {
  on_hand: string;
  reserved: string;
  available: string;
  location_count: number | string;
  product_count: number | string;
}

interface ReconciliationDbRow {
  product_id: string;
  product_sku: string;
  product_name: string;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  balance_on_hand: string;
  ledger_on_hand: string;
  difference: string;
  movement_count: number | string;
}

interface RepairDbRow {
  product_id: string;
  product_sku: string;
  product_name: string;
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  location_code: string;
  previous_on_hand: string;
  ledger_on_hand: string;
  repaired: boolean;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableIso(value: Date | string | null): string | null {
  return value === null ? null : toIso(value);
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function parseResponse<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError('internal_error', 'Unexpected stock operation response.', 500);
  }
  return parsed.data;
}

@Injectable()
export class StockService {
  constructor(private readonly access: TenantAccessService) {}

  async listLevels(
    userId: string,
    organizationId: string,
    query: StockLevelListQuery,
  ): Promise<StockLevelListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`organization_id = ${organizationId}`];

      if (query.productId) conditions.push(sql`product_id = ${query.productId}`);
      if (query.warehouseId) conditions.push(sql`warehouse_id = ${query.warehouseId}`);
      if (query.locationId) conditions.push(sql`location_id = ${query.locationId}`);
      if (query.search) {
        const pattern = `%${escapeLike(query.search)}%`;
        conditions.push(sql`(sku ilike ${pattern} or product_name ilike ${pattern})`);
      }

      const where = sql.join(conditions, sql` and `);
      const offset = (query.page - 1) * query.pageSize;

      const totals = resultRows<{ total: number }>(
        await tx.execute(
          sql`select count(*)::int as total from public.stock_levels where ${where}`,
        ),
      );

      const rows = resultRows<StockLevelRow>(
        await tx.execute(sql`
          select organization_id, product_id, sku, product_name, warehouse_id, warehouse_code,
                 warehouse_name, location_id, location_code, on_hand, reserved, available, updated_at
          from public.stock_levels
          where ${where}
          order by lower(product_name), warehouse_code, location_code
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return stockLevelListResponseSchema.parse({
        items: rows.map((row) => ({
          organizationId: row.organization_id,
          productId: row.product_id,
          sku: row.sku,
          productName: row.product_name,
          warehouseId: row.warehouse_id,
          warehouseCode: row.warehouse_code,
          warehouseName: row.warehouse_name,
          locationId: row.location_id,
          locationCode: row.location_code,
          onHand: toNumber(row.on_hand),
          reserved: toNumber(row.reserved),
          available: toNumber(row.available),
          updatedAt: toIso(row.updated_at),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: totals[0]?.total ?? 0,
      });
    });
  }

  async summary(userId: string, organizationId: string): Promise<StockSummary> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const [row] = resultRows<StockSummaryRow>(
        await tx.execute(sql`
          select coalesce(sum(on_hand), 0) as on_hand,
                 coalesce(sum(reserved), 0) as reserved,
                 coalesce(sum(available), 0) as available,
                 count(*)::int as location_count,
                 count(distinct product_id)::int as product_count
          from public.stock_levels
          where organization_id = ${organizationId}
        `),
      );

      return stockSummarySchema.parse({
        onHand: toNumber(row?.on_hand ?? 0),
        reserved: toNumber(row?.reserved ?? 0),
        available: toNumber(row?.available ?? 0),
        locationCount: Number(row?.location_count ?? 0),
        productCount: Number(row?.product_count ?? 0),
      });
    });
  }

  async listMovements(
    userId: string,
    organizationId: string,
    query: StockMovementListQuery,
  ): Promise<StockMovementListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`m.organization_id = ${organizationId}`];

      if (query.productId) conditions.push(sql`m.product_id = ${query.productId}`);
      if (query.warehouseId) conditions.push(sql`m.warehouse_id = ${query.warehouseId}`);
      if (query.locationId) conditions.push(sql`m.location_id = ${query.locationId}`);
      if (query.movementType) {
        conditions.push(sql`m.movement_type = ${query.movementType}::app.stock_movement_type`);
      }
      if (query.from) conditions.push(sql`m.created_at >= ${query.from}::timestamptz`);
      if (query.to) conditions.push(sql`m.created_at <= ${query.to}::timestamptz`);

      const where = sql.join(conditions, sql` and `);
      const offset = (query.page - 1) * query.pageSize;

      const totals = resultRows<{ total: number }>(
        await tx.execute(
          sql`select count(*)::int as total from public.stock_movements m where ${where}`,
        ),
      );

      const rows = resultRows<StockMovementRow>(
        await tx.execute(sql`
          select m.id, m.organization_id, m.product_id, p.sku as product_sku, p.name as product_name,
                 m.warehouse_id, w.code as warehouse_code, m.location_id, l.code as location_code,
                 m.movement_type, m.quantity_delta, m.on_hand_after, m.reason, m.reference_type,
                 m.reference_id, m.transfer_id, m.reservation_id, m.actor_id, m.correlation_id,
                 m.created_at
          from public.stock_movements m
          join public.products p
            on p.id = m.product_id and p.organization_id = m.organization_id
          join public.warehouses w
            on w.id = m.warehouse_id and w.organization_id = m.organization_id
          join public.storage_locations l
            on l.id = m.location_id and l.organization_id = m.organization_id
            and l.warehouse_id = m.warehouse_id
          where ${where}
          order by m.created_at desc, m.id desc
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return stockMovementListResponseSchema.parse({
        items: rows.map((row) => ({
          id: row.id,
          organizationId: row.organization_id,
          productId: row.product_id,
          productSku: row.product_sku,
          productName: row.product_name,
          warehouseId: row.warehouse_id,
          warehouseCode: row.warehouse_code,
          locationId: row.location_id,
          locationCode: row.location_code,
          movementType: stockMovementTypeSchema.parse(row.movement_type),
          quantityDelta: toNumber(row.quantity_delta),
          onHandAfter: toNumber(row.on_hand_after),
          reason: row.reason,
          referenceType: stockReferenceTypeSchema.parse(row.reference_type),
          referenceId: row.reference_id,
          transferId: row.transfer_id,
          reservationId: row.reservation_id,
          actorId: row.actor_id,
          correlationId: row.correlation_id,
          createdAt: toIso(row.created_at),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: totals[0]?.total ?? 0,
      });
    });
  }

  async postMovement(
    userId: string,
    organizationId: string,
    idempotencyKey: string | undefined,
    input: StockPostingInput,
  ): Promise<StockPostingResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.post_stock_movement(
            ${organizationId}::uuid, ${input.productId}::uuid, ${input.warehouseId}::uuid,
            ${input.locationId}::uuid, ${input.type}::app.stock_movement_type,
            ${input.quantity}::numeric, ${key}, ${fingerprintOf(input)},
            ${input.reason ?? null}, ${input.referenceType ?? 'manual'}::app.stock_reference_type,
            ${input.referenceId ?? null}::uuid, ${input.reservationId ?? null}::uuid, null
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResponse(stockPostingResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async transfer(
    userId: string,
    organizationId: string,
    idempotencyKey: string | undefined,
    input: StockTransferInput,
  ): Promise<StockTransferResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.post_stock_transfer(
            ${organizationId}::uuid, ${input.productId}::uuid,
            ${input.sourceWarehouseId}::uuid, ${input.sourceLocationId}::uuid,
            ${input.targetWarehouseId}::uuid, ${input.targetLocationId}::uuid,
            ${input.quantity}::numeric, ${input.reason ?? null},
            ${key}, ${fingerprintOf(input)}, null
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResponse(stockTransferResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async reserve(
    userId: string,
    organizationId: string,
    idempotencyKey: string | undefined,
    input: StockReservationCreateInput,
  ): Promise<StockReservationResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.reserve_stock(
            ${organizationId}::uuid, ${input.productId}::uuid, ${input.warehouseId}::uuid,
            ${input.locationId}::uuid, ${input.quantity}::numeric, ${key},
            ${fingerprintOf(input)}, ${input.expiresAt ?? null}::timestamptz,
            ${input.referenceType ?? 'manual'}::app.stock_reference_type,
            ${input.referenceId ?? null}::uuid, ${input.note ?? null}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResponse(stockReservationResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async releaseReservation(
    userId: string,
    organizationId: string,
    reservationId: string,
    idempotencyKey: string | undefined,
  ): Promise<StockReservationReleaseResult> {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select app.release_stock_reservation(
            ${organizationId}::uuid, ${reservationId}::uuid, ${key},
            ${fingerprintOf({ reservationId })}
          ) as result
        `);

        const [row] = resultRows<{ result: unknown }>(result);
        return parseResponse(stockReservationReleaseResultSchema, row?.result);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async listReservations(
    userId: string,
    organizationId: string,
    query: StockReservationListQuery,
  ): Promise<StockReservationListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [sql`r.organization_id = ${organizationId}`];

      if (query.status) {
        conditions.push(sql`r.status = ${query.status}::app.reservation_status`);
      }
      if (query.productId) conditions.push(sql`r.product_id = ${query.productId}`);
      if (query.warehouseId) conditions.push(sql`r.warehouse_id = ${query.warehouseId}`);

      const where = sql.join(conditions, sql` and `);
      const offset = (query.page - 1) * query.pageSize;

      const totals = resultRows<{ total: number }>(
        await tx.execute(
          sql`select count(*)::int as total from public.stock_reservations r where ${where}`,
        ),
      );

      const rows = resultRows<StockReservationRow>(
        await tx.execute(sql`
          select r.id, r.organization_id, r.product_id, p.sku as product_sku,
                 p.name as product_name, r.warehouse_id, w.code as warehouse_code,
                 r.location_id, l.code as location_code, r.quantity, r.status,
                 r.reference_type, r.reference_id, r.note, r.expires_at, r.created_by,
                 r.created_at, r.released_at
          from public.stock_reservations r
          join public.products p
            on p.id = r.product_id and p.organization_id = r.organization_id
          join public.warehouses w
            on w.id = r.warehouse_id and w.organization_id = r.organization_id
          join public.storage_locations l
            on l.id = r.location_id and l.organization_id = r.organization_id
            and l.warehouse_id = r.warehouse_id
          where ${where}
          order by r.created_at desc, r.id desc
          limit ${query.pageSize} offset ${offset}
        `),
      );

      return stockReservationListResponseSchema.parse({
        items: rows.map((row) => ({
          id: row.id,
          organizationId: row.organization_id,
          productId: row.product_id,
          productSku: row.product_sku,
          productName: row.product_name,
          warehouseId: row.warehouse_id,
          warehouseCode: row.warehouse_code,
          locationId: row.location_id,
          locationCode: row.location_code,
          quantity: toNumber(row.quantity),
          status: reservationStatusSchema.parse(row.status),
          referenceType: stockReferenceTypeSchema.parse(row.reference_type),
          referenceId: row.reference_id,
          note: row.note,
          expiresAt: toNullableIso(row.expires_at),
          createdBy: row.created_by,
          createdAt: toIso(row.created_at),
          releasedAt: toNullableIso(row.released_at),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: totals[0]?.total ?? 0,
      });
    });
  }

  async reconciliation(userId: string, organizationId: string): Promise<StockReconciliationRow[]> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select r.product_id, r.warehouse_id, r.location_id, r.balance_on_hand,
                 r.ledger_on_hand, r.difference, r.movement_count,
                 p.sku as product_sku, p.name as product_name,
                 w.code as warehouse_code, l.code as location_code
          from app.stock_reconciliation(${organizationId}::uuid) r
          join public.products p
            on p.id = r.product_id and p.organization_id = ${organizationId}::uuid
          join public.warehouses w
            on w.id = r.warehouse_id and w.organization_id = ${organizationId}::uuid
          join public.storage_locations l
            on l.id = r.location_id and l.organization_id = ${organizationId}::uuid
            and l.warehouse_id = r.warehouse_id
        `);

        return resultRows<ReconciliationDbRow>(result).map((row) =>
          stockReconciliationRowSchema.parse({
            productId: row.product_id,
            productSku: row.product_sku,
            productName: row.product_name,
            warehouseId: row.warehouse_id,
            warehouseCode: row.warehouse_code,
            locationId: row.location_id,
            locationCode: row.location_code,
            balanceOnHand: toNumber(row.balance_on_hand),
            ledgerOnHand: toNumber(row.ledger_on_hand),
            difference: toNumber(row.difference),
            movementCount: Number(row.movement_count),
          }),
        );
      },
      { roles: ORG_ADMINS },
    );
  }

  async repair(
    userId: string,
    organizationId: string,
    input: StockRepairInput,
  ): Promise<StockRepairRow[]> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const result = await tx.execute(sql`
          select r.product_id, r.warehouse_id, r.location_id, r.previous_on_hand,
                 r.ledger_on_hand, r.repaired,
                 p.sku as product_sku, p.name as product_name,
                 w.code as warehouse_code, l.code as location_code
          from app.repair_stock_balances(${organizationId}::uuid, ${input.dryRun}) r
          join public.products p
            on p.id = r.product_id and p.organization_id = ${organizationId}::uuid
          join public.warehouses w
            on w.id = r.warehouse_id and w.organization_id = ${organizationId}::uuid
          join public.storage_locations l
            on l.id = r.location_id and l.organization_id = ${organizationId}::uuid
            and l.warehouse_id = r.warehouse_id
        `);

        return resultRows<RepairDbRow>(result).map((row) =>
          stockRepairRowSchema.parse({
            productId: row.product_id,
            productSku: row.product_sku,
            productName: row.product_name,
            warehouseId: row.warehouse_id,
            warehouseCode: row.warehouse_code,
            locationId: row.location_id,
            locationCode: row.location_code,
            previousOnHand: toNumber(row.previous_on_hand),
            ledgerOnHand: toNumber(row.ledger_on_hand),
            repaired: row.repaired,
          }),
        );
      },
      { roles: ORG_ADMINS },
    );
  }
}
