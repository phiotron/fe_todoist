import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { createForegroundPersister, createQueryPersister, PERSIST_THROTTLE_MS } from '../queryClient';

/**
 * PERF: the whole query cache is JSON-stringified into AsyncStorage on writes. It used to happen every second during
 * activity and also while the app sat in the background; now at most every 5 s and never while in the background
 * (what changed there is written once the app is back).
 */

const client = (n: number) => ({ timestamp: n, buster: '', clientState: { queries: [], mutations: [] } }) as PersistedClient;

function fakeAppState(initial: string) {
  let current = initial;
  const listeners = new Set<(state: string) => void>();
  return {
    current: () => current,
    onChange(listener: (state: string) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: string) {
      current = next;
      listeners.forEach((l) => l(next));
    },
  };
}

function fakeInner() {
  const saved: number[] = [];
  const inner: Persister = {
    persistClient: async (c) => {
      saved.push(c.timestamp);
    },
    restoreClient: async () => undefined,
    removeClient: async () => undefined,
  };
  return { inner, saved };
}

describe('query cache persister', () => {
  it('throttles disk writes to one every 5 s at most', async () => {
    jest.useFakeTimers();
    try {
      expect(PERSIST_THROTTLE_MS).toBeGreaterThanOrEqual(5000);
      const setItem = jest.fn(async () => undefined);
      const storage = { getItem: async () => null, setItem, removeItem: async () => undefined };
      const persister = createQueryPersister(storage, fakeAppState('active'));
      // 5 cache changes 0.8 s apart (the old 1 s throttle wrote 5 times): the first at once, the rest once, the latest.
      for (let i = 1; i <= 5; i++) {
        void persister.persistClient(client(i));
        await jest.advanceTimersByTimeAsync(800);
      }
      await jest.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
      const written = setItem.mock.calls.map((call) => JSON.parse(String((call as unknown[])[1])).timestamp);
      expect(written).toEqual([1, 5]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('writes straight through while the app is in the foreground', async () => {
    const { inner, saved } = fakeInner();
    const persister = createForegroundPersister(inner, fakeAppState('active'));
    await persister.persistClient(client(1));
    await persister.persistClient(client(2));
    expect(saved).toEqual([1, 2]);
  });

  it('keeps only the latest snapshot while in the background and writes it once when the app comes back', async () => {
    const { inner, saved } = fakeInner();
    const appState = fakeAppState('active');
    const persister = createForegroundPersister(inner, appState);
    appState.set('background');
    await persister.persistClient(client(1));
    await persister.persistClient(client(2));
    await persister.persistClient(client(3));
    expect(saved).toEqual([]);

    appState.set('active');
    await Promise.resolve();
    expect(saved).toEqual([3]);
    appState.set('background');
    appState.set('active');
    expect(saved).toEqual([3]);
  });

  it('restore and remove go straight to the storage', async () => {
    const restoreClient = jest.fn(async () => client(7));
    const removeClient = jest.fn(async () => undefined);
    const persister = createForegroundPersister(
      { persistClient: async () => undefined, restoreClient, removeClient },
      fakeAppState('background'),
    );
    await expect(persister.restoreClient()).resolves.toEqual(client(7));
    await persister.removeClient();
    expect(removeClient).toHaveBeenCalled();
  });
});
