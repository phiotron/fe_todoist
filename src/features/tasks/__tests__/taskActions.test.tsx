import { act, renderHook } from '@testing-library/react-native';
import type { TaskBatchRequest } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { tokenStore } from '../../../lib/tokenStore';
import { requestsTo, routeApi, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { affected, makeTask, reorderResult, taskChange } from '../../../test/m1Fixtures';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useCloseTask, useMoveTask, useReopenTask, useReorderTask, useTaskBatch } from '../useTaskActions';

const DONE_AT = '2026-10-23T03:00:00Z';

async function setup(routes: ApiRoutes) {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  const fetchMock = mockFetch();
  routeApi(fetchMock, routes);
  return fetchMock;
}

describe('task actions (spec 3.1)', () => {
  it('close writes the answered version and the cascaded versions into the cached details and lists', async () => {
    const parent = makeTask({ id: 't1', version: 1, subtaskCount: 1 });
    const child = makeTask({ id: 'c1', parentId: 't1', version: 4 });
    await setup({
      'POST /api/v1/tasks/t1/close': () =>
        jsonResponse(200, taskChange({ ...parent, version: 2, completedAt: DONE_AT }, [{ id: 'c1', version: 5, completedAt: DONE_AT }])),
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.tasks.detail('t1'), parent);
    queryClient.setQueryData(queryKeys.tasks.detail('c1'), child);
    queryClient.setQueryData(queryKeys.tasks.subtasks('t1'), [child]);
    const { result } = await renderHook(() => useCloseTask(), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync('t1');
    });

    // A PATCH made from these copies would carry the NEW versions: no false 409 version-conflict.
    expect(queryClient.getQueryData(queryKeys.tasks.detail('t1'))).toMatchObject({ version: 2, completedAt: DONE_AT });
    expect(queryClient.getQueryData(queryKeys.tasks.detail('c1'))).toMatchObject({ version: 5, completedAt: DONE_AT });
    expect(queryClient.getQueryData<(typeof child)[]>(queryKeys.tasks.subtasks('t1'))?.[0]).toMatchObject({ version: 5 });
  });

  it('reopen (also as Undo) writes the cascaded versions back with completedAt null', async () => {
    const child = makeTask({ id: 'c1', parentId: 't1', version: 5, completedAt: DONE_AT });
    const fetchMock = await setup({
      'POST /api/v1/tasks/t1/reopen': () =>
        jsonResponse(200, taskChange(makeTask({ id: 't1', version: 3 }), [{ id: 'c1', version: 6, completedAt: null }])),
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.tasks.detail('c1'), child);
    const { result } = await renderHook(() => useReopenTask(), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ taskId: 't1', undo: true });
    });

    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')[0].body).toEqual({ undo: true });
    expect(queryClient.getQueryData(queryKeys.tasks.detail('c1'))).toMatchObject({ version: 6, completedAt: null });
  });

  it('move writes the answered task (new version) into the detail cache for the open detail screen', async () => {
    const moved = makeTask({ id: 't1', projectId: 'p2', version: 4 });
    await setup({ 'POST /api/v1/tasks/t1/move': () => jsonResponse(200, moved) });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.tasks.detail('t1'), makeTask({ id: 't1', projectId: 'p1', version: 3 }));
    const { result } = await renderHook(() => useMoveTask(), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ taskId: 't1', body: { projectId: 'p2' } });
    });

    expect(queryClient.getQueryData(queryKeys.tasks.detail('t1'))).toMatchObject({ projectId: 'p2', version: 4 });
  });

  it('reorder always sends afterId (null = first) and leaves the open task detail alone', async () => {
    const fetchMock = await setup({ 'POST /api/v1/reorder': () => jsonResponse(200, reorderResult('TASK', 't2')) });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.tasks.detail('t2'), makeTask({ id: 't2', version: 3 }));
    queryClient.setQueryData(queryKeys.tasks.list({ projectId: 'p1' }), { pages: [], pageParams: [] });
    const { result } = await renderHook(() => useReorderTask(), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ id: 't2', afterId: null });
    });

    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK', id: 't2', afterId: null });
    expect(queryClient.getQueryState(queryKeys.tasks.detail('t2'))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(queryKeys.tasks.list({ projectId: 'p1' }))?.isInvalidated).toBe(true);
  });

  it('tasks/batch always carries an Idempotency-Key: a retry of the same body reuses it, a success starts a new one', async () => {
    let failing = true;
    const fetchMock = await setup({
      'POST /api/v1/tasks/batch': () =>
        failing ? problem(503, 'Service Unavailable') : jsonResponse(200, affected(['t1'])),
    });
    const { result } = await renderHook(() => useTaskBatch(), { wrapper: createWrapper(createTestQueryClient()) });
    const body: TaskBatchRequest = { action: 'DELETE', taskIds: ['t1'] };

    await act(async () => {
      await expect(result.current.mutateAsync(body)).rejects.toBeDefined();
    });
    failing = false;
    await act(async () => {
      await result.current.mutateAsync(body); // retry: same key
    });
    await act(async () => {
      await result.current.mutateAsync(body); // a new operation with the same content: new key
    });

    const keys = requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch').map((request) => request.headers['Idempotency-Key']);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });
});
