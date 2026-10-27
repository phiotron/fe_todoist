import { act, renderHook } from '@testing-library/react-native';
import { useNow } from '../useNow';

describe('useNow', () => {
  afterEach(() => jest.useRealTimers());

  it('re-renders with a fresh time every interval', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-23T03:00:00Z') });
    const { result } = await renderHook(() => useNow(60_000));
    expect(result.current.toISOString()).toBe('2026-10-23T03:00:00.000Z');

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current.toISOString()).toBe('2026-10-23T03:01:00.000Z');
  });
});
