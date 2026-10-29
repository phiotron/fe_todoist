import * as SecureStore from 'expo-secure-store';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

// SecureStore keys may only contain alphanumerics, ".", "-" and "_".
export const ACCESS_TOKEN_KEY = 'taskly.accessToken';
export const REFRESH_TOKEN_KEY = 'taskly.refreshToken';

/**
 * PERF3: every API request reads the access token, and each read is a Keystore decrypt (a native call that costs a few
 * ms on a weak phone; a cold start sends ~9 requests and a refetch of every list as many again). The token is
 * written only through this object, so the last value read or written is kept in memory: a read hits the Keystore once
 * per process, a write / clear updates the memory first, a failed read is never remembered.
 */
type Slot = { value: string | null } | null;

export function createTokenStore(): TokenStore {
  let access: Slot = null;
  let refresh: Slot = null;
  let accessRead: Promise<string | null> | null = null;
  return {
    async getAccessToken() {
      if (access) return access.value;
      if (!accessRead) {
        const read: Promise<string | null> = SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
          .then((value) => {
            // A write / clear that landed while the read was running wins over what the read saw.
            if (accessRead === read) access = { value };
            return value;
          })
          .finally(() => {
            if (accessRead === read) accessRead = null;
          });
        accessRead = read;
      }
      return accessRead;
    },
    // The refresh token is read once per refresh (rare): always straight from the Keystore.
    getRefreshToken: async () => (refresh ? refresh.value : SecureStore.getItemAsync(REFRESH_TOKEN_KEY)),
    async setTokens({ accessToken, refreshToken }) {
      accessRead = null;
      access = null; // unknown while the two writes run: a read in between goes to the Keystore
      refresh = null;
      // Refresh token first: the backend rotates it (the old one is revoked), so it must never be lost.
      // "new refresh + old access" self-heals on the next 401; the reverse order would log the user out.
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      access = { value: accessToken };
      refresh = { value: refreshToken };
    },
    async clear() {
      accessRead = null;
      access = null;
      refresh = null;
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      access = { value: null };
      refresh = { value: null };
    },
  };
}

export const tokenStore: TokenStore = createTokenStore();
