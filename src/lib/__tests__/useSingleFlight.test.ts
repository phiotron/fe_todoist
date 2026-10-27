import { act, renderHook } from '@testing-library/react-native';
import { deferred } from '../../test/deferred';
import { useSingleFlight } from '../useSingleFlight';

describe('useSingleFlight', () => {
  it('ignores calls while one is running and reports busy', async () => {
    const gate = deferred<string>();
    const task = jest.fn(() => gate.promise);
    const { result } = await renderHook(() => useSingleFlight());

    let first: Promise<string | undefined> = Promise.resolve(undefined);
    await act(async () => {
      first = result.current.run(task);
      void result.current.run(task);
    });
    expect(task).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);

    await act(async () => {
      gate.resolve('ok');
      await first;
    });
    expect(result.current.busy).toBe(false);
    await expect(first).resolves.toBe('ok');
  });

  it('releases the lock when the task throws', async () => {
    const { result } = await renderHook(() => useSingleFlight());
    await act(async () => {
      await expect(result.current.run(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    });
    const second = jest.fn(async () => 'again');
    await act(async () => {
      await result.current.run(second);
    });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
