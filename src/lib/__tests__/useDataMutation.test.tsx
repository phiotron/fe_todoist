import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApiError, OfflineError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { createTestQueryClient, createWrapper } from '../../test/render';
import { useDataMutation } from '../useDataMutation';

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
