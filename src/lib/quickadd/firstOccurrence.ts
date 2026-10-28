import { addDays, addMonthsClamped, isoWeekday } from '../dates';
import type { RecurrenceSpec } from '../recurrence/types';
import { RRULE_DAYS } from './grammar';

/**
 * First due day of a repeat, on or after `start` — only so the Quick Add chip can show "Monday" for "every monday"
 * (Todoist). NOT the next-occurrence rule: that is M6c (BE RecurrenceService, mobile lib/recurrence/next.ts).
 */
export function firstOccurrence(spec: RecurrenceSpec, start: string): string {
  const candidates = (from: string, months: number) =>
    Array.from({ length: months }, (_, index) => monthDays(spec, monthOf(addMonthsClamped(firstOfMonth(from), index))))
      .flat()
      .filter((day) => day >= from)
      .sort();
  if (spec.freq === 'WEEKLY' && spec.byDay?.length) {
    for (let offset = 0; offset < 7; offset += 1) {
      const day = addDays(start, offset);
      if (spec.byDay.some((entry) => RRULE_DAYS[isoWeekday(day) - 1] === entry.weekday)) return day;
    }
  }
  if (spec.freq === 'MONTHLY' && (spec.byDay?.length || spec.byMonthDay?.length)) {
    return candidates(start, 3)[0] ?? start;
  }
  if (spec.freq === 'YEARLY' && spec.byMonth?.length && spec.byMonthDay?.length) {
    const year = Number(start.slice(0, 4));
    for (const candidateYear of [year, year + 1, year + 2, year + 3, year + 4]) {
      const day = validKey(candidateYear, spec.byMonth[0], spec.byMonthDay[0]);
      if (day && day >= start) return day;
    }
  }
  return start;
}

const pad = (value: number) => String(value).padStart(2, '0');
const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
const monthOf = (day: string) => ({ year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) });
const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function validKey(year: number, month: number, day: number): string | null {
  return day >= 1 && day <= lastDayOf(year, month) ? `${year}-${pad(month)}-${pad(day)}` : null;
}

/** Days of one month a MONTHLY rule hits (BYMONTHDAY, BYDAY with ordinal, BYDAY + BYSETPOS). */
function monthDays(spec: RecurrenceSpec, { year, month }: { year: number; month: number }): string[] {
  const last = lastDayOf(year, month);
  if (spec.byMonthDay?.length) {
    return spec.byMonthDay
      .map((day) => validKey(year, month, day === -1 ? last : day))
      .filter((day): day is string => day !== null);
  }
  const all = Array.from({ length: last }, (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`);
  const byDay = spec.byDay ?? [];
  if (spec.bySetPos !== undefined) {
    const hits = all.filter((day) => byDay.some((entry) => RRULE_DAYS[isoWeekday(day) - 1] === entry.weekday));
    const picked = spec.bySetPos < 0 ? hits[hits.length + spec.bySetPos] : hits[spec.bySetPos - 1];
    return picked ? [picked] : [];
  }
  return byDay.flatMap((entry) => {
    const hits = all.filter((day) => RRULE_DAYS[isoWeekday(day) - 1] === entry.weekday);
    if (entry.ordinal === undefined) return hits;
    const picked = entry.ordinal < 0 ? hits[hits.length + entry.ordinal] : hits[entry.ordinal - 1];
    return picked ? [picked] : [];
  });
}
