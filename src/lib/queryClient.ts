import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, defaultShouldDehydrateQuery, focusManager, onlineManager } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
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
 * PERF3: what is never persisted (search, activity, insights, sharing...) is also dropped from memory five minutes after
 * the last screen stopped using it, instead of living a whole day: results of a typed search and 150-row activity logs
 * are not worth keeping, and the next visit refetches them anyway (they are never restored from disk).
 */
export const SHORT_LIVED_GC_MS = 5 * 60 * 1000;
for (const root of ['search', 'activity', 'insights', 'sharing', 'oauthPreview', 'filterValidation']) {
  queryClient.setQueryDefaults([root], { gcTime: SHORT_LIVED_GC_MS });
}

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

/** Storage key of the persisted cache. The old key (whole cache, no budget) is only removed, never read. */
export const PERSIST_KEY = 'taskly.queryCache.v2';
export const LEGACY_PERSIST_KEY = 'taskly.queryCache';

/**
 * PERF3: measured on the demo account (2221 tasks) the old persisted cache was 2 364 403 chars in ONE AsyncStorage row
 * (136 queries: every project list with all its pages, search and activity results...). It is read back before ANY query
 * may start (the restoring state), a single Android row cannot be read back above ~2 MB, and the whole database is
 * capped at 6 MB. Now: only the allowlisted queries, the first PERSIST_MAX_PAGES pages of an infinite list, and at most
 * PERSIST_MAX_CHARS characters (UTF-8 worst case 3 bytes per char: still under 2 MB).
 */
export const PERSIST_MAX_CHARS = 600_000;
/** 2 pages = 100 tasks: all of Today / Overdue for a normal user; "load more" fetches the rest. */
export const PERSIST_MAX_PAGES = 2;

const PERSIST_BASE_ROOTS: ReadonlySet<string> = new Set([
  'me',
  'settings',
  'projects',
  'sections',
  'favorites',
  'labels',
  'filters',
  'viewOptions',
  'productivity',
  'locations',
]);

/**
 * 0 = small base data (always kept), 1 = task lists, 2 = one-task caches (detail / subtasks), null = not persisted
 * (search, activity, insights, sharing, comments, templates, workspace members... fetched again when opened).
 */
export function persistTier(queryKey: readonly unknown[]): 0 | 1 | 2 | null {
  const root = String(queryKey[0]);
  if (PERSIST_BASE_ROOTS.has(root)) return 0;
  if (root === 'workspaces') return queryKey[1] === 'list' || queryKey[1] === 'projects' || queryKey[1] === 'folders' ? 0 : null;
  if (root !== 'tasks') return null;
  const kind = queryKey[1];
  if (kind === 'detail' || kind === 'subtasks') return 2;
  return 1;
}

interface InfiniteLike {
  pages: unknown[];
  pageParams: unknown[];
}

function isInfinite(data: unknown): data is InfiniteLike {
  return typeof data === 'object' && data !== null && Array.isArray((data as InfiniteLike).pages) && Array.isArray((data as InfiniteLike).pageParams);
}

/**
 * The persisted client as one JSON string within `maxChars`: queries ordered base data first, then task lists, then
 * one-task caches, the most recently updated first inside a tier; a query that does not fit is left out (smaller ones
 * after it may still fit). Each infinite query keeps its first PERSIST_MAX_PAGES pages. One stringify per query, no copy of the tree.
 */
export function serializePersistedClient(client: PersistedClient, maxChars: number = PERSIST_MAX_CHARS): string {
  const entries = client.clientState.queries
    .map((query) => {
      const tier = persistTier(query.queryKey);
      if (tier === null) return null;
      const data = query.state.data;
      const state =
        isInfinite(data) && data.pages.length > PERSIST_MAX_PAGES
          ? {
              ...query.state,
              data: { ...data, pages: data.pages.slice(0, PERSIST_MAX_PAGES), pageParams: data.pageParams.slice(0, PERSIST_MAX_PAGES) },
            }
          : query.state;
      return { tier, at: query.state.dataUpdatedAt, json: JSON.stringify({ ...query, state }) };
    })
    .filter((entry): entry is { tier: 0 | 1 | 2; at: number; json: string } => entry !== null)
    .sort((a, b) => a.tier - b.tier || b.at - a.at);
  const head = `{"timestamp":${JSON.stringify(client.timestamp)},"buster":${JSON.stringify(client.buster)},"clientState":{"mutations":[],"queries":[`;
  const tail = ']}}';
  let used = head.length + tail.length;
  const kept: string[] = [];
  for (const entry of entries) {
    const cost = entry.json.length + 1;
    if (used + cost > maxChars) continue;
    used += cost;
    kept.push(entry.json);
  }
  return head + kept.join(',') + tail;
}

export function createQueryPersister(
  storage: Parameters<typeof createAsyncStoragePersister>[0]['storage'],
  appState: PersisterAppState = reactNativeAppState,
): Persister {
  const inner = createAsyncStoragePersister({
    storage,
    key: PERSIST_KEY,
    throttleTime: PERSIST_THROTTLE_MS,
    serialize: (client) => serializePersistedClient(client),
  });
  const foreground = createForegroundPersister(inner, appState);
  return {
    ...foreground,
    // Sign-out must also drop a cache the previous app version left under the old key.
    removeClient: async () => {
      await Promise.all([foreground.removeClient(), Promise.resolve(storage?.removeItem(LEGACY_PERSIST_KEY)).catch(() => undefined)]);
    },
  };
}

export const queryPersister = createQueryPersister(AsyncStorage);

/** One-off, after the first screen: frees the disk of the unbudgeted cache an older version wrote. */
export function purgeLegacyQueryCache(): Promise<void> {
  return AsyncStorage.removeItem(LEGACY_PERSIST_KEY).catch(() => undefined);
}

export const persistOptions = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE_MS,
  // A format change discards what an older version wrote instead of restoring a shape the app no longer reads.
  buster: 'perf3-v2',
  dehydrateOptions: {
    // Only query data goes to disk: a mutation must never be restored and replayed on the next start.
    shouldDehydrateMutation: () => false,
    // Success only (the default rule) AND an allowlisted root: see persistTier.
    shouldDehydrateQuery: (query: Query) => defaultShouldDehydrateQuery(query) && persistTier(query.queryKey) !== null,
  },
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
