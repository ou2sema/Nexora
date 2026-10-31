import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  InvitationListResponse,
  InvitationRole,
  InvitationSummary,
  MemberRole,
  MembershipSummary,
  PendingInvitationsResponse,
  TeamMemberSummary,
  TeamMembersResponse,
} from '@mystock/contracts';

import { useAccessToken, useAuth } from '@/features/auth/auth-provider';
import { meQueryKey } from '@/features/organizations/api';
import { apiRequest } from '@/lib/api-client';

const teamKey = (organizationId: string) => ['organizations', organizationId, 'team'] as const;

const invitationsKey = (organizationId: string) =>
  ['organizations', organizationId, 'team', 'invitations'] as const;

export const pendingInvitationsKey = ['me', 'invitations'] as const;

export function useTeamMembers(organizationId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...teamKey(organizationId ?? ''), 'members'],
    queryFn: () =>
      apiRequest<TeamMembersResponse>(`/organizations/${organizationId}/members`, { token }),
    enabled: Boolean(organizationId),
  });
}

export function useInvitations(organizationId: string | null, enabled: boolean) {
  const token = useAccessToken();

  return useQuery({
    queryKey: invitationsKey(organizationId ?? ''),
    queryFn: () =>
      apiRequest<InvitationListResponse>(`/organizations/${organizationId}/invitations`, {
        token,
      }),
    enabled: Boolean(organizationId) && enabled,
  });
}

export function usePendingInvitations() {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: [...pendingInvitationsKey, session?.user.id ?? 'anonymous'],
    queryFn: () =>
      apiRequest<PendingInvitationsResponse>('/me/invitations', { token: token as string }),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useChangeMemberRole(organizationId: string) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { userId: string; role: MemberRole }) =>
      apiRequest<TeamMemberSummary>(`/organizations/${organizationId}/members/${input.userId}`, {
        method: 'PATCH',
        token,
        body: { role: input.role },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKey(organizationId) });
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

export function useRemoveMember(organizationId: string) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<void>(`/organizations/${organizationId}/members/${userId}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKey(organizationId) });
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

export function useCreateInvitation(organizationId: string) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; role: InvitationRole }) =>
      apiRequest<InvitationSummary>(`/organizations/${organizationId}/invitations`, {
        method: 'POST',
        token,
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationsKey(organizationId) });
    },
  });
}

export function useRevokeInvitation(organizationId: string) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      apiRequest<InvitationSummary>(
        `/organizations/${organizationId}/invitations/${invitationId}/revocation`,
        { method: 'POST', token },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationsKey(organizationId) });
    },
  });
}

export function useAcceptInvitation() {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      apiRequest<MembershipSummary>(`/me/invitations/${invitationId}/acceptance`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
      void queryClient.invalidateQueries({ queryKey: pendingInvitationsKey });
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}
