import { act, renderHook, waitFor } from '@testing-library/react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { routeApi, requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { makeLabel } from '../../../test/m2Fixtures';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useBatchLabels, useCreateLabel, useDeleteLabel, useLabelMap, useLabels } from '../useLabels';

async function setup<T>(hook: () => T, routes: Parameters<typeof routeApi>[1]) {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  const fetchMock = mockFetch();
  routeApi(fetchMock, routes);
  const queryClient = createTestQueryClient();
  const rendered = await renderHook(hook, { wrapper: createWrapper(queryClient) });
  return { fetchMock, queryClient, ...rendered };
}

describe('label hooks', () => {
  const labels = [makeLabel({ id: 'l-1', name: 'gap', sortOrder: 1 }), makeLabel({ id: 'l-2', name: 'nha', sortOrder: 2 })];

  it('loads every label and maps them by id', async () => {
    const { result } = await setup(() => ({ list: useLabels(), map: useLabelMap() }), {
      'GET /api/v1/labels': () => jsonResponse(200, labels),
    });
    await waitFor(() => expect(result.current.list.labels).toHaveLength(2));
    expect(result.current.map.get('l-2')?.name).toBe('nha');
  });

  it('does not request labels while disabled', async () => {
    const { fetchMock } = await setup(() => useLabels(false), {
      'GET /api/v1/labels': () => jsonResponse(200, labels),
    });
    expect(requestsTo(fetchMock, 'GET', '/api/v1/labels')).toHaveLength(0);
  });

  it('creates with the given Idempotency-Key and refreshes the list', async () => {
    const { result, fetchMock, queryClient } = await setup(() => useCreateLabel(), {
      'POST /api/v1/labels': () => jsonResponse(201, makeLabel({ id: 'l-3', name: 'moi' })),
    });
    queryClient.setQueryData(['labels', 'list'], labels);

    await act(async () => {
      await result.current.mutateAsync({ body: { name: 'moi' }, idempotencyKey: 'key-1' });
    });

    expect(requestsTo(fetchMock, 'POST', '/api/v1/labels')[0].headers['Idempotency-Key']).toBe('key-1');
    await waitFor(() => expect(queryClient.getQueryState(['labels', 'list'])?.isInvalidated).toBe(true));
  });

  it('adds labels to many tasks in one batch request', async () => {
    const { result, fetchMock } = await setup(() => useBatchLabels(), {
      'POST /api/v1/tasks/batch': () => jsonResponse(200, { affectedTaskIds: ['t-1', 't-2'] }),
    });
    await act(async () => {
      await result.current.mutateAsync({
        action: 'ADD_LABELS',
        taskIds: ['t-1', 't-2'],
        labelIds: ['l-1'],
        idempotencyKey: 'key-b',
      });
    });
    const request = requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0];
    expect(request.body).toEqual({ action: 'ADD_LABELS', taskIds: ['t-1', 't-2'], labelIds: ['l-1'] });
    // Spec 12.5 / 12.11: the app always sends a key with tasks/batch.
    expect(request.headers['Idempotency-Key']).toBe('key-b');
  });

  it('treats 404 on delete as already deleted (spec 5.6)', async () => {
    const { result } = await setup(() => useDeleteLabel(), {
      'DELETE /api/v1/labels/l-1': () => problem(404, 'Not Found'),
    });
    await act(async () => {
      await expect(result.current.mutateAsync('l-1')).resolves.toBeUndefined();
    });
  });

  it('still fails on other errors', async () => {
    const { result } = await setup(() => useDeleteLabel(), {
      'DELETE /api/v1/labels/l-1': () => problem(500, 'Server Error'),
    });
    await act(async () => {
      await expect(result.current.mutateAsync('l-1')).rejects.toMatchObject({ status: 500 });
    });
  });
});
