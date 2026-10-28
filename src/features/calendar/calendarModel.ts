import type { Task, TaskBatchRequest, UpdateTaskRequest } from '../../api/models';
import { addDays, addMonthsClamped, daysBetween, dayRange, taskDateKey, weekStart } from '../../lib/dates';

/**
 * M7 Calendar (plan M7 F4). Pure: which days a mode shows, where timed tasks sit in the time grid, and what a drop
 * sends. Agenda / 3 days / Week / Month; the server window of a mode is at most 42 days (GET tasks?view=calendar).
 */
export type CalendarMode = 'AGENDA' | 'THREE_DAYS' | 'WEEK' | 'MONTH';
export const CALENDAR_MODES: readonly CalendarMode[] = ['AGENDA', 'THREE_DAYS', 'WEEK', 'MONTH'];
export const DEFAULT_CALENDAR_MODE: CalendarMode = 'WEEK';

/** Height of one hour in the time grid; a slot (drop granularity) is 30 minutes. */
export const HOUR_HEIGHT = 56;
export const SLOT_MINUTES = 30;
/** Duration given to a task dropped on a time slot, and the drawn height of a timed task without duration. */
export const DEFAULT_DURATION = 30;
export const AGENDA_DAYS = 14;
const DAY_MINUTES = 24 * 60;

function firstOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

/** The days a mode shows around `anchor` (a day of the shown period). Month = whole weeks, 35 or 42 days. */
export function visibleDays(mode: CalendarMode, anchor: string, startDay: number): string[] {
  switch (mode) {
    case 'AGENDA':
      return dayRange(anchor, addDays(anchor, AGENDA_DAYS - 1));
    case 'THREE_DAYS':
      return dayRange(anchor, addDays(anchor, 2));
    case 'WEEK': {
      const first = weekStart(anchor, startDay);
      return dayRange(first, addDays(first, 6));
    }
    default: {
      const first = firstOfMonth(anchor);
      const last = addDays(addMonthsClamped(first, 1), -1);
      const gridStart = weekStart(first, startDay);
      const weeks = Math.ceil((daysBetween(gridStart, last) + 1) / 7);
      return dayRange(gridStart, addDays(gridStart, weeks * 7 - 1));
    }
  }
}

/** The server window of a mode: first and last visible day. */
export function windowOf(mode: CalendarMode, anchor: string, startDay: number): { from: string; to: string } {
  const days = visibleDays(mode, anchor, startDay);
  return { from: days[0], to: days[days.length - 1] };
}

/** The anchor after the ‹ › buttons: one period back / forward. */
export function shiftAnchor(mode: CalendarMode, anchor: string, delta: 1 | -1): string {
  switch (mode) {
    case 'AGENDA':
      return addDays(anchor, AGENDA_DAYS * delta);
    case 'THREE_DAYS':
      return addDays(anchor, 3 * delta);
    case 'WEEK':
      return addDays(anchor, 7 * delta);
    default:
      return addMonthsClamped(firstOfMonth(anchor), delta);
  }
}

/** Minutes after midnight of a timed due, null for all-day / no due. */
export function minutesOfDue(task: Pick<Task, 'dueDatetime'>): number | null {
  if (!task.dueDatetime) return null;
  const hours = Number(task.dueDatetime.slice(11, 13));
  const minutes = Number(task.dueDatetime.slice(14, 16));
  return hours * 60 + minutes;
}

export interface DayTasks {
  allDay: Task[];
  timed: Task[];
}

/** One day's tasks split into the "All day" row and the time grid; timed ones by start time. */
export function tasksOfDay(tasks: readonly Task[], day: string): DayTasks {
  const allDay: Task[] = [];
  const timed: Task[] = [];
  for (const task of tasks) {
    if (taskDateKey(task) !== day) continue;
    (task.dueDatetime ? timed : allDay).push(task);
  }
  timed.sort((a, b) => (minutesOfDue(a) ?? 0) - (minutesOfDue(b) ?? 0));
  return { allDay, timed };
}

export interface Placement {
  task: Task;
  top: number;
  height: number;
  /** Overlapping tasks share the width: lane `lane` of `lanes`. */
  lane: number;
  lanes: number;
}

/** Position of timed tasks in the time grid of one day; overlapping tasks sit side by side. A task ends at 24:00 at the latest. */
export function placeTimed(timed: readonly Task[]): Placement[] {
  const items = timed.map((task) => {
    const start = minutesOfDue(task) ?? 0;
    const end = Math.min(DAY_MINUTES, start + Math.max(task.durationMinutes ?? DEFAULT_DURATION, SLOT_MINUTES));
    return { task, start, end: Math.max(end, start + 1) };
  });
  const result: Placement[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.end;
      return { item, lane };
    });
    for (const { item, lane } of assigned) {
      result.push({
        task: item.task,
        top: (item.start / 60) * HOUR_HEIGHT,
        height: ((item.end - item.start) / 60) * HOUR_HEIGHT,
        lane,
        lanes: laneEnds.length,
      });
    }
    cluster = [];
  };
  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = cluster.length === 1 ? item.end : Math.max(clusterEnd, item.end);
  }
  if (cluster.length > 0) flush();
  return result;
}

/** The 30-minute slot (minutes after midnight) under a vertical position of the day's time grid. */
export function slotMinutes(y: number): number {
  const slot = Math.floor(y / ((HOUR_HEIGHT * SLOT_MINUTES) / 60));
  return Math.min(DAY_MINUTES - SLOT_MINUTES, Math.max(0, slot * SLOT_MINUTES));
}

/** "HH:mm" of minutes after midnight. */
export function clockLabel(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Time blocking (spec 3.2): dropping a task on a time slot gives it that day + time and a duration — the task's own
 * when it has one, else 30 minutes. PATCH with the version the card was drawn from (409 when stale).
 */
export function planSlotDrop(task: Pick<Task, 'version' | 'durationMinutes'>, day: string, minutes: number): UpdateTaskRequest {
  return {
    version: task.version,
    dueDatetime: `${day}T${clockLabel(minutes)}:00`,
    durationMinutes: task.durationMinutes ?? DEFAULT_DURATION,
  };
}

/** Dropping on a day (month cell, agenda day, "All day" row): schedule on that day; timed tasks keep their time (batch SCHEDULE). */
export function planDayDrop(taskIds: readonly string[], day: string): TaskBatchRequest {
  return { action: 'SCHEDULE', taskIds: [...taskIds], date: day };
}

/** Month cells show this many task names, then "+N". */
export const MONTH_CELL_TASKS = 3;
