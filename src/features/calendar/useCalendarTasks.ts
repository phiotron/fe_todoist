import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { DisplayParams, Task, TaskListParams } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';
import { tasksApi } from '../../api/tasks';
import { flattenPages, nextPageParam } from '../../lib/pagination';
import type { PagedQuery } from '../../lib/usePagedList';
import { combineQueries } from '../filters/useFilterTaskLists';

/**
 * What a calendar shows (plan M7 F4): `calendar` = the scope parts of GET tasks?view=calendar (ONE of projectId /
 * labelId / filter each; a filter with commas = one part per comma list), `noDate` = lists of the tasks without a date
 * for the "No date" tray (built from the APIs of M2: filterDue=no_date, or filter "no date").
 */
export interface CalendarScope {
  calendar: Partial<TaskListParams>[];
  noDate: Partial<TaskListParams>[];
}

export const allTasksScope = (): CalendarScope => ({ calendar: [{}], noDate: [{ filter: 'no date' }] });
export const projectScope = (projectId: string): CalendarScope => ({
  calendar: [{ projectId }],
  noDate: [{ projectId, filterDue: 'no_date' }],
});
export const labelScope = (labelId: string): CalendarScope => ({
  calendar: [{ labelId }],
  noDate: [{ labelId, filterDue: 'no_date' }],
});
export const filterScope = (parts: readonly string[]): CalendarScope => ({
  calendar: parts.map((part) => ({ filter: part })),
  noDate: parts.map((part) => ({ filter: `(${part}) & no date` })),
});
/** Today: the tasks due today and the overdue ones; the tray lists every task without a date. */
export const todayScope = (): CalendarScope => ({
  calendar: [{ filter: 'today | overdue' }],
  noDate: [{ filter: 'no date' }],
});

/** The Display filters a calendar takes from the saved Display of its view (sort / group do not apply). */
export function calendarFilters(params: DisplayParams): CalendarTasksOptions['filters'] {
  return { filterPriority: params.filterPriority, filterLabelId: params.filterLabelId, filterDue: params.filterDue };
}

/** Hooks need a fixed count (as useFilterTaskLists): at most 10 lists per calendar. */
export const MAX_CALENDAR_LISTS = 10;
const SLOTS = Array.from({ length: MAX_CALENDAR_LISTS }, (_, index) => index);
const taskId = (task: Task) => task.id;

function useSlot(params: TaskListParams | undefined) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.tasks.list(params ?? {}),
    queryFn: ({ pageParam }) => tasksApi.list(params as TaskListParams, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: nextPageParam,
    enabled: params !== undefined,
  });
  const tasks = useMemo(() => flattenPages(query.data?.pages, taskId), [query.data]);
  return { query, tasks };
}

/** Every page of every list, one task once; `query` is the combined state. */
export function useAllPages(paramsList: readonly TaskListParams[], enabled = true): { tasks: Task[]; query: PagedQuery } {
  const slots = SLOTS.map((index) => useSlot(enabled && index < paramsList.length ? paramsList[index] : undefined));
  const count = enabled ? Math.min(paramsList.length, MAX_CALENDAR_LISTS) : 0;
  const used = slots.slice(0, count);
  const query = combineQueries(used.map((slot) => slot.query));
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const tasks = useMemo(() => {
    const seen = new Set<string>();
    const all: Task[] = [];
    for (const slot of slots.slice(0, count)) {
      for (const task of slot.tasks) {
        if (!seen.has(task.id)) {
          seen.add(task.id);
          all.push(task);
        }
      }
    }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a fixed number of slots, so the dependency list keeps its size
  }, [count, ...slots.map((slot) => slot.tasks)]);
  return { tasks, query: count === 0 ? { ...query, isPending: false } : query };
}

export interface CalendarTasksOptions {
  scope: CalendarScope;
  from: string;
  to: string;
  /** Display filters (priority / label / due) of the view; sort and group never go to the calendar. */
  filters: Pick<TaskListParams, 'filterPriority' | 'filterLabelId' | 'filterDue'>;
  /** Load the "No date" lists too (the tray is open). */
  withNoDate: boolean;
}

/** Tasks of the visible window + (tray open) the tasks without a date. */
export function useCalendarTasks({ scope, from, to, filters, withNoDate }: CalendarTasksOptions) {
  const scopeKey = JSON.stringify(scope);
  const filterKey = JSON.stringify(filters);
  const calendarParams = useMemo(() => {
    const parsed = JSON.parse(scopeKey) as CalendarScope;
    const display = JSON.parse(filterKey) as CalendarTasksOptions['filters'];
    // "No date" would be a 400 on the calendar (it only holds dated tasks): leave it out.
    const dated = display.filterDue === 'no_date' ? { ...display, filterDue: undefined } : display;
    return parsed.calendar.map((part): TaskListParams => ({ view: 'calendar', from, to, ...part, ...dated }));
  }, [scopeKey, filterKey, from, to]);
  const noDateParams = useMemo(
    () => (JSON.parse(scopeKey) as CalendarScope).noDate.map((part): TaskListParams => ({ ...part })),
    [scopeKey],
  );
  const dated = useAllPages(calendarParams);
  const noDate = useAllPages(noDateParams, withNoDate);
  return { tasks: dated.tasks, query: dated.query, noDateTasks: noDate.tasks, noDateQuery: noDate.query };
}
