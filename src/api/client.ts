import type { TokenStore } from '../lib/tokenStore';
import { NetworkError, problemToApiError } from './errors';

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

export function createApiClient(config: ApiClientConfig): ApiFetch {
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

  async function parse<T>(res: Response): Promise<T> {
    const text = await res.text();
    if (!res.ok) throw problemToApiError(res.status, res.statusText, text);
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const useAuth = options.auth !== false;
    const accessToken = useAuth ? await config.tokens.getAccessToken() : null;
    return parse<T>(await send(path, options, accessToken));
  };
}
