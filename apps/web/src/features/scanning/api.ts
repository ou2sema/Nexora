import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  BarcodeAssignmentResult,
  ErrorEnvelope,
  LabelRequest,
  ScanResult,
  StockCount,
  StockCountDiscardResult,
  StockCountListResponse,
  StockCountPostResult,
  StockCountRecordInput,
  StockCountRecordResult,
  StockCountStartInput,
  StockCountStartResult,
  StockCountStatus,
} from '@mystock/contracts';

import { useAccessToken } from '@/features/auth/auth-provider';
import { apiRequest, ApiError, newIdempotencyKey } from '@/lib/api-client';
import { env } from '@/lib/env';

const organizationKey = (organizationId: string) => ['organizations', organizationId] as const;

export function scanCode(organizationId: string, token: string, code: string): Promise<ScanResult> {
  const params = new URLSearchParams({ code });
  return apiRequest<ScanResult>(`/organizations/${organizationId}/scan?${params.toString()}`, {
    token,
  });
}

export function useAssignBarcode(organizationId: string) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) =>
      apiRequest<BarcodeAssignmentResult>(
        `/organizations/${organizationId}/products/${productId}/barcode`,
        { method: 'POST', token },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKey(organizationId) }),
  });
}

async function fetchLabelPdf(
  organizationId: string,
  token: string,
  input: LabelRequest,
): Promise<Blob> {
  const response = await fetch(
    `${env.VITE_API_BASE_URL.replace(/\/$/, '')}/organizations/${organizationId}/labels`,
    {
      method: 'POST',
      headers: {
        accept: 'application/pdf',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    let envelope: ErrorEnvelope | undefined;
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      envelope = undefined;
    }
    throw new ApiError(
      response.status,
      envelope?.error.code ?? 'http_error',
      envelope?.error.message ?? 'Labels could not be generated.',
      envelope?.error.details,
      envelope?.error.requestId,
    );
  }

  return response.blob();
}

export function useDownloadLabels(organizationId: string) {
  const token = useAccessToken();

  return useMutation({
    mutationFn: (input: LabelRequest) => fetchLabelPdf(organizationId, token, input),
  });
}

export interface StockCountFilters {
  status: StockCountStatus | '';
  page: number;
  pageSize: number;
}

export function useStockCounts(organizationId: string | null, filters: StockCountFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'stock-counts', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.status) params.set('status', filters.status);

      return apiRequest<StockCountListResponse>(
        `/organizations/${organizationId}/stock-counts?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
  });
}

export function useStockCount(organizationId: string | null, countId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'stock-counts', countId],
    queryFn: () =>
      apiRequest<StockCount>(`/organizations/${organizationId}/stock-counts/${countId}`, {
        token,
      }),
    enabled: Boolean(organizationId && countId),
  });
}

function useCountMutation<TInput, TResult>(
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

export function useStartStockCount(organizationId: string) {
  return useCountMutation<StockCountStartInput, StockCountStartResult>(
    organizationId,
    (input, token) =>
      apiRequest<StockCountStartResult>(`/organizations/${organizationId}/stock-counts`, {
        method: 'POST',
        token,
        body: input,
      }),
  );
}

export function useRecordStockCount(organizationId: string) {
  return useCountMutation<{ countId: string } & StockCountRecordInput, StockCountRecordResult>(
    organizationId,
    ({ countId, ...input }, token) =>
      apiRequest<StockCountRecordResult>(
        `/organizations/${organizationId}/stock-counts/${countId}/lines`,
        { method: 'POST', token, body: input },
      ),
  );
}

export function usePostStockCount(organizationId: string) {
  return useCountMutation<string, StockCountPostResult>(organizationId, (countId, token) =>
    apiRequest<StockCountPostResult>(
      `/organizations/${organizationId}/stock-counts/${countId}/post`,
      { method: 'POST', token, headers: { 'idempotency-key': newIdempotencyKey() } },
    ),
  );
}

export function useDiscardStockCount(organizationId: string) {
  return useCountMutation<string, StockCountDiscardResult>(organizationId, (countId, token) =>
    apiRequest<StockCountDiscardResult>(
      `/organizations/${organizationId}/stock-counts/${countId}/discard`,
      { method: 'POST', token },
    ),
  );
}
