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

// PERF4: readers that keep a copy of the access token (useAuthImageSource) drop it when the tokens change.
const changeListeners = new Set<() => void>();
export function onTokensChanged(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}
const announceChange = () => changeListeners.forEach((listener) => listener());

export const tokenStore: TokenStore = {
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  async setTokens({ accessToken, refreshToken }) {
    // Refresh token first: the backend rotates it (the old one is revoked), so it must never be lost.
    // "new refresh + old access" self-heals on the next 401; the reverse order would log the user out.
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    announceChange();
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    announceChange();
  },
};
