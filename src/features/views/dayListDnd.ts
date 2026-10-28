import { useMemo } from 'react';
import type { Task } from '../../api/models';
import { dayOfContainer, planDayDrop } from '../dnd/dayDrop';
import { placeDrop, type ListEntry } from '../dnd/listDrop';
import { useDayDrop } from '../dnd/useDayDrop';
import { anchorOf, type PendingDrop } from '../dnd/usePendingDrop';
import type { ListDnd } from '../tasks/TaskListView';

/** DND container keys of the dated lists: Overdue block, today's block (Today); Upcoming days are `d-<YYYY-MM-DD>`. */
export const OVERDUE_BLOCK = 'overdue';
export const TODAY_BLOCK = 'today';
export const dayBlock = (day: string) => `d-${day}`;

interface DayListDndOptions {
  /** The blocks of the screen in screen order (Overdue first), each with its tasks as shown. */
  blocks: readonly { container: string; tasks: readonly Task[] }[];
  todayKey: string;
  /** Upcoming: a drop on another day keeps the time (true); Today: Overdue → today drops it (false). */
  keepTime: boolean;
  /** Tasks may change day even when the list does not show the day order (Upcoming). */
  moveBetweenDays: boolean;
  /** The list shows the day order (sort = date ascending, no grouping): drops inside a day reorder it. */
  ordered: boolean;
  setPending: (drop: PendingDrop) => void;
  clearPending: () => void;
}

/**
 * DND of Today / Upcoming lists: the drop planner (features/dnd) turned into requests — PATCH of the due for another
 * day (with Undo), `reorder TASK_DAY` for the order inside a day — and the optimistic order meanwhile.
 */
export function useDayListDnd({ blocks, todayKey, keepTime, moveBetweenDays, ordered, setPending, clearPending }: DayListDndOptions): ListDnd {
  const apply = useDayDrop();
  return useMemo<ListDnd>(() => {
    const entries: ListEntry[] = blocks.flatMap((block) =>
      block.tasks.filter((task) => task.completedAt === null).map((task) => ({ id: task.id, parentId: null, container: block.container })),
    );
    const overdue = new Set(blocks.filter((block) => block.container === OVERDUE_BLOCK).flatMap((block) => block.tasks.map((task) => task.id)));
    return {
      canDrag: (task) => task.completedAt === null && (ordered || moveBetweenDays || overdue.has(task.id)),
      onDrop: (task, target) => {
        const placement = placeDrop(entries, task.id, target);
        if (!placement) return;
        const plan = planDayDrop(task, placement, { dayOf: (container) => dayOfContainer(container, todayKey), keepTime, ordered });
        if (!plan) return;
        setPending({ task, anchor: ordered ? anchorOf(entries, task.id, null, placement) : {}, ...(plan.due ? { patch: plan.due } : {}) });
        apply(task, plan, todayKey).catch(clearPending);
      },
    };
  }, [blocks, todayKey, keepTime, moveBetweenDays, ordered, setPending, clearPending, apply]);
}

/** Today: Overdue (drag out only) + today's block. */
export function useTodayDnd(options: {
  overdue: readonly Task[];
  today: readonly Task[];
  todayKey: string;
  ordered: boolean;
  setPending: (drop: PendingDrop) => void;
  clearPending: () => void;
}): ListDnd {
  const { overdue, today, ...rest } = options;
  const blocks = useMemo(
    () => [
      { container: OVERDUE_BLOCK, tasks: overdue },
      { container: TODAY_BLOCK, tasks: today },
    ],
    [overdue, today],
  );
  return useDayListDnd({ blocks, keepTime: false, moveBetweenDays: false, ...rest });
}
