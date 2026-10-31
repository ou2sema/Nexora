import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import type { MembershipSummary } from '@mystock/contracts';

import { useMe } from './api';

const STORAGE_KEY = 'mystock.organization';

interface OrganizationContextValue {
  memberships: MembershipSummary[];
  organization: MembershipSummary | null;
  platformAdmin: boolean;
  selectOrganization(id: string): void;
  isPending: boolean;
  error: Error | null;
  refetch(): void;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const memberships = useMemo(() => me.data?.memberships ?? [], [me.data]);

  useEffect(() => {
    if (me.isPending) return;

    if (memberships.length === 0) {
      if (selectedId) {
        setSelectedId(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Storage can be unavailable in private modes; selection is optional.
        }
      }
      return;
    }

    if (!selectedId || !memberships.some((item) => item.organizationId === selectedId)) {
      const fallback = memberships[0]?.organizationId ?? null;
      setSelectedId(fallback);
      if (fallback) {
        try {
          localStorage.setItem(STORAGE_KEY, fallback);
        } catch {
          // Ignore storage failures; the in-memory selection still works.
        }
      }
    }
  }, [memberships, selectedId, me.isPending]);

  const value = useMemo<OrganizationContextValue>(() => {
    const organization = memberships.find((item) => item.organizationId === selectedId) ?? null;

    return {
      memberships,
      organization,
      platformAdmin: me.data?.user.platformAdmin === true,
      selectOrganization: (id: string) => {
        setSelectedId(id);
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch {
          // Ignore storage failures; the in-memory selection still works.
        }
      },
      isPending: me.isPending,
      error: me.error instanceof Error ? me.error : null,
      refetch: () => {
        void me.refetch();
      },
    };
  }, [memberships, selectedId, me]);

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used inside OrganizationProvider');
  }
  return context;
}
