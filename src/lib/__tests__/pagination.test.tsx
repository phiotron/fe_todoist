import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Page } from '../../api/models';
import { createTestQueryClient, createWrapper } from '../../test/render';
import { flattenPages, nextPageParam } from '../pagination';
import { usePagedList } from '../usePagedList';

interface Item {
  id: string;
}
const p = (ids: string[], nextCursor: string | null = null): Page<Item> => ({
  items: ids.map((id) => ({ id })),
  nextCursor,
});
const idOf = (item: Item) => item.id;

describe('flattenPages / nextPageParam', () => {
  it('joins pages in order and drops duplicates', () => {
    expect(flattenPages([p(['a', 'b'], 'c1'), p(['b', 'c'])], idOf).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(flattenPages(undefined, idOf)).toEqual([]);
  });

  it('stops when nextCursor is null', () => {
    expect(nextPageParam(p(['a'], 'cur-2'))).toBe('cur-2');
    expect(nextPageParam(p(['a']))).toBeUndefined();
  });
});

describe('usePagedList', () => {
  it('loads the first page, then the next one with the cursor', async () => {
    const fetchPage = jest.fn(async (cursor: string | null) => (cursor === null ? p(['a'], 'cur-2') : p(['b'])));
    const { result } = await renderHook(() => usePagedList(['items'], fetchPage, idOf), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['a']));
    expect(result.current.query.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.query.fetchNextPage();
    });

    expect(fetchPage).toHaveBeenLastCalledWith('cur-2');
    // Query notifications are batched on a timer: wait for the render instead of reading it right after act.
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b']));
    expect(result.current.query.hasNextPage).toBe(false);
  });
});
