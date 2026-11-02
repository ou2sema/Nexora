import { Injectable } from '@nestjs/common';

import {
  type LowStockQuery,
  type LowStockResponse,
  type MovementExportQuery,
  type ReportOverview,
  type ReportOverviewQuery,
  type StockLevelExportQuery,
  type SupplierPerformanceQuery,
  type SupplierPerformanceResponse,
} from '@mystock/contracts';

import { AppError } from '../common/errors/app-error';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantAccessService } from '../tenancy/tenant-access.service';
import { type CsvExport, readMovementExport, readStockLevelExport } from './export.query';
import { readLowStock } from './low-stock.query';
import { type OverviewWindow, readOverview } from './overview.query';
import { readSupplierPerformance } from './supplier-performance.query';

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 30;
const SUPPLIER_WINDOW_DAYS = 90;

function validateOverviewWindow(from: Date, to: Date): void {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
    throw new AppError('validation_error', 'Request validation failed', 400, [
      { path: 'from', message: 'The reporting window must contain valid dates.' },
    ]);
  }
  if (from.getTime() > to.getTime()) {
    throw new AppError('validation_error', 'Request validation failed', 400, [
      { path: 'to', message: 'The start of the window must not be after its end.' },
    ]);
  }
  if (to.getTime() - from.getTime() > 366 * DAY_MS) {
    throw new AppError('validation_error', 'Request validation failed', 400, [
      { path: 'from', message: 'The reporting window cannot exceed 366 days.' },
    ]);
  }
}

/**
 * The reporting surface. Each report's SQL and row mapping live in their own
 * `*.query.ts` module; this service owns the tenant session and the window rules.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly access: TenantAccessService) {}

  async overview(
    userId: string,
    organizationId: string,
    query: ReportOverviewQuery,
  ): Promise<ReportOverview> {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - (DEFAULT_WINDOW_DAYS - 1) * DAY_MS);
    validateOverviewWindow(from, to);

    const window: OverviewWindow = {
      from,
      to,
      fromDate: from.toISOString().slice(0, 10),
      toDate: to.toISOString().slice(0, 10),
    };

    return this.access.runAsMember(userId, organizationId, (tx) =>
      readOverview(tx, organizationId, query, window),
    );
  }

  async lowStock(
    userId: string,
    organizationId: string,
    query: LowStockQuery,
  ): Promise<LowStockResponse> {
    return this.access.runAsMember(userId, organizationId, (tx) =>
      readLowStock(tx, organizationId, query),
    );
  }

  async supplierPerformance(
    userId: string,
    organizationId: string,
    query: SupplierPerformanceQuery,
  ): Promise<SupplierPerformanceResponse> {
    const to = query.to ?? new Date().toISOString().slice(0, 10);
    const from =
      query.from ??
      new Date(Date.parse(`${to}T00:00:00Z`) - (SUPPLIER_WINDOW_DAYS - 1) * DAY_MS)
        .toISOString()
        .slice(0, 10);

    return this.access.runAsMember(userId, organizationId, (tx) =>
      readSupplierPerformance(tx, organizationId, query, { from, to }),
    );
  }

  async exportStockLevels(
    userId: string,
    organizationId: string,
    query: StockLevelExportQuery,
  ): Promise<CsvExport> {
    return this.access.runAsMember(userId, organizationId, (tx) =>
      readStockLevelExport(tx, organizationId, query),
    );
  }

  async exportMovements(
    userId: string,
    organizationId: string,
    query: MovementExportQuery,
  ): Promise<CsvExport> {
    return this.access.runAsMember(userId, organizationId, (tx) =>
      readMovementExport(tx, organizationId, query),
    );
  }
}
