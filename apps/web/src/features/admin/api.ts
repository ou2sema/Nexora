import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AdminAuditResponse,
  AdminOrganizationsResponse,
  InvitationRole,
  InvitationSummary,
} from '@mystock/contracts';

import { useAccessToken } from '@/features/auth/auth-provider';
import { apiRequest } from '@/lib/api-client';

export const adminOrganizationsKey = ['admin', 'organizations'] as const;
export const adminAuditKey = ['admin', 'audit'] as const;

export function useAdminOrganizations() {
  const token = useAccessToken();

  return useQuery({
    queryKey: adminOrganizationsKey,
    queryFn: () => apiRequest<AdminOrganizationsResponse>('/admin/organizations', { token }),
  });
}

export function useAdminAudit() {
  const token = useAccessToken();

  return useQuery({
    queryKey: adminAuditKey,
    queryFn: () => apiRequest<AdminAuditResponse>('/admin/audit', { token }),
  });
}

export function useAdminInviteMember() {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { organizationId: string; email: string; role: InvitationRole }) =>
      apiRequest<InvitationSummary>(`/organizations/${input.organizationId}/invitations`, {
        method: 'POST',
        token,
        body: { email: input.email, role: input.role },
      }),
    onSuccess: (_invitation, input) => {
      void queryClient.invalidateQueries({ queryKey: adminOrganizationsKey });
      void queryClient.invalidateQueries({ queryKey: adminAuditKey });
      void queryClient.invalidateQueries({
        queryKey: ['organizations', input.organizationId, 'team'],
      });
    },
  });
}
