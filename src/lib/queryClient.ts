import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { AppState } from 'react-native';
import { ApiError, OfflineError } from '../api/errors';
import { isOnlineState } from './useIsOnline';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** How long the persisted cache in AsyncStorage stays valid (must be <= gcTime). */
export const PERSIST_MAX_AGE_MS = ONE_DAY_MS;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: ONE_DAY_MS,
      staleTime: 30_000,
      retry: shouldRetry,
    },
    // Writes are never queued (spec 5.6): 'always' runs the mutation now — assertOnline rejects it while
    // offline — instead of pausing it until the network returns; retry:false never resends a failed write.
    mutations: { networkMode: 'always', retry: false },
  },
});

/**
 * PERF: each persist JSON-stringifies the WHOLE query cache into AsyncStorage on the JS thread. The default throttle (1 s)
 * meant a write every second while the user worked, on a weak phone that is visible jank.
 */
export const PERSIST_THROTTLE_MS = 5_000;

/** The app state the persister needs (AppState in the app, a fake in tests). */
export interface PersisterAppState {
  current(): string;
  onChange(listener: (state: string) => void): () => void;
}

const reactNativeAppState: PersisterAppState = {
  // Unknown (null) right at start-up = treated as the foreground.
  current: () => AppState.currentState ?? 'active',
  onChange: (listener) => {
    const subscription = AppState.addEventListener('change', listener);
    return () => subscription.remove();
  },
};

/**
 * Writes the cache only while the app is in the foreground: in the background (refetches still landing, the widget...)
 * only the latest snapshot is kept, and written once when the app comes back. What changed in the foreground just
 * before leaving is still written by the throttled persister underneath.
 */
export function createForegroundPersister(inner: Persister, appState: PersisterAppState): Persister {
  let pending: PersistedClient | null = null;
  let unsubscribe: (() => void) | null = null;
  const listen = () => {
    if (unsubscribe) return;
    unsubscribe = appState.onChange((state) => {
      if (state !== 'active' || !pending) return;
      const latest = pending;
      pending = null;
      void Promise.resolve(inner.persistClient(latest)).catch(() => undefined);
    });
  };
  return {
    persistClient: (client) => {
      if (appState.current() === 'active') {
        pending = null;
        return inner.persistClient(client);
      }
      pending = client;
      listen(); // subscribed lazily: only once something waits
      return undefined;
    },
    restoreClient: () => inner.restoreClient(),
    removeClient: () => inner.removeClient(),
  };
}

export function createQueryPersister(
  storage: Parameters<typeof createAsyncStoragePersister>[0]['storage'],
  appState: PersisterAppState = reactNativeAppState,
): Persister {
  const inner = createAsyncStoragePersister({ storage, key: 'taskly.queryCache', throttleTime: PERSIST_THROTTLE_MS });
  return createForegroundPersister(inner, appState);
}

export const queryPersister = createQueryPersister(AsyncStorage);

export const persistOptions = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE_MS,
  // Only query data goes to disk: a mutation must never be restored and replayed on the next start.
  dehydrateOptions: { shouldDehydrateMutation: () => false },
};

/** Call first in every write; throws OfflineError while the device is offline. */
export function assertOnline(): void {
  if (!onlineManager.isOnline()) throw new OfflineError();
}

// Let TanStack Query pause/resume queries with the device connectivity.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(isOnlineState(state))),
);

// 'Window focus' on a phone is the app coming back to the foreground: refetch stale queries then
// (this is also how a deleted/expired account is noticed: the refetch gets 401).
focusManager.setEventListener((handleFocus) => {
  // iOS passes through 'inactive' for Control Center, Face ID and share sheets: not a real leave, so it is ignored.
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'inactive') handleFocus(state === 'active');
  });
  return () => subscription.remove();
});
