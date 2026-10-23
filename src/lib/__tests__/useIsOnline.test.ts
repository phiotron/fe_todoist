import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { act, renderHook } from '@testing-library/react-native';
import { isOnlineState, useIsOnline } from '../useIsOnline';

describe('isOnlineState', () => {
  it('treats unknown connectivity as online and only false as offline', () => {
    expect(isOnlineState({ isConnected: true })).toBe(true);
    expect(isOnlineState({ isConnected: null })).toBe(true);
    expect(isOnlineState({ isConnected: false })).toBe(false);
  });
});

describe('useIsOnline', () => {
  it('follows NetInfo connectivity events', async () => {
    let emit: ((state: NetInfoState) => void) | undefined;
    jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
      emit = listener;
      return jest.fn();
    });

    const { result } = await renderHook(() => useIsOnline());
    expect(result.current).toBe(true);

    await act(() => emit?.({ isConnected: false } as NetInfoState));
    expect(result.current).toBe(false);

    await act(() => emit?.({ isConnected: true } as NetInfoState));
    expect(result.current).toBe(true);
  });
});
