import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../api/client';
import { describeError } from '../../api/describeError';
import type { ReorderResponse, Task } from '../../api/models';
import { useSnackbar } from '../../components/Snackbar';
import { addDays } from '../../lib/dates';
import { formatDateKey } from '../../lib/dates/format';
import { useDataMutation } from '../../lib/useDataMutation';
import { useUpdateTask } from '../tasks/useTaskActions';
import { undoDueBody, type DayDropPlan } from './dayDrop';

/**
 * Backend DND (V21): `POST /api/v1/reorder {type: 'TASK_DAY', id, afterId}` — order inside the task's due DAY (Today /
 * Upcoming, sort = date). Same route as every reorder, so the offline queue sends it as its `reorder` command.
 * Declared here until types.gen.ts is regenerated (ReorderType gains TASK_DAY).
 */
export interface DayReorderRequest {
  type: 'TASK_DAY';
  id: string;
  afterId: string | null;
}

export const dayOrderApi = {
  reorder: (body: DayReorderRequest) => apiFetch<ReorderResponse>('/api/v1/reorder', { method: 'POST', body }),
};

/** Reorder does not change any version: the open task detail is not refreshed (like useReorderTask). */
export const useDayReorder = () =>
  useDataMutation(({ id, afterId }: { id: string; afterId: string | null }) => dayOrderApi.reorder({ type: 'TASK_DAY', id, afterId }), {
    keepDetail: true,
  });

/**
 * Sends a DayDropPlan: the due change first (PATCH with the task's version, then "Moved to … · Undo" for 5 s; Undo
 * PATCHes the old due back with the version the server answered), then the day order. A failure is toasted and
 * rethrown, so the screen can drop its optimistic order.
 */
export function useDayDrop() {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const runUpdate = useUpdateTask().mutateAsync;
  const runReorder = useDayReorder().mutateAsync;

  const fail = useCallback(
    (error: unknown) => snackbar.show({ message: describeError(error).message, tone: 'error' }),
    [snackbar],
  );

  return useCallback(
    async (task: Task, plan: DayDropPlan, today: string): Promise<void> => {
      try {
        if (plan.due) {
          const updated = await runUpdate({ taskId: task.id, body: { version: task.version, ...plan.due } });
          snackbar.show({
            message: t('reorder.list.movedTo', { date: dayName(plan.day, today, t) }),
            actionLabel: t('common.undo'),
            onAction: () => {
              runUpdate({ taskId: task.id, body: { version: updated?.version ?? task.version, ...undoDueBody(task) } }).catch(fail);
            },
          });
        }
        if (plan.reorderAfterId !== undefined) await runReorder({ id: task.id, afterId: plan.reorderAfterId });
      } catch (error) {
        fail(error);
        throw error;
      }
    },
    [runUpdate, runReorder, snackbar, fail, t],
  );
}

/** "Hôm nay" / "Ngày mai" / "02/11" (with the year when it is another year). */
function dayName(day: string, today: string, t: (key: string) => string): string {
  if (day === today) return t('dates.today');
  if (day === addDays(today, 1)) return t('dates.tomorrow');
  return formatDateKey(day, day.slice(0, 4) !== today.slice(0, 4));
}
