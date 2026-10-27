import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DisplayParams, Task, TaskListParams } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';
import { tasksApi } from '../../api/tasks';
import { flattenPages, nextPageParam } from '../../lib/pagination';
import type { PagedQuery } from '../../lib/usePagedList';

/** Hooks need a fixed count, so at most 10 comma lists are shown; the screen says when some are left out. */
export const MAX_FILTER_PARTS = 10;
const SLOTS = Array.from({ length: MAX_FILTER_PARTS }, (_, index) => index);
const taskId = (task: Task) => task.id;

export interface FilterTaskList {
  part: string;
  query: PagedQuery;
  tasks: Task[];
}

/** Same cache key as useTaskList (root 'tasks'), so every write refreshes it. */
function usePartList(part: string | undefined, display: DisplayParams) {
  const params: TaskListParams = { filter: part ?? '', ...display };
  const query = useInfiniteQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: ({ pageParam }) => tasksApi.list(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: nextPageParam,
    enabled: part !== undefined,
  });
  const tasks = useMemo(() => flattenPages(query.data?.pages, taskId), [query.data]);
  return { query, tasks };
}

/** One state for TaskListView: pending / failed while any list is; "load more" goes to the first list with more. */
export function combineQueries(queries: readonly PagedQuery[]): PagedQuery {
  const firstWithMore = queries.find((query) => query.hasNextPage);
  const firstError = queries.find((query) => query.isError);
  let fetchStatus: PagedQuery['fetchStatus'] = 'idle';
  if (queries.some((query) => query.fetchStatus === 'fetching')) fetchStatus = 'fetching';
  else if (queries.some((query) => query.fetchStatus === 'paused')) fetchStatus = 'paused';
  return {
    isPending: queries.some((query) => query.isPending),
    isError: firstError !== undefined,
    error: firstError?.error ?? null,
    fetchStatus,
    isRefetching: queries.some((query) => query.isRefetching),
    hasNextPage: firstWithMore !== undefined,
    isFetchingNextPage: queries.some((query) => query.isFetchingNextPage),
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
    fetchNextPage: () => firstWithMore?.fetchNextPage(),
  };
}

/** One paged list per part of a filter (spec 12.7: GET tasks?filter= takes a single part). */
export function useFilterTaskLists(parts: readonly string[], display: DisplayParams) {
  // Always the same number of hook calls; slots beyond parts.length stay disabled.
  const slots = SLOTS.map((index) => usePartList(index < parts.length ? parts[index] : undefined, display));
  const count = Math.min(parts.length, MAX_FILTER_PARTS);
  const lists: FilterTaskList[] = slots
    .slice(0, count)
    .map((slot, index) => ({ part: parts[index], query: slot.query, tasks: slot.tasks }));
  return {
    lists,
    combined: combineQueries(lists.map((list) => list.query)),
    truncated: parts.length > MAX_FILTER_PARTS,
  };
}
