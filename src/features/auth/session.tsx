import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, type AuthResponse, type LoginRequest, type RegisterRequest } from '../../api/auth';
import { addSessionExpiredListener } from '../../api/client';
import { queryPersister } from '../../lib/queryClient';
import { tokenStore } from '../../lib/tokenStore';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface SessionContextValue {
  status: SessionStatus;
  /** true after the server rejected the refresh token; the login screen shows a notice. */
  expired: boolean;
  signIn(input: LoginRequest): Promise<void>;
  signUp(input: RegisterRequest): Promise<void>;
  signOut(): Promise<void>;
}

export const meQueryKey = ['me'] as const;

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Drop the previous user's data from memory and from the persisted cache. The persister writes
 * with a 1 s throttle, so without removeClient() the old cache could survive an immediate app kill.
 */
async function wipeCaches(clearMemory: () => void): Promise<void> {
  clearMemory();
  try {
    await queryPersister.removeClient();
  } catch {
    // Storage failure must not block signing out.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let active = true;
    tokenStore
      .getAccessToken()
      .then((token) => {
        if (active) setStatus(token ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        if (active) setStatus('signedOut');
      });
    const unsubscribe = addSessionExpiredListener(() => {
      void wipeCaches(() => queryClient.clear());
      setExpired(true);
      setStatus('signedOut');
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient]);

  const applyAuth = useCallback(
    async (response: AuthResponse) => {
      await tokenStore.setTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
      queryClient.setQueryData(meQueryKey, response.user);
      setExpired(false);
      setStatus('signedIn');
    },
    [queryClient],
  );

  const signIn = useCallback(
    async (input: LoginRequest) => applyAuth(await authApi.login(input)),
    [applyAuth],
  );

  const signUp = useCallback(
    async (input: RegisterRequest) => applyAuth(await authApi.register(input)),
    [applyAuth],
  );

  const signOut = useCallback(async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Offline, 401/5xx or session already gone: signing out on this device never depends on the server.
    }
    await tokenStore.clear();
    await wipeCaches(() => queryClient.clear());
    setExpired(false);
    setStatus('signedOut');
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({ status, expired, signIn, signUp, signOut }),
    [status, expired, signIn, signUp, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}

/** Current user (GET /api/v1/me); only runs while signed in. */
export function useMe() {
  const { status } = useSession();
  return useQuery({ queryKey: meQueryKey, queryFn: authApi.me, enabled: status === 'signedIn' });
}
