import type { AuthTokens, TokenStore } from '../lib/tokenStore';

export function memoryTokenStore(initial: Partial<AuthTokens> = {}): TokenStore {
  let access: string | null = initial.accessToken ?? null;
  let refresh: string | null = initial.refreshToken ?? null;
  return {
    getAccessToken: async () => access,
    getRefreshToken: async () => refresh,
    setTokens: async (tokens) => {
      access = tokens.accessToken;
      refresh = tokens.refreshToken;
    },
    clear: async () => {
      access = null;
      refresh = null;
    },
  };
}
