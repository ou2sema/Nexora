import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';

import {
  type CustomerCreateInput,
  type CustomerListQuery,
  type CustomerListResponse,
  type CustomerSummary,
  type CustomerUpdateInput,
  customerSchema,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { resultRows } from '../database/results';
import { customers } from '../database/schema';
// The class is a DI token at runtime, so it cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CATALOG_WRITERS, TenantAccessService } from '../tenancy/tenant-access.service';
import { toIso } from './operations.utils';

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toCustomerSummary(row: typeof customers.$inferSelect): CustomerSummary {
  return customerSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    addressLine: row.addressLine,
    city: row.city,
    countryCode: row.countryCode,
    taxId: row.taxId,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  });
}

@Injectable()
export class CustomersService {
  constructor(private readonly access: TenantAccessService) {}

  async list(
    userId: string,
    organizationId: string,
    query: CustomerListQuery,
  ): Promise<CustomerListResponse> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const conditions: SQL[] = [eq(customers.organizationId, organizationId)];

      if (query.isActive !== undefined) conditions.push(eq(customers.isActive, query.isActive));
      if (query.search) {
        const pattern = `%${escapeLike(query.search)}%`;
        const search = or(ilike(customers.name, pattern), ilike(customers.email, pattern));
        if (search) conditions.push(search);
      }

      const where = and(...conditions);
      const offset = (query.page - 1) * query.pageSize;

      const [totals] = await tx.select({ total: count() }).from(customers).where(where);

      const rows = await tx
        .select()
        .from(customers)
        .where(where)
        .orderBy(sql`lower(${customers.name})`, asc(customers.id))
        .limit(query.pageSize)
        .offset(offset);

      return {
        items: rows.map(toCustomerSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: totals?.total ?? 0,
      };
    });
  }

  async create(
    userId: string,
    organizationId: string,
    input: CustomerCreateInput,
  ): Promise<CustomerSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const [saved] = resultRows<{ result: { customerId: string } }>(
          await tx.execute(sql`
            select app.save_customer(
              ${organizationId}::uuid, null::uuid, ${input.name}, ${input.email ?? null},
              ${input.phone ?? null}, ${input.addressLine ?? null}, ${input.city ?? null},
              ${input.countryCode ?? null}, ${input.taxId ?? null}
            ) as result
          `),
        );

        if (!saved?.result?.customerId) {
          throw new AppError('internal_error', 'Unexpected customer response.', 500);
        }

        return this.findCustomer(tx, organizationId, saved.result.customerId);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async update(
    userId: string,
    organizationId: string,
    customerId: string,
    input: CustomerUpdateInput,
  ): Promise<CustomerSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        const current = await this.findCustomer(tx, organizationId, customerId);
        const merged = {
          name: input.name ?? current.name,
          email: input.email !== undefined ? input.email : current.email,
          phone: input.phone !== undefined ? input.phone : current.phone,
          addressLine: input.addressLine !== undefined ? input.addressLine : current.addressLine,
          city: input.city !== undefined ? input.city : current.city,
          countryCode: input.countryCode !== undefined ? input.countryCode : current.countryCode,
          taxId: input.taxId !== undefined ? input.taxId : current.taxId,
        };

        await tx.execute(sql`
          select app.save_customer(
            ${organizationId}::uuid, ${customerId}::uuid, ${merged.name}, ${merged.email},
            ${merged.phone}, ${merged.addressLine}, ${merged.city}, ${merged.countryCode},
            ${merged.taxId}
          ) as result
        `);

        return this.findCustomer(tx, organizationId, customerId);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  async setActive(
    userId: string,
    organizationId: string,
    customerId: string,
    isActive: boolean,
  ): Promise<CustomerSummary> {
    return this.access.runAsMember(
      userId,
      organizationId,
      async (tx) => {
        await tx.execute(sql`
          select app.set_customer_active(
            ${organizationId}::uuid, ${customerId}::uuid, ${isActive}
          ) as result
        `);

        return this.findCustomer(tx, organizationId, customerId);
      },
      { roles: CATALOG_WRITERS },
    );
  }

  private async findCustomer(
    tx: AppTransaction,
    organizationId: string,
    customerId: string,
  ): Promise<CustomerSummary> {
    const [row] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.organizationId, organizationId), eq(customers.id, customerId)))
      .limit(1);

    if (!row) throw new AppError('customer_not_found', 'Customer not found.', 404);

    return toCustomerSummary(row);
  }
}
