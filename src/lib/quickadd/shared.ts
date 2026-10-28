import { addDays, addMonthsClamped, isoWeekday } from '../dates';
import type { RecurrenceSpec, Weekday } from '../recurrence/types';

/** Helpers shared by the English and the Vietnamese Quick Add grammars. */

export const END = '(?=$|[\\s,.;:!?)\\]}])';

export const RRULE_DAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const WORKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR'];

export function sticky(source: string): RegExp {
  return new RegExp(source, 'y');
}

export function at(re: RegExp, text: string, index: number): RegExpExecArray | null {
  re.lastIndex = index;
  return re.exec(text);
}

export const pad = (value: number) => String(value).padStart(2, '0');

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dateKey(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Day + month without a year: this year, or next year when already past (29/02 → next leap-valid year only). */
export function inferYear(month: number, day: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  const thisYear = dateKey(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return dateKey(year + 1, month, day);
}

export function explicitYear(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return raw.length === 2 ? 2000 + value : value;
}

/** The next `weekday` (ISO 1–7) strictly after today. */
export function nextWeekday(today: string, weekday: number): string {
  return addDays(today, ((weekday - isoWeekday(today) + 7) % 7) || 7);
}

/** `unit` is an English unit name: day(s) / week(s) / month(s) / year(s). */
export function addUnits(date: string, count: number, unit: string): string {
  if (unit.startsWith('day')) return addDays(date, count);
  if (unit.startsWith('week')) return addDays(date, count * 7);
  if (unit.startsWith('month')) return addMonthsClamped(date, count);
  return addMonthsClamped(date, count * 12);
}

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Vietnamese part of the day ("sáng", "trưa", "chiều", "tối", "đêm"). */
export type DayPart = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

export interface RecurrenceValue {
  spec: RecurrenceSpec;
  startDate?: string;
  /** "for N units": turned into untilDate once the start is known. */
  forCount?: { count: number; unit: string };
}

export interface PhraseValue {
  date?: string;
  time?: string;
  duration?: number;
  recurrence?: RecurrenceValue;
  /** A day part given apart from the time ("sáng mai", "mỗi tối"): default time, or shifts a later bare time. */
  dayPart?: DayPart;
}

export interface Phrase extends PhraseValue {
  end: number;
  /** The time already says am/pm or a day part ("5pm", "7h tối"): a separate day part does not shift it. */
  fixed?: boolean;
}

/** Placeholder spec of a repeat modifier: only its untilDate is merged. */
export function emptySpec(): RecurrenceSpec {
  return { freq: 'DAILY', interval: 1, fromCompletion: false };
}
