import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const updateSession = (nextSession: Session | null) => {
      if (!active) return;
      const nextUserId = nextSession?.user.id ?? null;
      if (userId.current !== nextUserId) {
        queryClient.clear();
        userId.current = nextUserId;
      }
      setSession(nextSession);
      setInitializing(false);
    };

    void supabase.auth.getSession().then(({ data }) => {
      updateSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      updateSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return { needsConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: initializing ? 'loading' : session ? 'authenticated' : 'anonymous',
      session,
      signIn,
      signUp,
      signOut,
    }),
    [initializing, session, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

export function useAccessToken(): string {
  const { session } = useAuth();
  if (!session) {
    throw new Error('An access token is required for this request');
  }
  return session.access_token;
}
