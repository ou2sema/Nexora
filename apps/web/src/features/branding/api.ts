import { useEffect, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LogoSummary } from '@mystock/contracts';

import { useAccessToken } from '@/features/auth/auth-provider';
import { meQueryKey } from '@/features/organizations/api';
import { ApiError, apiDownload, apiRequest, apiUpload } from '@/lib/api-client';

export function logoQueryKey(organizationId: string, version?: string) {
  return ['organizations', organizationId, 'logo', ...(version ? [version] : [])] as const;
}

/**
 * The mark is served with the member's access token, so the interface renders it from an
 * object URL rather than a public one. A tenant without a logo answers 404, which is the
 * empty state rather than a failure.
 *
 * The upload timestamp is part of both the cache key and the requested URL, so a replaced
 * mark is a new resource instead of a byte the browser was told to hold for a day.
 */
export function useLogoImage(logo: LogoSummary | null): string | null {
  const token = useAccessToken();

  const query = useQuery({
    queryKey: logoQueryKey(logo?.organizationId ?? '', logo?.updatedAt),
    queryFn: async () => {
      if (!logo) return null;
      try {
        const path = `/organizations/${logo.organizationId}/logo?version=${encodeURIComponent(logo.updatedAt)}`;
        return (await apiDownload(path, token)).blob;
      } catch (error) {
        if (error instanceof ApiError && error.code === 'logo_not_found') return null;
        throw error;
      }
    },
    enabled: Boolean(logo),
    retry: false,
    staleTime: Infinity,
  });

  const blob = query.data;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}

function useRefreshLogo(organizationId: string) {
  const queryClient = useQueryClient();

  return () => {
    // The membership summary carries the presence and the timestamp the switcher shows,
    // so both the mark and the summary have to be re-read after any change.
    void queryClient.invalidateQueries({ queryKey: logoQueryKey(organizationId) });
    void queryClient.invalidateQueries({ queryKey: meQueryKey });
  };
}

export function useUploadLogo(organizationId: string) {
  const token = useAccessToken();
  const refresh = useRefreshLogo(organizationId);

  return useMutation({
    mutationFn: async (file: File) =>
      apiUpload<LogoSummary>(`/organizations/${organizationId}/logo`, {
        token,
        contentType: file.type,
        body: await file.arrayBuffer(),
      }),
    onSuccess: refresh,
  });
}

export function useRemoveLogo(organizationId: string) {
  const token = useAccessToken();
  const refresh = useRefreshLogo(organizationId);

  return useMutation({
    mutationFn: () =>
      apiRequest<{ removed: boolean }>(`/organizations/${organizationId}/logo`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: refresh,
  });
}
