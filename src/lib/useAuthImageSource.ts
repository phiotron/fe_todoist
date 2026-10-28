import { useEffect, useState } from 'react';
import { API_URL } from './config';
import { tokenStore } from './tokenStore';

export interface AuthImageSource {
  uri: string;
  headers: { Authorization: string };
}

/**
 * Image source for an API path that needs the Bearer token (avatar). Returns null until the token is read, and when
 * `path` is null / the user is signed out — the caller then shows its fallback (initials). The url carries `?v=`, so
 * the OS image cache never serves an old picture after a change. A token that expires later only makes the image
 * request fail; <Image onError> falls back to the initials until the next mount.
 */
export function useAuthImageSource(path: string | null | undefined): AuthImageSource | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setToken(null);
      return undefined;
    }
    void tokenStore
      .getAccessToken()
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
