import { onlineManager, QueryObserver, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApiError, OfflineError } from '../../api/errors';
import { labelsApi } from '../../api/labels';
import { queryKeys } from '../../api/queryKeys';
import { tasksApi } from '../../api/tasks';
import { onReminderSyncAfterWrite } from '../../features/reminders/syncSignal';
import { jsonResponse, mockFetch } from '../../test/http';
import { createTestQueryClient, createWrapper } from '../../test/render';
import { tokenStore } from '../tokenStore';
import { useDataMutation } from '../useDataMutation';

beforeAll(async () => {
  await tokenStore.setTokens({ accessToken: 'acc', refreshToken: 'ref' });
});

const LIST = queryKeys.tasks.list({ view: 'today' });

async function setup(fn: (vars: string) => Promise<string>) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(LIST, { pages: [] });
  const hook = await renderHook(() => useDataMutation(fn), { wrapper: createWrapper(queryClient) });
  return { queryClient, ...hook };
}

describe('useDataMutation', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('runs the write and invalidates the data queries on success', async () => {
    const fn = jest.fn(async (vars: string) => `done-${vars}`);
    const { result, queryClient } = await setup(fn);

    await act(async () => {
      await expect(result.current.mutateAsync('a')).resolves.toBe('done-a');
    });

    expect(fn).toHaveBeenCalledWith('a');
    await waitFor(() => expect(queryClient.getQueryState(LIST)?.isInvalidated).toBe(true));
  });

  it('rejects with OfflineError without calling the write while offline', async () => {
    const fn = jest.fn(async () => 'sent');
    const { result } = await setup(fn);
    onlineManager.setOnline(false);

    await act(async () => {
      await expect(result.current.mutateAsync('a')).rejects.toBeInstanceOf(OfflineError);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('invalidates on 404 so a vanished item leaves the lists', async () => {
    const fn = jest.fn(async () => {
      throw new ApiError({ status: 404, title: 'Not Found' });
    });
    const { result, queryClient } = await setup(fn);

    await act(async () => {
      await expect(result.current.mutateAsync('a')).rejects.toMatchObject({ status: 404 });
    });
    await waitFor(() => expect(queryClient.getQueryState(LIST)?.isInvalidated).toBe(true));
  });

  // ---- PERF: refresh only what the write can change (it used to invalidate all 14 data roots each time) ----

  /** Active observers (like mounted screens / hosts) whose fetches are counted. */
  function observe(queryClient: QueryClient, keys: readonly (readonly unknown[])[]) {
    const fetches = new Map<string, number>();
    const unsubscribes = keys.map((key) => {
      const name = String(key[0]);
      fetches.set(name, 0);
      const observer = new QueryObserver(queryClient, {
        queryKey: key,
        queryFn: async () => {
          fetches.set(name, (fetches.get(name) ?? 0) + 1);
          return {};
        },
        staleTime: Infinity,
      });
      return observer.subscribe(() => undefined);
    });
    return { fetches, stop: () => unsubscribes.forEach((u) => u()) };
  }

  const MOUNTED = [
    LIST,
    queryKeys.productivity.get(),
    queryKeys.labels.list(),
    queryKeys.filters.list(),
    queryKeys.viewOptions.list(),
    queryKeys.projects.list(false),
  ] as const;

  async function writes(queryClient: QueryClient, run: (call: (v: string) => Promise<unknown>) => Promise<void>, fn: (v: string) => Promise<unknown>) {
    const { result } = await renderHook(() => useDataMutation(fn), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await run((v) => result.current.mutateAsync(v));
    });
  }

  it('N task edits refresh the task lists, never productivity / labels / filters / view options', async () => {
    mockFetch().mockImplementation(async () => jsonResponse(200, { id: 't1', version: 2 }));
    const queryClient = createTestQueryClient();
    const { fetches, stop } = observe(queryClient, MOUNTED);
    await waitFor(() => expect(fetches.get('productivity')).toBe(1));

    await writes(
      queryClient,
      async (call) => {
        for (let i = 0; i < 5; i++) await call(`content ${i}`);
      },
      (content) => tasksApi.update('t1', { version: 1, content }),
    );
    await waitFor(() => expect(fetches.get('tasks')).toBeGreaterThan(1));
    stop();

    expect(fetches.get('productivity')).toBe(1);
    expect(fetches.get('labels')).toBe(1);
    expect(fetches.get('filters')).toBe(1);
    expect(fetches.get('viewOptions')).toBe(1);
  });

  it('completing a task also refreshes productivity (goal celebration, widget numbers)', async () => {
    mockFetch().mockImplementation(async () => jsonResponse(200, { task: { id: 't1', version: 2 } }));
    const queryClient = createTestQueryClient();
    const { fetches, stop } = observe(queryClient, MOUNTED);
    await waitFor(() => expect(fetches.get('productivity')).toBe(1));

    await writes(queryClient, async (call) => void (await call('t1')), (id) => tasksApi.close(id));
    await waitFor(() => expect(fetches.get('productivity')).toBe(2));
    stop();
    expect(fetches.get('labels')).toBe(1);
  });

  it('a label rename refreshes labels (and task rows showing it) but not productivity / filters', async () => {
    mockFetch().mockImplementation(async () => jsonResponse(200, { id: 'l1', name: 'x' }));
    const queryClient = createTestQueryClient();
    const { fetches, stop } = observe(queryClient, MOUNTED);
    await waitFor(() => expect(fetches.get('labels')).toBe(1));

    await writes(queryClient, async (call) => void (await call('x')), (name) => labelsApi.update('l1', { name }));
    await waitFor(() => expect(fetches.get('labels')).toBe(2));
    stop();
    expect(fetches.get('productivity')).toBe(1);
    expect(fetches.get('filters')).toBe(1);
  });

  it('asks the reminder runtime to re-plan only after a write that can move a reminder', async () => {
    mockFetch().mockImplementation(async () => jsonResponse(200, { id: 't1', version: 2 }));
    const queryClient = createTestQueryClient();
    const requested = jest.fn();
    const stopListening = onReminderSyncAfterWrite(requested);

    await writes(queryClient, async (call) => void (await call('notes')), (description) =>
      tasksApi.update('t1', { version: 1, description }),
    );
    expect(requested).not.toHaveBeenCalled();

    await writes(queryClient, async (call) => void (await call('2026-11-01')), (dueDate) =>
      tasksApi.update('t1', { version: 1, dueDate }),
    );
    expect(requested).toHaveBeenCalledTimes(1);
    stopListening();
  });

  it('keepDetail: refreshes lists but not the open task detail (use for reorder)', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(LIST, { pages: [] });
    queryClient.setQueryData(queryKeys.tasks.detail('t1'), { id: 't1', version: 1 });
    const { result } = await renderHook(() => useDataMutation(async () => 'ok', { keepDetail: true }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    await waitFor(() => expect(queryClient.getQueryState(LIST)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(queryKeys.tasks.detail('t1'))?.isInvalidated).toBe(false);
  });
});
