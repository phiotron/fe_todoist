import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { ApiError } from '../api/errors';
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
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'taskly.queryCache',
});

// Let TanStack Query pause/resume queries with the device connectivity.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(isOnlineState(state))),
);
