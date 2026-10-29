import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateOrganizationInput, MeResponse, OrganizationSummary } from '@mystock/contracts';

import { useAccessToken, useAuth } from '@/features/auth/auth-provider';
import { apiRequest } from '@/lib/api-client';

export const meQueryKey = ['me'] as const;

export function useMe() {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: [...meQueryKey, session?.user.id ?? 'anonymous'],
    queryFn: () => apiRequest<MeResponse>('/me', { token: token as string }),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });
}

export function useCreateOrganization() {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      apiRequest<OrganizationSummary>('/organizations', {
        method: 'POST',
        token,
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meQueryKey }),
  });
}
