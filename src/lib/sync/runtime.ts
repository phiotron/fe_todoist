import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { rawApiFetch, setRequestInterceptor } from '../../api/client';
import { requestReminderSync } from '../../features/reminders/syncSignal';
import { queryClient } from '../queryClient';
import { isOnlineState, setOfflineWritesEnabled } from '../useIsOnline';
import { newUuid } from '../uuid';
import { createSyncEngine } from './engine';
import { createWriteInterceptor } from './interceptor';
import { invalidateAfterSync, remindersAffected } from './invalidation';
import { createCommandQueue } from './queue';
import { createSyncScheduler, type SyncReason, type SyncScheduler } from './scheduler';
import type { SyncRequest, SyncResponse, SyncStatus } from './types';

/**
 * Wiring of M9 for the running app (plan F5): ONE queue on AsyncStorage, ONE engine, the interceptor installed into
 * api/client.ts while signed in. The pure pieces live next to this file and are tested without React Native.
 * PERF: every trigger goes through ONE scheduler (debounce, pull interval, back-off) instead of running the engine at
 * once, and a sync refreshes only the query roots of what the server reported.
 */

let connected = true;

export const syncQueue = createCommandQueue(AsyncStorage, newUuid);

export const syncEngine = createSyncEngine({
  queue: syncQueue,
  storage: AsyncStorage,
  send: (request: SyncRequest) => rawApiFetch<SyncResponse>('/api/v1/sync', { method: 'POST', body: request }),
  isOnline: () => connected,
  onServerChanged: (change) => {
    void invalidateAfterSync(queryClient, change);
    // Reminders / due dates written offline only count once the server has them: refresh the device schedule now.
    if (remindersAffected(change)) requestReminderSync();
  },
});

/** Set while signed in (startSync). */
let scheduler: SyncScheduler | null = null;

function requestSync(reason: SyncReason): void {
  scheduler?.request(reason);
}

const interceptor = createWriteInterceptor({
  queue: syncQueue,
  queryClient,
  isConnected: () => connected,
  newId: newUuid,
  now: () => new Date(),
  trigger: () => requestSync('write'),
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
  const own = createSyncScheduler({
    run: () => syncEngine.run(),
    pending: () => syncQueue.size(),
    now: () => Date.now(),
  });
  scheduler?.stop();
  scheduler = own;
  setRequestInterceptor(interceptor);
  setOfflineWritesEnabled(true);
  void NetInfo.fetch().then((state) => {
    connected = isOnlineState(state);
  });
  void syncQueue.load().then(() => own.request('start'));
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const wasConnected = connected;
    connected = isOnlineState(state);
    if (connected && !wasConnected) own.request('reconnect');
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') own.request('foreground');
  });
  return () => {
    own.stop();
    if (scheduler === own) scheduler = null;
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
