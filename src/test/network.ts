import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/** Call BEFORE rendering: useIsOnline subscribers get "offline", TanStack pauses queries, writes are refused. */
export function goOffline(): void {
  jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
    listener({ isConnected: false } as NetInfoState);
    return jest.fn();
  });
  onlineManager.setOnline(false);
}

/** Restore in afterEach: the NetInfo mock implementation would otherwise leak into later tests. */
export function goOnline(): void {
  jest.mocked(NetInfo.addEventListener).mockImplementation(() => jest.fn());
  onlineManager.setOnline(true);
}
