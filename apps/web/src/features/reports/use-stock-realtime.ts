import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

const POLL_INTERVAL_MS = 30_000;

/**
 * Subscribes to the tables reports read. Supabase Realtime authorizes every
 * change against the signed-in user's RLS policies, so a subscription cannot
 * deliver rows from another organization. Polling stays on regardless of the
 * socket state: a channel can report SUBSCRIBED while its tables are missing
 * from the publication, and reports must not go stale silently.
 */
export function useStockRealtime(organizationId: string | null): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    if (!organizationId) {
      setStatus('offline');
      return;
    }

    setStatus('connecting');

    const reportKey = ['organizations', organizationId, 'reports'];
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: reportKey });
      }, 400);
    };

    const channel = supabase
      .channel(`stock-reports-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_balances',
          filter: `organization_id=eq.${organizationId}`,
        },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_reservations',
          filter: `organization_id=eq.${organizationId}`,
        },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `organization_id=eq.${organizationId}`,
        },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stock_movements',
          filter: `organization_id=eq.${organizationId}`,
        },
        refresh,
      )
      .subscribe((state) => {
        const next: RealtimeStatus =
          state === 'SUBSCRIBED' ? 'live' : state === 'CLOSED' ? 'offline' : 'connecting';
        setStatus(next);
      });

    const poll = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      clearInterval(poll);
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  return status;
}
