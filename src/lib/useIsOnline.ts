import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState, useSyncExternalStore } from 'react';

export function isOnlineState(state: Pick<NetInfoState, 'isConnected'>): boolean {
  return state.isConnected !== false;
}

/** true while the device has a network connection (the raw state; the offline banner and insets use this one). */
export function useIsConnected(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setOnline(isOnlineState(state)));
    return () => unsubscribe?.();
  }, []);
  return online;
}

// ---- M9: while the offline queue is running (signed in) a queueable write may start without a connection ----
let offlineWrites = false;
const offlineWritesListeners = new Set<() => void>();

/** Set by lib/sync/runtime.ts while signed in. Off (the default, and in tests) = writes need a connection like M1–M8. */
export function setOfflineWritesEnabled(enabled: boolean): void {
  if (offlineWrites === enabled) return;
  offlineWrites = enabled;
  [...offlineWritesListeners].forEach((listener) => listener());
}

export function isOfflineWritesEnabled(): boolean {
  return offlineWrites;
}

function subscribeOfflineWrites(listener: () => void): () => void {
  offlineWritesListeners.add(listener);
  return () => {
    offlineWritesListeners.delete(listener);
  };
}

/** true while the M9 offline queue is on (signed in): the offline banner then says changes are kept. */
export function useOfflineWritesEnabled(): boolean {
  return useSyncExternalStore(subscribeOfflineWrites, isOfflineWritesEnabled, isOfflineWritesEnabled);
}

/**
 * Gate of every write control (buttons, swipe, FAB): true when a write may start. Offline it stays true while the
 * M9 queue is on — the request layer queues what it can and answers OfflineError for the rest (see lib/sync/interceptor.ts).
 */
export function useIsOnline(): boolean {
  const connected = useIsConnected();
  const queueing = useOfflineWritesEnabled();
  return connected || queueing;
}
