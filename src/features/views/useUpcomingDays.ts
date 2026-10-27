import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DisplayParams, Page, Task } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';
import { tasksApi } from '../../api/tasks';
import { addDays, nextUpcomingWindow, taskDateKey, type DayWindow } from '../../lib/dates';
import { flattenPages } from '../../lib/pagination';

interface WindowParam extends DayWindow {
  /** Cursor inside the window (a window with more than `limit` tasks is paged), null = its first page. */
  cursor: string | null;
}

interface WindowPage extends Page<Task> {
  window: DayWindow;
}

const taskId = (task: Task) => task.id;

/**
 * Upcoming (spec 12.3 "cửa sổ ngày"): one infinite query whose pages walk consecutive DAY WINDOWS of 14 days from today —
 * within a window by cursor, then the next window (from = previous `to` + 1) — up to today + 2 years, after which
 * `hasNextPage` is false. `loadedThrough` = the last day whose tasks are fully loaded: `to` of a finished window; while a
 * window still has pages, the day of the last task loaded so far (earlier days are complete, the later ones unknown).
 */
export function useUpcomingDays(today: string, displayParams?: DisplayParams) {
  const query = useInfiniteQuery({
    queryKey: [...queryKeys.tasks.upcoming(today), displayParams ?? null],
    initialPageParam: { ...(nextUpcomingWindow(today, today) as DayWindow), cursor: null } as WindowParam,
    queryFn: async ({ pageParam }): Promise<WindowPage> => {
      const result = await tasksApi.list(
        { view: 'upcoming', from: pageParam.from, to: pageParam.to, ...displayParams },
        pageParam.cursor,
      );
      return { ...result, window: { from: pageParam.from, to: pageParam.to } };
    },
    getNextPageParam: (lastPage): WindowParam | undefined => {
      if (lastPage.nextCursor) return { ...lastPage.window, cursor: lastPage.nextCursor };
      const next = nextUpcomingWindow(addDays(lastPage.window.to, 1), today);
      return next ? { ...next, cursor: null } : undefined;
    },
  });
  const tasks = useMemo(() => flattenPages(query.data?.pages, taskId), [query.data]);
  const loadedThrough = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const last = pages[pages.length - 1];
    if (!last) return addDays(today, -1);
    if (last.nextCursor === null) return last.window.to;
    const lastTask = last.items[last.items.length - 1];
    const lastDay = lastTask ? taskDateKey(lastTask) : null;
    const before = addDays(last.window.from, -1);
    return lastDay && lastDay > before ? lastDay : before;
  }, [query.data, today]);
  return { query, tasks, loadedThrough };
}
