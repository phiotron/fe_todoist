import { useEffect, useState } from 'react';
import { API_URL } from './config';
import { onTokensChanged, tokenStore } from './tokenStore';

export interface AuthImageSource {
  uri: string;
  headers: { Authorization: string };
}

/**
 * PERF4: every avatar used to ask the keychain (SecureStore = a native Keystore round trip) for the token when it
 * mounted, then setState: 200 avatars of a notification list = 200 reads + 200 extra renders. The token is now read
 * once (one shared in-flight read) and kept for TOKEN_TTL_MS; an avatar mounted inside that window has the token in
 * its first render. A token that changed meanwhile only makes the image request fail; <Image onError> falls back to the
 * initials until the next mount.
 */
const TOKEN_TTL_MS = 60_000;
let cached: { token: string | null; at: number } | null = null;
let inFlight: Promise<string | null> | null = null;

function freshToken(): string | null | undefined {
  return cached && Date.now() - cached.at < TOKEN_TTL_MS ? cached.token : undefined;
}

function readToken(): Promise<string | null> {
  if (!inFlight) {
    inFlight = tokenStore
      .getAccessToken()
      .then((token) => {
        cached = { token, at: Date.now() };
        return token;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

onTokensChanged(() => resetAuthImageTokenCache());

/** Forget the cached token (tokens changed; tests). */
export function resetAuthImageTokenCache(): void {
  cached = null;
  inFlight = null;
}

/**
 * Image source for an API path that needs the Bearer token (avatar). Returns null until the token is read, and when
 * `path` is null / the user is signed out — the caller then shows its fallback (initials). The url carries `?v=`, so
 * the OS image cache never serves an old picture after a change.
 */
export function useAuthImageSource(path: string | null | undefined): AuthImageSource | null {
  const [token, setToken] = useState<string | null>(() => (path ? (freshToken() ?? null) : null));
  useEffect(() => {
    let alive = true;
    if (!path) {
      setToken(null);
      return undefined;
    }
    const known = freshToken();
    if (known !== undefined) {
      setToken(known); // same value as the first render: React bails out, no extra render
      return undefined;
    }
    readToken()
      .then((value) => {
        if (alive) setToken(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path || !token) return null;
  return { uri: `${API_URL}${path}`, headers: { Authorization: `Bearer ${token}` } };
}
