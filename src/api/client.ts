import i18n from '../i18n';
import { API_URL } from '../lib/config';
import { tokenStore, type AuthTokens, type TokenStore } from '../lib/tokenStore';
import { ApiError, NetworkError, TimeoutError, problemToApiError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Builds the body right before each send (first try AND the retry after a refresh). Wins over `body`. */
  getBody?: () => Promise<unknown>;
  /** false = public endpoint (login/register): no Bearer header, no refresh on 401. */
  auth?: boolean;
  /** Sent as the Idempotency-Key header; the retry after a refresh reuses it. */
  idempotencyKey?: string;
  /** M8b: multipart upload (comment file, avatar). Sent as is, without a JSON Content-Type (fetch adds the boundary). */
  formData?: FormData;
  /** M8b: overrides the client timeout for this request (a 100 MB upload cannot finish in 15 s). */
  timeoutMs?: number;
}

export interface ApiClientConfig {
  baseUrl: string;
  tokens: TokenStore;
  onSessionExpired: () => void;
  /** Give up waiting for the response headers after this many ms (default DEFAULT_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Current UI language; sent as Accept-Language so server messages (ProblemDetail) match the app. */
  language?: () => string | null | undefined;
}

export type ApiFetch = <T>(path: string, options?: ApiRequestOptions) => Promise<T>;

export type ApiClient = ApiFetch & {
  /**
   * Starts a new session epoch: requests and refreshes that began earlier can no longer write, clear or use
   * tokens. Resolves once token writes/clears already in progress have settled, so the caller's own
   * setTokens/clear always lands last. Call it before storing a new pair (sign-in) and before clearing (sign-out).
   */
  resetSession(): Promise<void>;
};

export const REFRESH_PATH = '/api/v1/auth/refresh';

/** RN Android (OkHttp) waits forever by default; a dead connection must fail fast with a clear message. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** Title of the ApiError thrown by a request whose session ended while it was in flight. */
export const SESSION_CHANGED = 'Session changed';

export type QueryValue = string | number | boolean | null | undefined;

/** "?a=1&b=x" from the defined, non-empty values; "" when nothing is left. */
export function buildQuery(params: Record<string, QueryValue>): string {
  const parts = Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => {
      const value = entry[1];
      return value !== undefined && value !== null && value !== '';
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  let epoch = 0;
  let refreshInFlight: Promise<boolean> | null = null;
  let expiring: Promise<void> | null = null;
  let tokenWrite: Promise<void> | null = null;

  const sessionChanged = () => new ApiError({ status: 401, title: SESSION_CHANGED });

  async function send(path: string, options: ApiRequestOptions, accessToken: string | null): Promise<Response> {
    const body = options.formData ?? (options.getBody ? await options.getBody() : options.body);
    const headers: Record<string, string> = { Accept: 'application/json' };
    const language = config.language?.();
    if (language) headers['Accept-Language'] = language;
    if (body !== undefined && !options.formData) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      return await fetch(`${config.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: body === undefined ? undefined : options.formData ? options.formData : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw controller.signal.aborted ? new TimeoutError() : new NetworkError();
    } finally {
      clearTimeout(timer);
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

  /**
   * true = new pair stored; false = refresh token missing/rejected, or the session changed meanwhile
   * (the caller checks the epoch). Throws on network/5xx.
   */
  async function refreshTokens(startEpoch: number): Promise<boolean> {
    const refreshToken = await config.tokens.getRefreshToken();
    if (epoch !== startEpoch || !refreshToken) return false;
    const res = await send(REFRESH_PATH, { method: 'POST', body: { refreshToken } }, null);
    // 5xx and 429 (rate limit) are temporary: surface them without ending the session.
    if (res.status >= 500 || res.status === 429) throw problemToApiError(res.status, res.statusText, await readText(res));
    if (!res.ok) return false;
    const pair = await parse<AuthTokens | undefined>(res);
    if (typeof pair?.accessToken !== 'string' || typeof pair.refreshToken !== 'string') {
      throw new ApiError({ status: res.status, title: 'Invalid response body' });
    }
    // A newer session started while the refresh was on the wire: its tokens must win.
    if (epoch !== startEpoch) return false;
    const write = config.tokens.setTokens({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
    tokenWrite = write;
    try {
      await write;
    } finally {
      if (tokenWrite === write) tokenWrite = null;
    }
    return true;
  }

  /** All callers of one epoch that hit 401 while a refresh is running share the same promise. */
  function refreshOnce(): Promise<boolean> {
    if (!refreshInFlight) {
      const startEpoch = epoch;
      const run: Promise<boolean> = refreshTokens(startEpoch).finally(() => {
        if (refreshInFlight === run) refreshInFlight = null;
      });
      refreshInFlight = run;
    }
    return refreshInFlight;
  }

  /** Concurrent failures of one batch clear tokens and notify once; skipped entirely if the session changed. */
  function expireOnce(startEpoch: number): Promise<void> {
    if (!expiring) {
      const run: Promise<void> = (async () => {
        if (epoch !== startEpoch) return;
        try {
          await config.tokens.clear();
        } catch {
          // Keystore failure: the session is over regardless, so the app must still be told.
        } finally {
          if (epoch === startEpoch) config.onSessionExpired();
        }
      })().finally(() => {
        if (expiring === run) expiring = null;
      });
      expiring = run;
    }
    return expiring;
  }

  async function expireSession(startEpoch: number): Promise<never> {
    await expireOnce(startEpoch);
    throw new ApiError({ status: 401, title: 'Session expired' });
  }

  async function resetSession(): Promise<void> {
    epoch += 1;
    refreshInFlight = null;
    const pending = [tokenWrite, expiring].filter((p): p is Promise<void> => p !== null);
    await Promise.allSettled(pending);
  }

  async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const useAuth = options.auth !== false;
    const startEpoch = epoch;
    const usedToken = useAuth ? await config.tokens.getAccessToken() : null;
    const first = await send(path, options, usedToken);
    if (first.status !== 401 || !useAuth) return parse<T>(first);

    // From here on the request may only act for the session it started in.
    if (epoch !== startEpoch) throw sessionChanged();
    const current = await config.tokens.getAccessToken();
    const rotatedMeanwhile = current !== null && current !== usedToken;
    const refreshed = rotatedMeanwhile || (await refreshOnce());
    if (epoch !== startEpoch) throw sessionChanged();
    if (!refreshed) return expireSession(startEpoch);

    const retryToken = await config.tokens.getAccessToken();
    if (epoch !== startEpoch) throw sessionChanged();
    // The retry is a brand-new request/response; the 401 body is never read again.
    const retry = await send(path, options, retryToken);
    if (retry.status === 401) {
      if (epoch !== startEpoch) throw sessionChanged();
      return expireSession(startEpoch);
    }
    return parse<T>(retry);
  }

  return Object.assign(apiFetch, { resetSession });
}

const sessionExpiredListeners = new Set<() => void>();

/** Subscribe to "refresh failed, user must sign in again". Returns an unsubscribe function. */
export function addSessionExpiredListener(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/**
 * M9 hook on the write path: a handled request never reaches the network (it was queued for the sync engine).
 * Installed once by lib/sync/runtime.ts; null (the default, and in every test that does not install one) = no hook.
 */
export type RequestInterceptor = (path: string, options: ApiRequestOptions) => { value: unknown } | null;
let requestInterceptor: RequestInterceptor | null = null;

export function setRequestInterceptor(next: RequestInterceptor | null): void {
  requestInterceptor = next;
}

/** App-wide client WITHOUT the interceptor: base URL from EXPO_PUBLIC_API_URL, tokens from SecureStore. The sync engine sends through this one. */
export const rawApiFetch: ApiClient = createApiClient({
  baseUrl: API_URL,
  tokens: tokenStore,
  language: () => i18n.language,
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

/** PERF: told about every write request (not GET) the app sends, before it goes out — lib/useDataMutation.ts uses it. */
export type WriteObserver = (method: string, path: string, body: unknown) => void;
const writeObservers = new Set<WriteObserver>();

export function addWriteObserver(observer: WriteObserver): () => void {
  writeObservers.add(observer);
  return () => {
    writeObservers.delete(observer);
  };
}

/** App-wide client every screen / hook uses: `rawApiFetch` behind the M9 interceptor. */
export const apiFetch: ApiClient = Object.assign(
  <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const method = options.method ?? 'GET';
    if (method !== 'GET') writeObservers.forEach((observer) => observer(method, path, options.body));
    try {
      const handled = requestInterceptor?.(path, options);
      if (handled) return Promise.resolve(handled.value as T);
    } catch (error) {
      return Promise.reject(error);
    }
    return rawApiFetch<T>(path, options);
  },
  { resetSession: () => rawApiFetch.resetSession() },
);
