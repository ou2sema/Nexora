import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { LowStockResponse, ReportOverview } from '@mystock/contracts';

import { useAccessToken } from '@/features/auth/auth-provider';
import { apiDownload, apiRequest, type DownloadedFile } from '@/lib/api-client';

export interface ReportFilters {
  warehouseId: string;
  categoryId: string;
  days: number;
}

export interface LowStockFilters {
  warehouseId: string;
  categoryId: string;
  page: number;
  pageSize: number;
}

const organizationKey = (organizationId: string | null) =>
  ['organizations', organizationId ?? ''] as const;

export function useReportOverview(organizationId: string | null, filters: ReportFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'reports', 'overview', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.warehouseId) params.set('warehouseId', filters.warehouseId);
      if (filters.categoryId) params.set('categoryId', filters.categoryId);
      // The API defaults the end of the window to "now", so every refetch keeps
      // the rolling range current.
      params.set('from', new Date(Date.now() - filters.days * 86_400_000).toISOString());

      return apiRequest<ReportOverview>(
        `/organizations/${organizationId}/reports/overview?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

export function useLowStock(organizationId: string | null, filters: LowStockFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'reports', 'low-stock', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.warehouseId) params.set('warehouseId', filters.warehouseId);
      if (filters.categoryId) params.set('categoryId', filters.categoryId);

      return apiRequest<LowStockResponse>(
        `/organizations/${organizationId}/reports/low-stock?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

export function useExportStockLevels(organizationId: string | null) {
  const token = useAccessToken();

  return (filters: Pick<ReportFilters, 'warehouseId' | 'categoryId'>): Promise<DownloadedFile> => {
    const params = new URLSearchParams();
    if (filters.warehouseId) params.set('warehouseId', filters.warehouseId);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    const query = params.toString();

    return apiDownload(
      `/organizations/${organizationId}/reports/exports/stock-levels.csv${query ? `?${query}` : ''}`,
      token,
    );
  };
}

export function useExportMovements(organizationId: string | null) {
  const token = useAccessToken();

  return (
    filters: Pick<ReportFilters, 'warehouseId' | 'categoryId' | 'days'>,
  ): Promise<DownloadedFile> => {
    const params = new URLSearchParams();
    if (filters.warehouseId) params.set('warehouseId', filters.warehouseId);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    params.set('from', new Date(Date.now() - filters.days * 86_400_000).toISOString());

    return apiDownload(
      `/organizations/${organizationId}/reports/exports/movements.csv?${params.toString()}`,
      token,
    );
  };
}
