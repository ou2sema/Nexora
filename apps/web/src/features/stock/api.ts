import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ReservationStatus,
  StockLevelListResponse,
  StockMovementListResponse,
  StockMovementType,
  StockPostingInput,
  StockPostingResult,
  StockReconciliationRow,
  StockRepairRow,
  StockReservationCreateInput,
  StockReservationListResponse,
  StockReservationReleaseResult,
  StockReservationResult,
  StockSummary,
  StockTransferInput,
  StockTransferResult,
} from '@mystock/contracts';

import { useAccessToken } from '@/features/auth/auth-provider';
import { apiRequest, newIdempotencyKey } from '@/lib/api-client';

export interface StockLevelFilters {
  search: string;
  warehouseId: string;
  page: number;
  pageSize: number;
}

export interface StockMovementFilters {
  movementType: StockMovementType | '';
  warehouseId: string;
  page: number;
  pageSize: number;
}

export interface StockReservationFilters {
  status: ReservationStatus | '';
  page: number;
  pageSize: number;
}

const organizationKey = (organizationId: string | null) =>
  ['organizations', organizationId ?? ''] as const;

const idempotencyHeaders = () => ({ 'idempotency-key': newIdempotencyKey() });

export function useStockLevels(organizationId: string | null, filters: StockLevelFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'stock-levels', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.warehouseId) params.set('warehouseId', filters.warehouseId);

      return apiRequest<StockLevelListResponse>(
        `/organizations/${organizationId}/stock-levels?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

export function useStockSummary(organizationId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'stock-levels', 'summary'],
    queryFn: () =>
      apiRequest<StockSummary>(`/organizations/${organizationId}/stock-levels/summary`, { token }),
    enabled: Boolean(organizationId),
  });
}

export function useStockMovements(organizationId: string | null, filters: StockMovementFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'stock-movements', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.movementType) params.set('movementType', filters.movementType);
      if (filters.warehouseId) params.set('warehouseId', filters.warehouseId);

      return apiRequest<StockMovementListResponse>(
        `/organizations/${organizationId}/stock-movements?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

export function useStockReservations(
  organizationId: string | null,
  filters: StockReservationFilters,
  enabled = true,
) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'stock-reservations', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.status) params.set('status', filters.status);

      return apiRequest<StockReservationListResponse>(
        `/organizations/${organizationId}/stock-reservations?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId) && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useStockReconciliation(organizationId: string | null, enabled: boolean) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'stock-reconciliation'],
    queryFn: () =>
      apiRequest<StockReconciliationRow[]>(
        `/organizations/${organizationId}/stock-reconciliation`,
        { token },
      ),
    enabled: Boolean(organizationId) && enabled,
  });
}

function useInvalidatingMutation<TInput, TResult>(
  organizationId: string,
  request: (input: TInput, token: string) => Promise<TResult>,
) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) => request(input, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKey(organizationId) }),
  });
}

export function usePostStockMovement(organizationId: string) {
  return useInvalidatingMutation<StockPostingInput, StockPostingResult>(
    organizationId,
    (input, token) =>
      apiRequest<StockPostingResult>(`/organizations/${organizationId}/stock-movements`, {
        method: 'POST',
        token,
        body: input,
        headers: idempotencyHeaders(),
      }),
  );
}

export function useStockTransfer(organizationId: string) {
  return useInvalidatingMutation<StockTransferInput, StockTransferResult>(
    organizationId,
    (input, token) =>
      apiRequest<StockTransferResult>(`/organizations/${organizationId}/stock-transfers`, {
        method: 'POST',
        token,
        body: input,
        headers: idempotencyHeaders(),
      }),
  );
}

export function useReserveStock(organizationId: string) {
  return useInvalidatingMutation<StockReservationCreateInput, StockReservationResult>(
    organizationId,
    (input, token) =>
      apiRequest<StockReservationResult>(`/organizations/${organizationId}/stock-reservations`, {
        method: 'POST',
        token,
        body: input,
        headers: idempotencyHeaders(),
      }),
  );
}

export function useReleaseReservation(organizationId: string) {
  return useInvalidatingMutation<string, StockReservationReleaseResult>(
    organizationId,
    (reservationId, token) =>
      apiRequest<StockReservationReleaseResult>(
        `/organizations/${organizationId}/stock-reservations/${reservationId}/release`,
        { method: 'POST', token, headers: idempotencyHeaders() },
      ),
  );
}

export function useRepairStockBalances(organizationId: string) {
  return useInvalidatingMutation<boolean, StockRepairRow[]>(organizationId, (dryRun, token) =>
    apiRequest<StockRepairRow[]>(`/organizations/${organizationId}/stock-reconciliation/repair`, {
      method: 'POST',
      token,
      body: { dryRun },
      headers: idempotencyHeaders(),
    }),
  );
}
