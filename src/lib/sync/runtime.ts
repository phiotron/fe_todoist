import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { rawApiFetch, setRequestInterceptor } from '../../api/client';
import { invalidateData } from '../../api/queryKeys';
import { requestReminderSync } from '../../features/reminders/syncSignal';
import { queryClient } from '../queryClient';
import { isOnlineState, setOfflineWritesEnabled } from '../useIsOnline';
import { newUuid } from '../uuid';
import { createSyncEngine } from './engine';
import { createWriteInterceptor } from './interceptor';
import { createCommandQueue } from './queue';
import type { SyncRequest, SyncResponse, SyncStatus } from './types';

/**
 * Wiring of M9 for the running app (plan F5): ONE queue on AsyncStorage, ONE engine, the interceptor installed into
 * api/client.ts while signed in. The pure pieces live next to this file and are tested without React Native.
 */

let connected = true;

export const syncQueue = createCommandQueue(AsyncStorage, newUuid);

export const syncEngine = createSyncEngine({
  queue: syncQueue,
  storage: AsyncStorage,
  send: (request: SyncRequest) => rawApiFetch<SyncResponse>('/api/v1/sync', { method: 'POST', body: request }),
  isOnline: () => connected,
  onServerChanged: () => {
    void invalidateData(queryClient);
    // Reminders / due dates written offline only count once the server has them: refresh the device schedule now.
    requestReminderSync();
  },
});

const interceptor = createWriteInterceptor({
  queue: syncQueue,
  queryClient,
  isConnected: () => connected,
  newId: newUuid,
  now: () => new Date(),
  trigger: () => void syncEngine.run(),
});

/** Number of changes that are not on the server yet. */
export function pendingSyncCount(): number {
  return syncQueue.size();
}

/**
 * Turns the offline queue on (signed-in layout mounts it): loads the queue from disk, hooks the write path, sends when
 * the connection (re)appears and when the app returns to the foreground. Returns the stop function.
 */
export function startSync(): () => void {
  setRequestInterceptor(interceptor);
  setOfflineWritesEnabled(true);
  void NetInfo.fetch().then((state) => {
    connected = isOnlineState(state);
  });
  void syncQueue.load().then(() => syncEngine.run());
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const wasConnected = connected;
    connected = isOnlineState(state);
    if (connected && !wasConnected) void syncEngine.run();
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncEngine.run();
  });
  return () => {
    unsubscribeNet?.();
    appState.remove();
    setRequestInterceptor(null);
    setOfflineWritesEnabled(false);
  };
}

/**
 * Forget every unsynced change and the sync token: sign-out, session ended, another account signs in. Called from the
 * one place that already wipes the caches (features/auth/session.tsx).
 */
export async function clearSyncData(): Promise<void> {
  await syncEngine.reset();
  await syncQueue.clear();
}

// ---- React: the status the banner and the pill show ----

let snapshot: SyncStatus = { pending: 0, syncing: false, rejected: 0 };

function currentStatus(): SyncStatus {
  const next = syncEngine.status();
  if (next.pending !== snapshot.pending || next.syncing !== snapshot.syncing || next.rejected !== snapshot.rejected) {
    snapshot = next;
  }
  return snapshot; // same object until something changes: required by useSyncExternalStore
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(syncEngine.subscribe, currentStatus, currentStatus);
}
