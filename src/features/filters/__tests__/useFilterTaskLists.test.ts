import type { PagedQuery } from '../../../lib/usePagedList';
import { MAX_FILTER_PARTS, combineQueries } from '../useFilterTaskLists';

function query(overrides: Partial<PagedQuery> = {}): PagedQuery {
  return {
    isPending: false,
    isError: false,
    error: null,
    fetchStatus: 'idle',
    isRefetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
    ...overrides,
  };
}

describe('combineQueries', () => {
  it('limits the shown lists to 10', () => {
    expect(MAX_FILTER_PARTS).toBe(10);
  });

  it('is pending / failed while any list is, and keeps the first error', () => {
    const error = new Error('boom');
    const combined = combineQueries([query(), query({ isPending: true }), query({ isError: true, error })]);
    expect(combined.isPending).toBe(true);
    expect(combined.isError).toBe(true);
    expect(combined.error).toBe(error);
  });

  it('loads the next page of the first list that has one', () => {
    const first = query();
    const second = query({ hasNextPage: true });
    const third = query({ hasNextPage: true });
    const combined = combineQueries([first, second, third]);
    expect(combined.hasNextPage).toBe(true);
    combined.fetchNextPage();
    expect(second.fetchNextPage).toHaveBeenCalled();
    expect(third.fetchNextPage).not.toHaveBeenCalled();
  });

  it('refetches every list and reports paused when offline', () => {
    const a = query({ fetchStatus: 'paused' });
    const b = query();
    const combined = combineQueries([a, b]);
    expect(combined.fetchStatus).toBe('paused');
    void combined.refetch();
    expect(a.refetch).toHaveBeenCalled();
    expect(b.refetch).toHaveBeenCalled();
  });
});
