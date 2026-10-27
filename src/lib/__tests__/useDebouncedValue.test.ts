import { act, renderHook } from '@testing-library/react-native';
import { useDebouncedValue } from '../useDebouncedValue';

interface Props {
  value: string;
}

async function setup(initial: string) {
  return renderHook(({ value }: Props) => useDebouncedValue(value, 300), { initialProps: { value: initial } });
}

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the first value at once', async () => {
    const { result } = await setup('a');
    expect(result.current).toBe('a');
  });

  it('publishes a new value only after it stayed unchanged for the whole delay', async () => {
    const { result, rerender } = await setup('a');

    await rerender({ value: 'ab' });
    await act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('a');

    await act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab');
  });

  it('restarts the wait on every change, so only the last value comes out', async () => {
    const { result, rerender } = await setup('a');

    await rerender({ value: 'ab' });
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    await rerender({ value: 'abc' });
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a');

    await act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('abc');
  });
});
