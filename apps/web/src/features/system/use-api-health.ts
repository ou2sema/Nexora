import { useQuery } from '@tanstack/react-query';

import { apiOrigin } from '@/lib/env';

export interface ApiHealth {
  status: 'ok';
  service: string;
  uptimeSeconds: number;
  timestamp: string;
}

export function useApiHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: async (): Promise<ApiHealth> => {
      const response = await fetch(`${apiOrigin}/health`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      return (await response.json()) as ApiHealth;
    },
    refetchInterval: 30_000,
    retry: 0,
  });
}
