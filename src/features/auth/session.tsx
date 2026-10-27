import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useRef, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, type AuthResponse, type LoginRequest, type RegisterRequest } from '../../api/auth';
import { addSessionExpiredListener, apiFetch } from '../../api/client';
import { ApiError } from '../../api/errors';
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

/** While /me cannot be reached (offline, 5xx) the account check is repeated this often. */
export const SESSION_RECHECK_MS = 30_000;

/** The first /me check at startup is given this long; after it the user is let in with the cached data (interim decision). */
export const STARTUP_ME_TIMEOUT_MS = 4_000;

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
  // Bumped whenever the session changes hands, so a check that was started for an old session is ignored.
  const generation = useRef(0);
  // The pending "look at /me again" timer; it belongs to the session of its generation.
  const recheckTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Start a new session epoch and drop any recheck scheduled for the old one. */
  const nextGeneration = useCallback(() => {
    generation.current += 1;
    clearTimeout(recheckTimer.current);
  }, []);

  useEffect(() => {
    let active = true;
    const startGeneration = generation.current;
    const isCurrent = () => active && generation.current === startGeneration;

    /** The session is not valid although the server answered (403 / 404 from /me): end it like a refused refresh. */
    const invalidate = async (): Promise<void> => {
      nextGeneration();
      void wipeCaches(() => queryClient.clear());
      try {
        await apiFetch.resetSession();
        await tokenStore.clear();
      } catch {
        // Keystore failure: the session is over regardless.
      }
      setExpired(true);
      setStatus('signedOut');
    };

    const scheduleRecheck = () => {
      clearTimeout(recheckTimer.current);
      recheckTimer.current = setTimeout(() => void verify(), SESSION_RECHECK_MS);
    };

    /**
     * Ask the server whether the stored account still exists (a deleted account only shows up as 401 here).
     * `startup`: the first check only gets STARTUP_ME_TIMEOUT_MS; past it the user is let in with the cached data and the
     * check goes on in the background (an answer arriving later is still handled below).
     */
    const verify = async (startup = false): Promise<void> => {
      if (!isCurrent()) return;
      const deadline = startup
        ? setTimeout(() => {
            if (!isCurrent()) return;
            setStatus((current) => (current === 'loading' ? 'signedIn' : current));
            scheduleRecheck();
          }, STARTUP_ME_TIMEOUT_MS)
        : undefined;
      try {
        const me = await authApi.me();
        if (!isCurrent()) return;
        // An answer after the deadline makes the scheduled recheck pointless.
        if (startup) clearTimeout(recheckTimer.current);
        queryClient.setQueryData(meQueryKey, me);
        setStatus((current) => (current === 'loading' ? 'signedIn' : current));
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof ApiError) {
          // 401 means the refresh was refused too: the expired listener below already signed out.
          if (error.status === 401) return;
          // A valid /me never answers 403 / 404: the account or the session is gone. (400 / 5xx stay "trouble": retry.)
          if (error.status === 403 || error.status === 404) {
            await invalidate();
            return;
          }
        }
        // Offline or server trouble: let the user into the app with the cached data, but look again soon.
        setStatus((current) => (current === 'loading' ? 'signedIn' : current));
        scheduleRecheck();
      } finally {
        clearTimeout(deadline);
      }
    };

    tokenStore
      .getAccessToken()
      .then((token) => {
        if (!isCurrent()) return;
        if (!token) {
          // signIn/signOut may have finished first: only the initial 'loading' state is ours to replace.
          setStatus((current) => (current === 'loading' ? 'signedOut' : current));
          return;
        }
        return verify(true);
      })
      .catch(() => {
        if (isCurrent()) setStatus((current) => (current === 'loading' ? 'signedOut' : current));
      });
    const unsubscribe = addSessionExpiredListener(() => {
      nextGeneration();
      void wipeCaches(() => queryClient.clear());
      setExpired(true);
      setStatus('signedOut');
    });
    return () => {
      active = false;
      clearTimeout(recheckTimer.current);
      unsubscribe();
    };
  }, [queryClient, nextGeneration]);

  const applyAuth = useCallback(
    async (response: AuthResponse) => {
      // New epoch first: requests and refreshes of the previous session can no longer write or clear tokens.
      nextGeneration();
      await apiFetch.resetSession();
      // The previous user's cache (memory and persisted) must never reach the new user.
      await wipeCaches(() => queryClient.clear());
      await tokenStore.setTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
      queryClient.setQueryData(meQueryKey, response.user);
      setExpired(false);
      setStatus('signedIn');
    },
    [queryClient, nextGeneration],
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
      if (refreshToken) await authApi.logout();
    } catch {
      // Offline, 401/5xx or session already gone: signing out on this device never depends on the server.
    }
    try {
      nextGeneration();
      // Close the epoch before clearing: a refresh still on the wire must not write its tokens back afterwards.
      await apiFetch.resetSession();
      // Caches first: they are wiped and the UI is signed out even if clearing tokens fails.
      await wipeCaches(() => queryClient.clear());
      await tokenStore.clear();
    } finally {
      setExpired(false);
      setStatus('signedOut');
    }
  }, [queryClient, nextGeneration]);

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
