import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Page } from '../api/models';
import { flattenPages, nextPageParam } from './pagination';

/** What list UIs need from a paged query (TaskListView, overdue block, completed tasks…). */
export interface PagedQuery {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  fetchStatus: 'fetching' | 'paused' | 'idle';
  isRefetching: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  refetch: () => unknown;
  fetchNextPage: () => unknown;
}

/**
 * Cursor-paged list (spec 5.10): first page with cursor=null, then nextCursor until it is null.
 * Pass a module-level `idOf` (a new function every render would recompute `items` each time).
 */
export function usePagedList<T>(
  queryKey: QueryKey,
  fetchPage: (cursor: string | null) => Promise<Page<T>>,
  idOf: (item: T) => string,
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: nextPageParam,
  });
  const items = useMemo(() => flattenPages(query.data?.pages, idOf), [query.data, idOf]);
  return { query, items };
}
