import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  DeviceEventSummary,
  DeviceListResponse,
  DeviceMoveInput,
  DeviceMoveResult,
  DeviceRegisterInput,
  DeviceRegistrationResult,
  DeviceStatus,
  DeviceStatusChangeInput,
  DeviceStatusChangeResult,
  DeviceSummary,
} from '@mystock/contracts';

import { keepPreviousDataForOrganization } from '@/lib/organization-query-placeholder';
import { useAccessToken } from '@/features/auth/auth-provider';
import { apiRequest, newIdempotencyKey } from '@/lib/api-client';

export interface DeviceFilters {
  search: string;
  status: DeviceStatus | '';
  productId?: string;
  page: number;
  pageSize: number;
}

const organizationKey = (organizationId: string | null) =>
  ['organizations', organizationId ?? ''] as const;

const idempotencyHeaders = () => ({ 'idempotency-key': newIdempotencyKey() });

export function useDevices(organizationId: string | null, filters: DeviceFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'devices', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.status) params.set('status', filters.status);
      if (filters.productId) params.set('productId', filters.productId);

      return apiRequest<DeviceListResponse>(
        `/organizations/${organizationId}/devices?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousDataForOrganization(organizationId),
  });
}

export function useDevice(organizationId: string | null, deviceId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'devices', deviceId],
    queryFn: () =>
      apiRequest<DeviceSummary>(`/organizations/${organizationId}/devices/${deviceId}`, { token }),
    enabled: Boolean(organizationId) && Boolean(deviceId),
  });
}

export function useDeviceEvents(organizationId: string | null, deviceId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'devices', deviceId, 'events'],
    queryFn: () =>
      apiRequest<DeviceEventSummary[]>(
        `/organizations/${organizationId}/devices/${deviceId}/events`,
        { token },
      ),
    enabled: Boolean(organizationId) && Boolean(deviceId),
  });
}

function useDeviceMutation<TInput, TResult>(
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

export function useRegisterDevice(organizationId: string) {
  return useDeviceMutation<DeviceRegisterInput, DeviceRegistrationResult>(
    organizationId,
    (input, token) =>
      apiRequest<DeviceRegistrationResult>(`/organizations/${organizationId}/devices`, {
        method: 'POST',
        token,
        body: input,
        headers: idempotencyHeaders(),
      }),
  );
}

export function useChangeDeviceStatus(organizationId: string, deviceId: string) {
  return useDeviceMutation<DeviceStatusChangeInput, DeviceStatusChangeResult>(
    organizationId,
    (input, token) =>
      apiRequest<DeviceStatusChangeResult>(
        `/organizations/${organizationId}/devices/${deviceId}/status`,
        { method: 'POST', token, body: input, headers: idempotencyHeaders() },
      ),
  );
}

export function useMoveDevice(organizationId: string, deviceId: string) {
  return useDeviceMutation<DeviceMoveInput, DeviceMoveResult>(organizationId, (input, token) =>
    apiRequest<DeviceMoveResult>(`/organizations/${organizationId}/devices/${deviceId}/location`, {
      method: 'POST',
      token,
      body: input,
      headers: idempotencyHeaders(),
    }),
  );
}
