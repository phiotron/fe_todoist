import type { Task, UpdateTaskRequest } from '../../api/models';
import { taskDateKey } from '../../lib/dates';
import { dueValueOf, withDate, type DueValue } from '../schedule/dueValue';
import type { Placement } from './listDrop';

/**
 * DND in the dated lists (Today / Upcoming): what a drop changes. Another day = PATCH of the due trio only (a repeating
 * task keeps its rule: no recurrence field is sent, so only the current occurrence moves); same day = the day order
 * (`POST reorder {type: TASK_DAY}`), only while the list is sorted by date ascending without grouping.
 */

export interface DayDropPlan {
  /** The day the task ends up on. */
  day: string;
  /** Set when the due changes. */
  due?: DueValue;
  /** Set when the day order changes: the task goes right after this one (null = first of the day). */
  reorderAfterId?: string | null;
}

export interface DayDropOptions {
  /** The day of a container key, null = not a day (Overdue, ...): nothing can be dropped there. */
  dayOf: (container: string) => string | null;
  /** Upcoming: true (same time on the new day); Today Overdue → today: false (the user asked for a plain date). */
  keepTime: boolean;
  /** The list shows the day order (sort = date ascending, no grouping). */
  ordered: boolean;
}

/** 'today' → today, 'd-YYYY-MM-DD' → that day (Upcoming), anything else → null. */
export function dayOfContainer(container: string, today: string): string | null {
  if (container === 'today') return today;
  if (container.startsWith('d-')) return container.slice(2);
  return null;
}

export function planDayDrop(task: Task, placement: Placement, options: DayDropOptions): DayDropPlan | null {
  const day = options.dayOf(placement.container);
  if (!day) return null;
  const plan: DayDropPlan = { day };
  if (taskDateKey(task) !== day) {
    plan.due = options.keepTime
      ? withDate(dueValueOf(task), day)
      : { dueDate: day, dueDatetime: null, durationMinutes: null };
  }
  if (options.ordered) plan.reorderAfterId = placement.afterId;
  return plan.due || plan.reorderAfterId !== undefined ? plan : null;
}

/** Undo of a due change: the old due, the text typed for it and (only when there was one) its fixed zone. */
export function undoDueBody(before: Task): Omit<UpdateTaskRequest, 'version'> {
  const body: Omit<UpdateTaskRequest, 'version'> = {
    dueDate: before.dueDate,
    dueDatetime: before.dueDatetime,
    durationMinutes: before.durationMinutes,
    dueString: before.dueString,
  };
  if (before.dueTimezone) body.dueTimezone = before.dueTimezone;
  return body;
}
