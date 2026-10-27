import type { DateSettings } from './settings';

/**
 * Date rules of spec 5.1 / 5.2, pure: every function takes `now` and the account time zone explicitly.
 * Timed dues are FLOATING ("yyyy-MM-ddTHH:mm:ss", no zone): their day and time are read as written; only "now"
 * and "today" depend on the account zone.
 */

export interface DueFields {
  /** yyyy-MM-dd, all-day due. */
  dueDate: string | null;
  /** Floating "yyyy-MM-ddTHH:mm:ss". */
  dueDatetime: string | null;
  durationMinutes?: number | null;
  completedAt?: string | null;
}

function partsInZone(instant: Date, timeZone: string): Record<string, string> {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const part of format.formatToParts(instant)) parts[part.type] = part.value;
  return parts;
}

/** Calendar day "yyyy-MM-dd" of `instant` in `timeZone`. */
export function dateKeyInZone(instant: Date, timeZone: string): string {
  const p = partsInZone(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Wall clock of `instant` in `timeZone`, in the same shape as a floating dueDatetime. */
export function nowLocal(instant: Date, timeZone: string): string {
  const p = partsInZone(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

function toUtcDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(dateKey: string, days: number): string {
  const date = toUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(dateKey: string): number {
  const day = toUtcDate(dateKey).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

/** Every day from `from` to `to`, both included; [] when `to` is before `from`. */
export function dayRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Due day of a task, or null without due. */
export function taskDateKey(task: DueFields): string | null {
  if (task.dueDate) return task.dueDate;
  if (task.dueDatetime) return task.dueDatetime.slice(0, 10);
  return null;
}

/** "HH:mm" of a timed due, null for all-day / no due. */
export function dueTime(task: DueFields): string | null {
  return task.dueDatetime ? task.dueDatetime.slice(11, 16) : null;
}

/** All-day due on `dateKey`, or a floating timed due when `time` ("HH:mm") is given. */
export function combineDue(dateKey: string, time: string | null): { dueDate: string | null; dueDatetime: string | null } {
  return time ? { dueDate: null, dueDatetime: `${dateKey}T${time}:00` } : { dueDate: dateKey, dueDatetime: null };
}

/**
 * `isOverdue` of spec 5.1 — ONLY for painting the due red: timed → local time passed (even earlier today);
 * all-day → before today; completed / no due → never. NOT the rule of the Overdue block (see isInOverdueBlock).
 */
export function isTaskOverdue(task: DueFields, now: Date, timeZone: string): boolean {
  if (task.completedAt) return false;
  if (task.dueDatetime) return task.dueDatetime < nowLocal(now, timeZone);
  if (task.dueDate) return task.dueDate < dateKeyInZone(now, timeZone);
  return false;
}

/**
 * The Overdue BLOCK of Today / Upcoming and the scope of Reschedule (spec 5.1, 3.1): open task whose due DAY is before
 * today in the account zone, timed or not. A timed task that is late only within today belongs to the Today block.
 */
export function isInOverdueBlock(task: DueFields, now: Date, timeZone: string): boolean {
  if (task.completedAt) return false;
  const day = taskDateKey(task);
  return day !== null && day < dateKeyInZone(now, timeZone);
}

/** Today view = Overdue block + Today block (late timed tasks of today stay in Today), each keeping the server order. */
export function groupTodayView<T extends DueFields>(tasks: readonly T[], now: Date, timeZone: string) {
  const overdue: T[] = [];
  const today: T[] = [];
  for (const task of tasks) (isInOverdueBlock(task, now, timeZone) ? overdue : today).push(task);
  return { overdue, today };
}

/** One entry per due day, ascending; tasks without due are left out; order inside a day is kept. */
export function groupByDueDate<T extends DueFields>(tasks: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const task of tasks) {
    const key = taskDateKey(task);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** First day of the week containing `dateKey`, weeks starting on ISO weekday `startDay`. */
export function weekStart(dateKey: string, startDay: number): string {
  return addDays(dateKey, -((isoWeekday(dateKey) - startDay + 7) % 7));
}

/** The 7 days of the week starting at `startKey`. */
export function weekDays(startKey: string): string[] {
  return dayRange(startKey, addDays(startKey, 6));
}

/** Month `month` (1–12) of `year` as weeks of 7 cells (null = day of another month), weeks start on `startDay`. */
export function monthGrid(year: number, month: number, startDay: number): (string | null)[][] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: (isoWeekday(first) - startDay + 7) % 7 }, () => null);
  for (let day = 1; day <= lastDay; day += 1) cells.push(addDays(first, day - 1));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export interface QuickDates {
  today: string;
  tomorrow: string;
  /** Nearest `weekendStartDay` AFTER today (Saturday / Sunday → next Saturday, spec 5.2). */
  thisWeekend: string;
  /** The `nextWeek` weekday of the following week. */
  nextWeek: string;
}

export function quickDates(todayKey: string, settings: DateSettings): QuickDates {
  const weekday = isoWeekday(todayKey);
  const daysAhead = (settings.weekendStartDay - weekday + 7) % 7 || 7;
  const thisWeekend = addDays(todayKey, daysAhead);
  const nextWeekStart = addDays(weekStart(todayKey, settings.startDay), 7);
  const nextWeek = weekDays(nextWeekStart).find((day) => isoWeekday(day) === settings.nextWeek) ?? nextWeekStart;
  return { today: todayKey, tomorrow: addDays(todayKey, 1), thisWeekend, nextWeek };
}

/** Upcoming loads DAY WINDOWS (spec 12.3): 14 days by default, the server accepts up to 31. */
export const UPCOMING_WINDOW_DAYS = 14;

/** Last day Upcoming may show: today + 2 years (29 February clamps to 28 February, like java.time). */
export function upcomingLimit(todayKey: string): string {
  const [year, month, day] = todayKey.split('-').map(Number);
  const target = year + 2;
  const lastDay = new Date(Date.UTC(target, month, 0)).getUTCDate();
  return `${target}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export interface DayWindow {
  from: string;
  to: string;
}

/** The window of `UPCOMING_WINDOW_DAYS` days starting at `fromKey`, cut at `upcomingLimit`; null when `fromKey` is past it. */
export function nextUpcomingWindow(fromKey: string, todayKey: string): DayWindow | null {
  const limit = upcomingLimit(todayKey);
  if (fromKey > limit) return null;
  const to = addDays(fromKey, UPCOMING_WINDOW_DAYS - 1);
  return { from: fromKey, to: to > limit ? limit : to };
}

export type DueKind = 'today' | 'tomorrow' | 'yesterday' | 'weekday' | 'date';

export interface DueLabel {
  kind: DueKind;
  dateKey: string;
  /** "HH:mm" for timed tasks. */
  time: string | null;
  /** "HH:mm" = time + duration (wraps past midnight), null without duration. */
  endTime: string | null;
  sameYear: boolean;
}

function addMinutes(time: string, minutes: number): string {
  const [hour, minute] = time.split(':').map(Number);
  const total = (hour * 60 + minute + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** What a task row shows; formatDueLabel (format.ts) turns it into text. */
export function describeDue(task: DueFields, now: Date, timeZone: string): DueLabel | null {
  const dateKey = taskDateKey(task);
  if (!dateKey) return null;
  const today = dateKeyInZone(now, timeZone);
  let kind: DueKind = 'date';
  if (dateKey === today) kind = 'today';
  else if (dateKey === addDays(today, 1)) kind = 'tomorrow';
  else if (dateKey === addDays(today, -1)) kind = 'yesterday';
  else if (dateKey > today && dateKey <= addDays(today, 6)) kind = 'weekday';
  const time = dueTime(task);
  const endTime = time && task.durationMinutes ? addMinutes(time, task.durationMinutes) : null;
  return { kind, dateKey, time, endTime, sameYear: dateKey.slice(0, 4) === today.slice(0, 4) };
}

export interface DeadlineLabel {
  dateKey: string;
  /** Days from today to the deadline: 0 = today, negative = passed (shown red). */
  daysLeft: number;
}

export function describeDeadline(deadlineDate: string | null, now: Date, timeZone: string): DeadlineLabel | null {
  if (!deadlineDate) return null;
  return { dateKey: deadlineDate, daysLeft: daysBetween(dateKeyInZone(now, timeZone), deadlineDate) };
}
