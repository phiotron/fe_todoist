import { addDays, dateKeyInZone, daysBetween, isoWeekday } from '../dates';
import { WEEKDAY_CODES } from './rrule';
import type { RecurrenceSpec } from './types';

/**
 * Next occurrence of a repeating task, for PREVIEW only (Repeat sheet): the server (`RecurrenceService`) decides the
 * real next due. Same algorithm and the same shared vectors (`__fixtures__/recurrence-vectors.json`, contract 8.3):
 * change one side, change the other.
 *
 * "Today" = the day of `completedOn` in the ACCOUNT time zone. `every` (fromCompletion false): first occurrence after
 * max(due, today), periods aligned on the due. `every!`: no BY* part → today + N units (clamped to the end of a short
 * month); with BY* → first occurrence after today. A missing anchor (BYDAY of a WEEKLY, BYMONTHDAY of a MONTHLY, …) is
 * the due's weekday / day / month. After UNTIL → null (the cycle is over).
 */

const MAX_PERIODS = 5_000;
type Freq = RecurrenceSpec['freq'];

const WEEKDAY_NUMBER: Record<string, number> = Object.fromEntries(WEEKDAY_CODES.map((code, index) => [code, index + 1]));

function ymd(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

function key(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function lengthOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function clamp(y: number, m: number, d: number): string {
  return key(y, m, Math.min(d, lengthOfMonth(y, m)));
}

function endOfMonth(y: number, m: number): string {
  return key(y, m, lengthOfMonth(y, m));
}

/** 31 Jan + 1 month = 28 Feb; 29 Feb + 1 year = 28 Feb. */
function plusMonths(dateKey: string, months: number): string {
  const [y, m, d] = ymd(dateKey);
  const total = y * 12 + (m - 1) + months;
  return clamp(Math.floor(total / 12), (((total % 12) + 12) % 12) + 1, d);
}

function plus(day: string, freq: Freq, interval: number): string {
  switch (freq) {
    case 'DAILY':
      return addDays(day, interval);
    case 'WEEKLY':
      return addDays(day, 7 * interval);
    case 'MONTHLY':
      return plusMonths(day, interval);
    default:
      return plusMonths(day, 12 * interval);
  }
}

function periodStart(freq: Freq, day: string): string {
  const [y, m] = ymd(day);
  switch (freq) {
    case 'DAILY':
      return day;
    case 'WEEKLY':
      return addDays(day, -(isoWeekday(day) - 1)); // week starts on Monday
    case 'MONTHLY':
      return key(y, m, 1);
    default:
      return key(y, 1, 1);
  }
}

function units(freq: Freq, from: string, to: string): number {
  const [fy, fm] = ymd(from);
  const [ty, tm] = ymd(to);
  switch (freq) {
    case 'DAILY':
      return daysBetween(from, to);
    case 'WEEKLY':
      return Math.trunc(daysBetween(from, to) / 7);
    case 'MONTHLY':
      return ty * 12 + tm - (fy * 12 + fm);
    default:
      return ty - fy;
  }
}

function monthDays(days: readonly number[], y: number, m: number): string[] {
  return days.map((day) => (day === -1 ? endOfMonth(y, m) : clamp(y, m, day)));
}

function weekdaysOfMonth(byDay: NonNullable<RecurrenceSpec['byDay']>, y: number, m: number): string[] {
  const found: string[] = [];
  const length = lengthOfMonth(y, m);
  for (const item of byDay) {
    const number = WEEKDAY_NUMBER[item.weekday];
    const first = 1 + ((number - isoWeekday(key(y, m, 1)) + 7) % 7);
    if (item.ordinal === undefined) {
      for (let d = first; d <= length; d += 7) found.push(key(y, m, d));
    } else if (item.ordinal === -1) {
      let d = first;
      while (d + 7 <= length) d += 7;
      found.push(key(y, m, d));
    } else {
      const d = first + 7 * (item.ordinal - 1);
      if (d <= length) found.push(key(y, m, d));
    }
  }
  return found;
}

function monthCandidates(spec: RecurrenceSpec, y: number, m: number, anchor: string): string[] {
  const fromDays = spec.byMonthDay?.length ? monthDays(spec.byMonthDay, y, m) : null;
  const fromWeekdays = spec.byDay?.length ? weekdaysOfMonth(spec.byDay, y, m) : null;
  if (!fromDays && !fromWeekdays) return [clamp(y, m, ymd(anchor)[2])];
  if (!fromDays) return fromWeekdays as string[];
  if (!fromWeekdays) return fromDays;
  return fromDays.filter((day) => fromWeekdays.includes(day));
}

function matchesDay(spec: RecurrenceSpec, day: string): boolean {
  const [y, m] = ymd(day);
  if (spec.byMonth?.length && !spec.byMonth.includes(m)) return false;
  if (spec.byMonthDay?.length && !monthDays(spec.byMonthDay, y, m).includes(day)) return false;
  return !spec.byDay?.length || spec.byDay.some((item) => WEEKDAY_NUMBER[item.weekday] === isoWeekday(day));
}

function candidates(spec: RecurrenceSpec, start: string, anchor: string): string[] {
  const found = new Set<string>();
  const [y, m] = ymd(start);
  switch (spec.freq) {
    case 'DAILY':
      if (matchesDay(spec, start)) found.add(start);
      break;
    case 'WEEKLY': {
      const numbers = spec.byDay?.length
        ? spec.byDay.map((item) => WEEKDAY_NUMBER[item.weekday])
        : [isoWeekday(anchor)];
      for (const number of numbers) {
        const day = addDays(start, number - 1);
        if (!spec.byMonth?.length || spec.byMonth.includes(ymd(day)[1])) found.add(day);
      }
      break;
    }
    case 'MONTHLY':
      if (!spec.byMonth?.length || spec.byMonth.includes(m)) monthCandidates(spec, y, m, anchor).forEach((d) => found.add(d));
      break;
    default: {
      const months = spec.byMonth?.length ? spec.byMonth : [ymd(anchor)[1]];
      for (const month of months) monthCandidates(spec, y, month, anchor).forEach((d) => found.add(d));
    }
  }
  const sorted = [...found].sort();
  if (spec.bySetPos === undefined || sorted.length === 0) return sorted;
  if (spec.bySetPos === -1) return [sorted[sorted.length - 1]];
  return spec.bySetPos <= sorted.length ? [sorted[spec.bySetPos - 1]] : [];
}

function firstAfter(spec: RecurrenceSpec, anchor: string, threshold: string): string | null {
  const first = periodStart(spec.freq, anchor);
  const skip = Math.max(0, Math.trunc(units(spec.freq, first, periodStart(spec.freq, threshold)) / spec.interval));
  for (let k = skip; k < skip + MAX_PERIODS; k += 1) {
    const amount = k * spec.interval;
    const start =
      spec.freq === 'DAILY'
        ? addDays(first, amount)
        : spec.freq === 'WEEKLY'
          ? addDays(first, 7 * amount)
          : plusMonths(first, spec.freq === 'MONTHLY' ? amount : 12 * amount);
    if (spec.untilDate && start > spec.untilDate) return null;
    const hit = candidates(spec, start, anchor).find((candidate) => candidate > threshold);
    if (hit) return hit;
  }
  return null;
}

function hasByParts(spec: RecurrenceSpec): boolean {
  return !!(spec.byDay?.length || spec.byMonthDay?.length || spec.byMonth?.length);
}

/**
 * Next due after completing on `completedOn`. `due` = "yyyy-MM-dd" or floating "yyyy-MM-ddTHH:mm[:ss]"; the answer has
 * the same shape (time of day kept); null = the cycle ended (past UNTIL).
 */
export function nextDue(spec: RecurrenceSpec, due: string, completedOn: Date, timeZone: string): string | null {
  const dueDay = due.slice(0, 10);
  const time = due.length > 10 ? due.slice(11).padEnd(8, ':00').slice(0, 8) : null;
  const today = dateKeyInZone(completedOn, timeZone);
  let next: string | null;
  if (spec.fromCompletion && !hasByParts(spec)) next = plus(today, spec.freq, spec.interval);
  else if (spec.fromCompletion) next = firstAfter(spec, today, today);
  else next = firstAfter(spec, dueDay, dueDay > today ? dueDay : today);
  if (next === null || (spec.untilDate && next > spec.untilDate)) return null;
  return time ? `${next}T${time}` : next;
}
