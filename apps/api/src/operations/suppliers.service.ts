import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';

import {
  type SupplierCreateInput,
  type SupplierListQuery,
  type SupplierListResponse,
  type SupplierSummary,
  type SupplierUpdateInput,
  supplierSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
import { suppliers } from '../database/schema';
// The class is a DI token at runtime, so it cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';
import { toIso } from './operations.utils';

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toSupplierSummary(row: typeof suppliers.$inferSelect): SupplierSummary {
  return supplierSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    addressLine: row.addressLine,
    city: row.city,
    countryCode: row.countryCode,
    taxId: row.taxId,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  });
}

@Injectable()
export class SuppliersService {
  constructor(private readonly access: TenantAccessService) {}

  async list(
    userId: string,
    organizationId: string,
    query: SupplierListQuery,
  ): Promise<SupplierListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [eq(suppliers.organizationId, organizationId)];

      if (query.isActive !== undefined) conditions.push(eq(suppliers.isActive, query.isActive));
      if (query.search) {
        const pattern = `%${escapeLike(query.search)}%`;
        const search = or(
          ilike(suppliers.name, pattern),
          ilike(suppliers.contactName, pattern),
          ilike(suppliers.email, pattern),
        );
        if (search) conditions.push(search);
      }

      const where = and(...conditions);
      const offset = (query.page - 1) * query.pageSize;

      const [totals] = await tx.select({ total: count() }).from(suppliers).where(where);

      const rows = await tx
        .select()
        .from(suppliers)
        .where(where)
        .orderBy(sql`lower(${suppliers.name})`, asc(suppliers.id))
        .limit(query.pageSize)
        .offset(offset);

      return {
        items: rows.map(toSupplierSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: totals?.total ?? 0,
      };
    });
  }

  async create(
    userId: string,
    organizationId: string,
    input: SupplierCreateInput,
  ): Promise<SupplierSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const [saved] = resultRows<{ result: { supplierId: string } }>(
          await tx.execute(sql`
            select app.save_supplier(
              ${organizationId}::uuid, null::uuid, ${input.name}, ${input.contactName ?? null},
              ${input.email ?? null}, ${input.phone ?? null}, ${input.addressLine ?? null},
              ${input.city ?? null}, ${input.countryCode ?? null}, ${input.taxId ?? null},
              ${input.notes ?? null}
            ) as result
          `),
        );

        if (!saved?.result?.supplierId) {
          throw new AppError('internal_error', 'Unexpected supplier response.', 500);
        }

        return this.findSupplier(tx, organizationId, saved.result.supplierId);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async update(
    userId: string,
    organizationId: string,
    supplierId: string,
    input: SupplierUpdateInput,
  ): Promise<SupplierSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const current = await this.findSupplier(tx, organizationId, supplierId);
        const merged = {
          name: input.name ?? current.name,
          contactName: input.contactName !== undefined ? input.contactName : current.contactName,
          email: input.email !== undefined ? input.email : current.email,
          phone: input.phone !== undefined ? input.phone : current.phone,
          addressLine: input.addressLine !== undefined ? input.addressLine : current.addressLine,
          city: input.city !== undefined ? input.city : current.city,
          countryCode: input.countryCode !== undefined ? input.countryCode : current.countryCode,
          taxId: input.taxId !== undefined ? input.taxId : current.taxId,
          notes: input.notes !== undefined ? input.notes : current.notes,
        };

        await tx.execute(sql`
          select app.save_supplier(
            ${organizationId}::uuid, ${supplierId}::uuid, ${merged.name},
            ${merged.contactName}, ${merged.email}, ${merged.phone}, ${merged.addressLine},
            ${merged.city}, ${merged.countryCode}, ${merged.taxId}, ${merged.notes}
          ) as result
        `);

        return this.findSupplier(tx, organizationId, supplierId);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async setActive(
    userId: string,
    organizationId: string,
    supplierId: string,
    isActive: boolean,
  ): Promise<SupplierSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        await tx.execute(sql`
          select app.set_supplier_active(
            ${organizationId}::uuid, ${supplierId}::uuid, ${isActive}
          ) as result
        `);

        return this.findSupplier(tx, organizationId, supplierId);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  private async findSupplier(
    tx: AppTransaction,
    organizationId: string,
    supplierId: string,
  ): Promise<SupplierSummary> {
    const [row] = await tx
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.organizationId, organizationId), eq(suppliers.id, supplierId)))
      .limit(1);

    if (!row) throw new AppError('supplier_not_found', 'Supplier not found.', 404);

    return toSupplierSummary(row);
  }
}
