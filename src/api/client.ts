import { API_URL } from '../lib/config';
import { tokenStore, type AuthTokens, type TokenStore } from '../lib/tokenStore';
import { ApiError, NetworkError, problemToApiError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** false = public endpoint (login/register): no Bearer header, no refresh on 401. */
  auth?: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  tokens: TokenStore;
  onSessionExpired: () => void;
}

export type ApiFetch = <T>(path: string, options?: ApiRequestOptions) => Promise<T>;

export const REFRESH_PATH = '/api/v1/auth/refresh';

export function createApiClient(config: ApiClientConfig): ApiFetch {
  let refreshInFlight: Promise<boolean> | null = null;
  let expiring: Promise<void> | null = null;

  async function send(path: string, options: ApiRequestOptions, accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await fetch(`${config.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new NetworkError();
    }
  }

  /** A Response body can be read only once; a connection dropped mid-body is a network failure. */
  async function readText(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      throw new NetworkError();
    }
  }

  async function parse<T>(res: Response): Promise<T> {
    const text = await readText(res);
    if (!res.ok) throw problemToApiError(res.status, res.statusText, text);
    if (!text.trim()) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      // 2xx but not JSON, e.g. a captive-portal HTML page.
      throw new ApiError({ status: res.status, title: 'Invalid response body' });
    }
  }

  /** true = new pair stored; false = refresh token missing or rejected. Throws on network/5xx. */
  async function refreshTokens(): Promise<boolean> {
    const refreshToken = await config.tokens.getRefreshToken();
    if (!refreshToken) return false;
    const res = await send(REFRESH_PATH, { method: 'POST', body: { refreshToken } }, null);
    if (res.status >= 500) throw problemToApiError(res.status, res.statusText, await readText(res));
    if (!res.ok) return false;
    const pair = await parse<AuthTokens | undefined>(res);
    if (typeof pair?.accessToken !== 'string' || typeof pair.refreshToken !== 'string') {
      throw new ApiError({ status: res.status, title: 'Invalid response body' });
    }
    await config.tokens.setTokens({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
    return true;
  }

  /** All callers that hit 401 while a refresh is running share the same promise. */
  function refreshOnce(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = refreshTokens().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  /** Concurrent failures of the same batch clear tokens and notify once; the guard resets afterwards. */
  function expireOnce(): Promise<void> {
    if (!expiring) {
      expiring = (async () => {
        await config.tokens.clear();
        config.onSessionExpired();
      })().finally(() => {
        expiring = null;
      });
    }
    return expiring;
  }

  async function expireSession(): Promise<never> {
    await expireOnce();
    throw new ApiError({ status: 401, title: 'Session expired' });
  }

  return async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const useAuth = options.auth !== false;
    const usedToken = useAuth ? await config.tokens.getAccessToken() : null;
    const first = await send(path, options, usedToken);
    if (first.status !== 401 || !useAuth) return parse<T>(first);

    const current = await config.tokens.getAccessToken();
    const rotatedMeanwhile = current !== null && current !== usedToken;
    const refreshed = rotatedMeanwhile || (await refreshOnce());
    if (!refreshed) return expireSession();

    // The retry is a brand-new request/response; the 401 body is never read again.
    const retry = await send(path, options, await config.tokens.getAccessToken());
    if (retry.status === 401) return expireSession();
    return parse<T>(retry);
  };
}

const sessionExpiredListeners = new Set<() => void>();

/** Subscribe to "refresh failed, user must sign in again". Returns an unsubscribe function. */
export function addSessionExpiredListener(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/** App-wide client: base URL from EXPO_PUBLIC_API_URL, tokens from SecureStore. */
export const apiFetch: ApiFetch = createApiClient({
  baseUrl: API_URL,
  tokens: tokenStore,
  onSessionExpired: () => {
    // Iterate a copy and isolate each subscriber: one bad listener must not block the others or mask the 401.
    [...sessionExpiredListeners].forEach((listener) => {
      try {
        listener();
      } catch {
        // Swallowed on purpose.
      }
    });
  },
});
