import type { Task } from '../../api/models';
import { combineDue, dueTime, taskDateKey } from '../../lib/dates';

/** The due trio that always travels together (spec 12.3: sending a due replaces the whole due). */
export interface DueValue {
  dueDate: string | null;
  dueDatetime: string | null;
  durationMinutes: number | null;
}

export const NO_DUE: DueValue = { dueDate: null, dueDatetime: null, durationMinutes: null };

/** Choices of the duration row (1–1440 allowed by the server). */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180] as const;

export function dueValueOf(task: Pick<Task, 'dueDate' | 'dueDatetime' | 'durationMinutes'>): DueValue {
  return { dueDate: task.dueDate, dueDatetime: task.dueDatetime, durationMinutes: task.durationMinutes };
}

/** Another day, same time and duration. */
export function withDate(value: DueValue, dateKey: string): DueValue {
  return { ...combineDue(dateKey, dueTime(value)), durationMinutes: dueTime(value) ? value.durationMinutes : null };
}

/** A time ("HH:mm") on the due day, or on `fallbackDay` (today) without due. */
export function withTime(value: DueValue, time: string, fallbackDay: string): DueValue {
  return { ...combineDue(taskDateKey(value) ?? fallbackDay, time), durationMinutes: value.durationMinutes };
}

/** Back to all-day: the server drops the duration too (spec 5.2), so does the app. */
export function withoutTime(value: DueValue): DueValue {
  const day = taskDateKey(value);
  return day ? { dueDate: day, dueDatetime: null, durationMinutes: null } : NO_DUE;
}

/** A duration only exists with a time (spec 5.2). */
export function withDuration(value: DueValue, minutes: number | null): DueValue {
  return value.dueDatetime ? { ...value, durationMinutes: minutes } : { ...value, durationMinutes: null };
}

/** The Android time picker answers the wall clock in device local time: keep "HH:mm" as typed. */
export function localTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
