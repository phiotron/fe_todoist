import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Page, Task, TaskListParams } from '../../api/models';
import { tasksApi } from '../../api/tasks';
import { dateKeyInZone } from '../../lib/dates';
import { useSession } from '../auth/session';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { useProductivity } from '../productivity/useProductivity';
import { refreshWidgets } from './widgetBridge';
import { buildWidgetSnapshot, saveWidgetSnapshot } from './widgetSnapshot';

/** A Today list younger than this (and not invalidated) is as good as a new request for the widget's first page. */
export const WIDGET_REUSE_MS = 10_000;

/**
 * PERF3: the first page of the unfiltered Today list the Today screen already holds, when it is fresh: the widget then
 * needs no second GET tasks?view=today (same rows, ~50 tasks of JSON, parsed on the JS thread). null = ask the server.
 */
export function freshTodayFirstPage(queryClient: QueryClient, today: string, nowMs: number): Page<Task> | null {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['tasks', 'list'] })) {
    const params = query.queryKey[2] as TaskListParams | undefined;
    if (params?.view !== 'today' || params.today !== today) continue;
    if (params.filterPriority !== undefined || params.filterLabelId !== undefined || params.filterDue !== undefined) continue;
    const state = query.state;
    if (state.isInvalidated || state.fetchStatus === 'fetching' || nowMs - state.dataUpdatedAt > WIDGET_REUSE_MS) continue;
    const first = (state.data as { pages?: Page<Task>[] } | undefined)?.pages?.[0];
    if (first) return first;
  }
  return null;
}

/**
 * Keeps what the home-screen widgets show in step with the Today list (M12). Under the "tasks" query root, so every
 * write refreshes it. Only the first page of Today is needed (the widget shows ≤ 10 rows). Renders nothing.
 * Productivity numbers (tasks done today / daily goal) come from M10's GET productivity; while they are not loaded (or
 * the request fails) the snapshot carries none and that widget shows its empty state.
 */
export function WidgetSnapshotWriter({ now = Date.now }: { now?: () => number } = {}) {
  const { status } = useSession();
  const timeZone = useUserTimeZone();
  const today = dateKeyInZone(new Date(now()), timeZone);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['tasks', 'widget-today', today],
    queryFn: () => freshTodayFirstPage(queryClient, today, Date.now()) ?? tasksApi.list({ view: 'today', today }, null),
    enabled: status === 'signedIn',
  });
  const items = query.data?.items;
  const productivityQuery = useProductivity({ enabled: status === 'signedIn' });
  const daily = productivityQuery.data?.daily.completed;
  const goal = productivityQuery.data?.dailyGoal;

  useEffect(() => {
    if (!items) return;
    const snapshot = buildWidgetSnapshot(items, daily !== undefined && goal !== undefined ? { done: daily, goal } : null, now());
    void saveWidgetSnapshot(snapshot).then(() => refreshWidgets(snapshot));
  }, [items, daily, goal, now]);

  return null;
}
