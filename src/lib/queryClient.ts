import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
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

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'taskly.queryCache',
});

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
