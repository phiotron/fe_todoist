import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authApi, type AuthResponse, type LoginRequest, type RegisterRequest } from '../../api/auth';
import { addSessionExpiredListener, apiFetch } from '../../api/client';
import { ApiError } from '../../api/errors';
import { identitiesApi, socialAuthApi, type SocialProvider } from '../../api/identities';
import { twoFactorApi } from '../../api/twoFactor';
import { queryPersister } from '../../lib/queryClient';
import { clearSyncData } from '../../lib/sync/runtime';
import { confirmDiscardUnsynced } from '../sync/confirmDiscard';
import { tokenStore } from '../../lib/tokenStore';
import {
  TwoFactorExpiredError,
  TwoFactorMissingError,
  isChallengeExpired,
  isChallengeSpent,
  twoFactorTokenOf,
} from '../two-factor/twoFactorToken';
import { cancelAllReminders } from '../reminders/platform';
import { unregisterPushTokenOnSignOut } from '../push/registerPushToken';
import { linkTokenOf } from './googleErrors';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export type SignInOutcome = 'signedIn' | 'twoFactorRequired';

/** A 409 link-required answer waiting for the user to prove the password (and the 2FA code). Lives in memory only. */
export interface PendingGoogleLink {
  linkToken: string;
  /** Google email, used to prefill the login form. */
  email: string | null;
  /** M13b: set only for Apple / Facebook (a Google link carries no provider, as before). */
  provider?: SocialProvider;
}

/** 'twoFactorRequired': the M3 two-factor step now holds the token; navigate to /two-factor. */
export type GoogleSignInOutcome = 'signedIn' | 'linkRequired' | 'twoFactorRequired';

/** `provider` is present only when the finished link was Apple / Facebook (M13b). */
export type GoogleLinkOutcome =
  | { type: 'none' }
  | { type: 'linked'; provider?: SocialProvider }
  | { type: 'failed'; error: unknown; provider?: SocialProvider };

export interface SocialSignInInput {
  provider: SocialProvider;
  /** idToken (Apple) or accessToken (Facebook) from the deep link. */
  token: string;
  /** Apple hands the name over only on the first consent. */
  displayName?: string | null;
}

export interface SessionContextValue {
  status: SessionStatus;
  /** true after the server rejected the refresh token; the login screen shows a notice. */
  expired: boolean;
  signIn(input: LoginRequest): Promise<SignInOutcome>;
  signUp(input: RegisterRequest): Promise<void>;
  signOut(): Promise<void>;
  /** true after a sign-in answered 401 two-factor-required and the code has not been entered yet. */
  pendingTwoFactor: boolean;
  /**
   * Completes that sign-in with a 6-digit code or a recovery code (spec 12.1). One request per press (a second call
   * while it is in flight shares it). A wrong code (401 two-factor-code-invalid), 400, 429, 5xx and a lost connection keep
   * the challenge so the code can be entered again; only 401 two-factor-token-invalid (or 5 minutes at the device) ends it.
   */
  verifyTwoFactor(code: string): Promise<void>;
  /** Forgets the pending two-factor sign-in (user went back). */
  cancelTwoFactor(): void;
  /** Signs this device out without calling the server (account deleted, logged out of every device). */
  endLocalSession(): Promise<void>;
  /** Set after POST auth/google answered 409 link-required; cleared on use, cancel and sign-out. */
  pendingGoogleLink: PendingGoogleLink | null;
  /**
   * Throws the API error for every failure except 409 link-required ('linkRequired') and
   * 401 two-factor-required ('twoFactorRequired').
   */
  signInWithGoogle(input: { idToken: string; email: string | null }): Promise<GoogleSignInOutcome>;
  /** M13b: the same three outcomes as signInWithGoogle, for Apple / Facebook (POST auth/apple | auth/facebook). */
  signInWithSocial(input: SocialSignInInput): Promise<GoogleSignInOutcome>;
  cancelGoogleLink(): void;
  /** Call once the user is fully signed in (password, plus the 2FA code when asked). Never throws. */
  completeGoogleLink(): Promise<GoogleLinkOutcome>;
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
  // The previous user's reminders must never fire after sign-out / session end / another sign-in (spec 5.8).
  await cancelAllReminders();
  try {
    // M9: the previous user's unsynced changes must never be sent under the next session.
    await clearSyncData();
  } catch {
    // Storage failure must not block signing out.
  }
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
  const [pendingGoogleLink, setPendingGoogleLinkState] = useState<PendingGoogleLink | null>(null);
  // Mirrored in a ref: completeGoogleLink runs right after signIn / verifyTwoFactor, before the caller re-renders.
  const pendingLinkRef = useRef<PendingGoogleLink | null>(null);
  const setPendingGoogleLink = useCallback((next: PendingGoogleLink | null) => {
    pendingLinkRef.current = next;
    setPendingGoogleLinkState(next);
  }, []);
  // Bumped whenever the session changes hands, so a check that was started for an old session is ignored.
  const generation = useRef(0);
  // The pending "look at /me again" timer; it belongs to the session of its generation.
  const recheckTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Start a new session epoch and drop any recheck scheduled for the old one. */
  const nextGeneration = useCallback(() => {
    generation.current += 1;
    clearTimeout(recheckTimer.current);
  }, []);
  const [pendingTwoFactor, setPendingTwoFactor] = useState(false);
  // Memory only: a short-lived single-use secret, never written to disk, put in a route param or logged.
  // `pending` is the verify request in flight: a second call shares it instead of sending the token twice.
  const challengeRef = useRef<{ token: string; startedAt: number; pending: Promise<void> | null } | null>(null);

  const clearTwoFactor = useCallback(() => {
    challengeRef.current = null;
    setPendingTwoFactor(false);
  }, []);

  const beginTwoFactor = useCallback((token: string) => {
    challengeRef.current = { token, startedAt: Date.now(), pending: null };
    setPendingTwoFactor(true);
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
      clearTwoFactor();
      setExpired(false);
      setStatus('signedIn');
    },
    [queryClient, nextGeneration, clearTwoFactor],
  );

  const signIn = useCallback(
    async (input: LoginRequest): Promise<SignInOutcome> => {
      try {
        await applyAuth(await authApi.login(input));
        return 'signedIn';
      } catch (error) {
        const token = twoFactorTokenOf(error);
        if (token === null) throw error;
        beginTwoFactor(token);
        return 'twoFactorRequired';
      }
    },
    [applyAuth, beginTwoFactor],
  );

  const signUp = useCallback(
    async (input: RegisterRequest) => {
      const response = await authApi.register(input);
      // A link waiting since "link-required" belongs to another account's email: a new account must not inherit it.
      setPendingGoogleLink(null);
      await applyAuth(response);
    },
    [applyAuth, setPendingGoogleLink],
  );

  /** Shared by Google, Apple and Facebook: 200 signs in, 409 link-required keeps the link, 401 two-factor-required starts M3's step. */
  const externalSignIn = useCallback(
    async (
      request: () => Promise<AuthResponse>,
      email: string | null,
      provider?: SocialProvider,
    ): Promise<GoogleSignInOutcome> => {
      let response: AuthResponse;
      try {
        response = await request();
      } catch (error) {
        const linkToken = linkTokenOf(error);
        if (linkToken !== null) {
          // Never linked automatically: the user must sign in with the existing password first (spec 12.1).
          setPendingGoogleLink(provider ? { linkToken, email, provider } : { linkToken, email });
          return 'linkRequired';
        }
        const twoFactorToken = twoFactorTokenOf(error);
        if (twoFactorToken !== null) {
          // A linked Google account with 2FA on: same second step as a password sign-in (M3).
          setPendingGoogleLink(null);
          beginTwoFactor(twoFactorToken);
          return 'twoFactorRequired';
        }
        throw error;
      }
      setPendingGoogleLink(null);
      await applyAuth(response);
      return 'signedIn';
    },
    [applyAuth, beginTwoFactor, setPendingGoogleLink],
  );

  const signInWithGoogle = useCallback(
    ({ idToken, email }: { idToken: string; email: string | null }) =>
      externalSignIn(() => authApi.google({ idToken }), email),
    [externalSignIn],
  );

  const signInWithSocial = useCallback(
    ({ provider, token, displayName }: SocialSignInInput) =>
      externalSignIn(() => socialAuthApi.signIn(provider, { token, displayName }), null, provider),
    [externalSignIn],
  );

  const cancelGoogleLink = useCallback(() => setPendingGoogleLink(null), [setPendingGoogleLink]);

  const completeGoogleLink = useCallback(async (): Promise<GoogleLinkOutcome> => {
    const pending = pendingLinkRef.current;
    if (!pending) return { type: 'none' };
    // A link token is single-use: drop it whatever the server answers.
    setPendingGoogleLink(null);
    const provider = pending.provider;
    try {
      if (provider) await identitiesApi.linkSocial(provider, { linkToken: pending.linkToken });
      else await identitiesApi.linkGoogle({ linkToken: pending.linkToken });
    } catch (error) {
      return provider ? { type: 'failed', error, provider } : { type: 'failed', error };
    }
    await queryClient.invalidateQueries({ queryKey: meQueryKey });
    return provider ? { type: 'linked', provider } : { type: 'linked' };
  }, [queryClient, setPendingGoogleLink]);

  const verifyTwoFactor = useCallback(
    async (code: string) => {
      const challenge = challengeRef.current;
      if (!challenge) throw new TwoFactorMissingError();
      if (isChallengeExpired(challenge.startedAt, Date.now())) {
        clearTwoFactor();
        throw new TwoFactorExpiredError();
      }
      // One request per press: a call made while it is in flight shares it (the token is burnt only by a successful verify).
      if (challenge.pending) return challenge.pending;
      const attempt = (async () => {
        const response = await twoFactorApi
          .verify({ twoFactorToken: challenge.token, code })
          .catch((error: unknown) => {
            // 401 two-factor-token-invalid = expired / unknown / already used: sign in again for a new token.
            // 401 two-factor-code-invalid (wrong code), 400, 429, 5xx and no connection leave the token alive: the
            // challenge stays so the user can enter the code again.
            if (isChallengeSpent(error)) clearTwoFactor();
            throw error;
          });
        clearTwoFactor(); // verified: the server burnt the token, so it is never sent again
        await applyAuth(response);
      })();
      challenge.pending = attempt;
      try {
        await attempt;
      } finally {
        challenge.pending = null;
      }
    },
    [applyAuth, clearTwoFactor],
  );

  const endLocalSession = useCallback(async () => {
    clearTwoFactor();
    setPendingGoogleLink(null);
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
  }, [clearTwoFactor, setPendingGoogleLink, queryClient, nextGeneration]);

  const signOut = useCallback(async () => {
    // M9: signing out loses changes that are not on the server yet — the user must agree first.
    if (!(await confirmDiscardUnsynced())) return;
    // M13c F6: sent first (still with this session), never awaited: signing out never waits for it.
    void unregisterPushTokenOnSignOut();
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (refreshToken) await authApi.logout();
    } catch {
      // Offline, 401/5xx or session already gone: signing out on this device never depends on the server.
    }
    await endLocalSession();
  }, [endLocalSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      expired,
      signIn,
      signUp,
      signOut,
      pendingTwoFactor,
      verifyTwoFactor,
      cancelTwoFactor: clearTwoFactor,
      endLocalSession,
      pendingGoogleLink,
      signInWithGoogle,
      signInWithSocial,
      cancelGoogleLink,
      completeGoogleLink,
    }),
    [
      status,
      expired,
      signIn,
      signUp,
      signOut,
      pendingTwoFactor,
      verifyTwoFactor,
      clearTwoFactor,
      endLocalSession,
      pendingGoogleLink,
      signInWithGoogle,
      signInWithSocial,
      cancelGoogleLink,
      completeGoogleLink,
    ],
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
