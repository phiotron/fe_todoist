import { addDays, addMonthsClamped, isoWeekday, quickDates, weekStart } from '../dates';
import type { RecurrenceSpec, Weekday } from '../recurrence/types';
import type { ParseContext } from './types';

/**
 * English date grammar of Quick Add (Todoist syntax, spec 3.2 M6b). Works on the LOWER-CASED text with offsets equal
 * to the original text. Every phrase must end at a word boundary.
 */

const END = '(?=$|[\\s,.;:!?)\\]}])';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7,
  july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12,
  december: 12,
};

/** ISO weekday 1 = Monday … 7 = Sunday. */
const WEEKDAYS: Record<string, number> = {
  mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4,
  thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 7, sunday: 7,
};

export const RRULE_DAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const WORKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR'];

const alternation = (words: string[]) => [...words].sort((a, b) => b.length - a.length).join('|');
const MONTH = `(${alternation(Object.keys(MONTHS))})`;
const WEEKDAY = `(${alternation(Object.keys(WEEKDAYS))})`;
const ORD = '(?:st|nd|rd|th)';

function sticky(source: string): RegExp {
  return new RegExp(source, 'y');
}

function at(re: RegExp, text: string, index: number): RegExpExecArray | null {
  re.lastIndex = index;
  return re.exec(text);
}

const pad = (value: number) => String(value).padStart(2, '0');

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateKey(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Day + month without a year: this year, or next year when already past (29/02 → next leap-valid year only). */
function inferYear(month: number, day: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  const thisYear = dateKey(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return dateKey(year + 1, month, day);
}

function explicitYear(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return raw.length === 2 ? 2000 + value : value;
}

function nextWeekday(today: string, weekday: number): string {
  return addDays(today, ((weekday - isoWeekday(today) + 7) % 7) || 7);
}

/** "HH:mm" from 12-hour / 24-hour parts; null when out of range. */
function clock(hourText: string, minuteText: string | undefined, suffix: string | undefined): string | null {
  let hour = Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  if (minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (suffix === 'pm' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return `${pad(hour)}:${pad(minute)}`;
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

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
}

export interface Phrase extends PhraseValue {
  end: number;
}

// ---- dates ---------------------------------------------------------------------------------------------------------

const RE = {
  today: sticky(`(?:on\\s+)?(today|tod)${END}`),
  tomorrow: sticky(`(?:on\\s+)?(tomorrow|tmrw|tmr)${END}`),
  yesterday: sticky(`(?:on\\s+)?yesterday${END}`),
  nextWeek: sticky(`next\\s+week${END}`),
  weekend: sticky(`(?:this\\s+)?weekend${END}`),
  nextWeekday: sticky(`(?:on\\s+)?next\\s+${WEEKDAY}${END}`),
  weekday: sticky(`(?:on\\s+)?(?:this\\s+)?${WEEKDAY}${END}`),
  inUnits: sticky(`in\\s+(\\d{1,3})\\s+(days?|weeks?|months?|years?)${END}`),
  iso: sticky(`(?:on\\s+)?(\\d{4})-(\\d{2})-(\\d{2})${END}`),
  // Only "/" (not "."): "chapter 1.5" must stay text.
  numeric: sticky(`(?:on\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?${END}`),
  monthDay: sticky(`(?:on\\s+)?${MONTH}\\.?\\s+(\\d{1,2})${ORD}?(?:,?\\s+(\\d{4}))?${END}`),
  dayMonth: sticky(`(?:on\\s+)?(\\d{1,2})${ORD}?\\s+${MONTH}(?:,?\\s+(\\d{4}))?${END}`),
  // ---- times
  range: sticky(
    `(?:at\\s+|from\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s?(am|pm)?\\s?-\\s?(\\d{1,2})(?::(\\d{2}))?\\s?(am|pm)?${END}`,
  ),
  time: sticky(`(at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s?(am|pm)?${END}`),
  timeWord: sticky(`(?:at\\s+)?(noon|midday|midnight)${END}`),
  duration: sticky(`for\\s+(\\d+(?:\\.\\d+)?)\\s?(minutes|minute|mins|min|m|hours|hour|hrs|hr|h)${END}`),
  // ---- repeats
  every: sticky('every(!)?\\s+'),
  everyOther: sticky(`other\\s+(day|week|month|year)${END}`),
  everyOtherWeekday: sticky(`other\\s+${WEEKDAY}${END}`),
  everyUnit: sticky(`(day|week|month|year)${END}`),
  everyWorkday: sticky(`(?:weekday|workday)${END}`),
  everyCount: sticky(`(\\d{1,3})\\s+(days?|weeks?|months?|years?)${END}`),
  everyLastDay: sticky(`last\\s+day${END}`),
  everyLastWorkday: sticky(`last\\s+(?:workday|weekday)${END}`),
  everyOrdinalWeekday: sticky(`(first|second|third|fourth|last|1st|2nd|3rd|4th)\\s+${WEEKDAY}${END}`),
  everyMonthDay: sticky(`(\\d{1,2})${ORD}(?:\\s+day)?${END}`),
  everyWeekday: sticky(`${WEEKDAY}${END}`),
  weekdaySeparator: sticky(`\\s*,\\s*(?:and\\s+)?|\\s+and\\s+|\\s*&\\s*`),
  starting: sticky('(?:starting|from)\\s+'),
  until: sticky('(?:until|ending)\\s+'),
  forCount: sticky(`for\\s+(\\d{1,3})\\s+(days?|weeks?|months?|years?)${END}`),
};

function addUnits(date: string, count: number, unit: string): string {
  if (unit.startsWith('day')) return addDays(date, count);
  if (unit.startsWith('week')) return addDays(date, count * 7);
  if (unit.startsWith('month')) return addMonthsClamped(date, count);
  return addMonthsClamped(date, count * 12);
}

/** One date-only phrase at `index` (no time, no repeat). */
export function matchDate(text: string, index: number, ctx: ParseContext): Phrase | null {
  const { today } = ctx;
  let m: RegExpExecArray | null;
  const end = (match: RegExpExecArray) => index + match[0].length;
  if ((m = at(RE.today, text, index))) return { end: end(m), date: today };
  if ((m = at(RE.tomorrow, text, index))) return { end: end(m), date: addDays(today, 1) };
  if ((m = at(RE.yesterday, text, index))) return { end: end(m), date: addDays(today, -1) };
  if ((m = at(RE.nextWeek, text, index))) return { end: end(m), date: quickDates(today, ctx.dateSettings).nextWeek };
  if ((m = at(RE.weekend, text, index))) return { end: end(m), date: quickDates(today, ctx.dateSettings).thisWeekend };
  if ((m = at(RE.nextWeekday, text, index))) {
    const start = addDays(weekStart(today, ctx.dateSettings.startDay), 7);
    const target = WEEKDAYS[m[1]];
    return { end: end(m), date: addDays(start, (target - ctx.dateSettings.startDay + 7) % 7) };
  }
  if ((m = at(RE.weekday, text, index))) return { end: end(m), date: nextWeekday(today, WEEKDAYS[m[1]]) };
  if ((m = at(RE.inUnits, text, index))) {
    const count = Number(m[1]);
    return count > 0 ? { end: end(m), date: addUnits(today, count, m[2]) } : null;
  }
  if ((m = at(RE.iso, text, index))) {
    const date = dateKey(Number(m[1]), Number(m[2]), Number(m[3]));
    return date ? { end: end(m), date } : null;
  }
  if ((m = at(RE.numeric, text, index))) {
    const [first, second] = [Number(m[1]), Number(m[2])];
    const [day, month] = ctx.dateFormat === 'DMY' ? [first, second] : [second, first];
    const year = explicitYear(m[3]);
    const date = year ? dateKey(year, month, day) : inferYear(month, day, today);
    return date ? { end: end(m), date } : null;
  }
  if ((m = at(RE.monthDay, text, index))) {
    const year = explicitYear(m[3]);
    const date = year ? dateKey(year, MONTHS[m[1]], Number(m[2])) : inferYear(MONTHS[m[1]], Number(m[2]), today);
    return date ? { end: end(m), date } : null;
  }
  if ((m = at(RE.dayMonth, text, index))) {
    const year = explicitYear(m[3]);
    const date = year ? dateKey(year, MONTHS[m[2]], Number(m[1])) : inferYear(MONTHS[m[2]], Number(m[1]), today);
    return date ? { end: end(m), date } : null;
  }
  return null;
}

/** One time phrase (with an optional range = duration) at `index`. */
export function matchTime(text: string, index: number): Phrase | null {
  let m: RegExpExecArray | null;
  if ((m = at(RE.range, text, index))) {
    const endTime = clock(m[4], m[5], m[6]);
    let startTime = clock(m[1], m[2], m[3] ?? m[6]);
    if (endTime && startTime && !m[3] && m[6] && toMinutes(startTime) > toMinutes(endTime)) {
      startTime = clock(m[1], m[2], m[6] === 'pm' ? 'am' : 'pm');
    }
    if (startTime && endTime) {
      let duration = toMinutes(endTime) - toMinutes(startTime);
      if (duration <= 0) duration += 24 * 60;
      return { end: index + m[0].length, time: startTime, duration };
    }
  }
  if ((m = at(RE.timeWord, text, index))) {
    return { end: index + m[0].length, time: m[1] === 'midnight' ? '00:00' : '12:00' };
  }
  if ((m = at(RE.time, text, index))) {
    // A bare number is a time only after "at" (Todoist: "17" alone is text, "17:00" / "5pm" / "at 9" are times).
    if (!m[1] && m[3] === undefined && !m[4]) return null;
    const time = clock(m[2], m[3], m[4]);
    return time ? { end: index + m[0].length, time } : null;
  }
  return null;
}

function matchDuration(text: string, index: number): Phrase | null {
  const m = at(RE.duration, text, index);
  if (!m) return null;
  const amount = Number(m[1]);
  const minutes = Math.round(m[2].startsWith('h') ? amount * 60 : amount);
  return minutes >= 1 && minutes <= 24 * 60 ? { end: index + m[0].length, duration: minutes } : null;
}

// ---- repeats -------------------------------------------------------------------------------------------------------

const FREQ_OF: Record<string, RecurrenceSpec['freq']> = { day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' };
const ORDINALS: Record<string, number> = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, last: -1 };

const weekdayCode = (word: string): Weekday => RRULE_DAYS[WEEKDAYS[word] - 1];
const unitFreq = (unit: string) => FREQ_OF[unit.replace(/s$/, '')];

function matchEveryBody(text: string, index: number, fromCompletion: boolean): { end: number; spec: RecurrenceSpec } | null {
  const base = { interval: 1, fromCompletion };
  let m: RegExpExecArray | null;
  const end = (match: RegExpExecArray) => index + match[0].length;
  if ((m = at(RE.everyOther, text, index))) return { end: end(m), spec: { freq: FREQ_OF[m[1]], ...base, interval: 2 } };
  if ((m = at(RE.everyOtherWeekday, text, index))) {
    return { end: end(m), spec: { freq: 'WEEKLY', ...base, interval: 2, byDay: [{ weekday: weekdayCode(m[1]) }] } };
  }
  if ((m = at(RE.everyWorkday, text, index))) {
    return { end: end(m), spec: { freq: 'WEEKLY', ...base, byDay: WORKDAYS.map((weekday) => ({ weekday })) } };
  }
  if ((m = at(RE.everyUnit, text, index))) return { end: end(m), spec: { freq: FREQ_OF[m[1]], ...base } };
  if ((m = at(RE.everyCount, text, index))) {
    const interval = Number(m[1]);
    if (interval < 1 || interval > 999) return null;
    return { end: end(m), spec: { freq: unitFreq(m[2]), ...base, interval } };
  }
  if ((m = at(RE.everyLastDay, text, index))) return { end: end(m), spec: { freq: 'MONTHLY', ...base, byMonthDay: [-1] } };
  if ((m = at(RE.everyLastWorkday, text, index))) {
    return {
      end: end(m),
      spec: { freq: 'MONTHLY', ...base, byDay: WORKDAYS.map((weekday) => ({ weekday })), bySetPos: -1 },
    };
  }
  if ((m = at(RE.everyOrdinalWeekday, text, index))) {
    return {
      end: end(m),
      spec: { freq: 'MONTHLY', ...base, byDay: [{ weekday: weekdayCode(m[2]), ordinal: ORDINALS[m[1]] }] },
    };
  }
  if ((m = at(RE.monthDay, text, index))) {
    if (!dateKey(2024, MONTHS[m[1]], Number(m[2])) || m[3]) return null;
    return { end: end(m), spec: { freq: 'YEARLY', ...base, byMonth: [MONTHS[m[1]]], byMonthDay: [Number(m[2])] } };
  }
  if ((m = at(RE.dayMonth, text, index))) {
    if (!dateKey(2024, MONTHS[m[2]], Number(m[1])) || m[3]) return null;
    return { end: end(m), spec: { freq: 'YEARLY', ...base, byMonth: [MONTHS[m[2]]], byMonthDay: [Number(m[1])] } };
  }
  if ((m = at(RE.everyMonthDay, text, index))) {
    const day = Number(m[1]);
    return day >= 1 && day <= 31 ? { end: end(m), spec: { freq: 'MONTHLY', ...base, byMonthDay: [day] } } : null;
  }
  if ((m = at(RE.everyWeekday, text, index))) {
    const days: Weekday[] = [weekdayCode(m[1])];
    let position = end(m);
    for (;;) {
      const separator = at(RE.weekdaySeparator, text, position);
      if (!separator) break;
      const next = at(RE.everyWeekday, text, position + separator[0].length);
      if (!next) break;
      const code = weekdayCode(next[1]);
      if (!days.includes(code)) days.push(code);
      position = position + separator[0].length + next[0].length;
    }
    return { end: position, spec: { freq: 'WEEKLY', ...base, byDay: days.map((weekday) => ({ weekday })) } };
  }
  return null;
}

function matchEvery(text: string, index: number): Phrase | null {
  const every = at(RE.every, text, index);
  if (!every) return null;
  const body = matchEveryBody(text, index + every[0].length, every[1] === '!');
  return body ? { end: body.end, recurrence: { spec: body.spec } } : null;
}

/** starting / until / for N … after a repeat. */
function matchRepeatModifier(text: string, index: number, ctx: ParseContext): Phrase | null {
  let m: RegExpExecArray | null;
  if ((m = at(RE.starting, text, index))) {
    const date = matchDate(text, index + m[0].length, ctx);
    return date?.date ? { end: date.end, recurrence: { spec: emptySpec(), startDate: date.date } } : null;
  }
  if ((m = at(RE.until, text, index))) {
    const date = matchDate(text, index + m[0].length, ctx);
    return date?.date ? { end: date.end, recurrence: { spec: { ...emptySpec(), untilDate: date.date } } } : null;
  }
  if ((m = at(RE.forCount, text, index))) {
    const count = Number(m[1]);
    return count > 0
      ? { end: index + m[0].length, recurrence: { spec: emptySpec(), forCount: { count, unit: m[2] } } }
      : null;
  }
  return null;
}

/** Placeholder spec of a modifier: only its untilDate is merged. */
function emptySpec(): RecurrenceSpec {
  return { freq: 'DAILY', interval: 1, fromCompletion: false };
}

// ---- groups --------------------------------------------------------------------------------------------------------

export interface GroupOptions {
  /** Repeats (every …) allowed: due dates only. */
  repeats: boolean;
  /** Times allowed (due, reminders); deadlines are date-only. */
  times: boolean;
}

function isSpace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char);
}

/**
 * Longest run of date / time / repeat phrases starting at `index`, separated by spaces, each component at most once
 * ("tomorrow 9-10", "next friday at 3pm", "every weekday at 9am starting nov 5"). null when nothing matches or the
 * run would only be a duration.
 */
export function matchGroup(text: string, index: number, ctx: ParseContext, options: GroupOptions): Phrase | null {
  const value: PhraseValue = {};
  let end = index;
  let position = index;
  for (;;) {
    let phrase: Phrase | null = null;
    if (value.recurrence) phrase = matchRepeatModifier(text, position, ctx);
    if (!phrase && options.repeats && !value.recurrence && !value.date) phrase = matchEvery(text, position);
    if (!phrase && options.times && !value.time) phrase = matchTime(text, position);
    if (!phrase && !value.date && !value.recurrence) phrase = matchDate(text, position, ctx);
    if (!phrase && options.times && value.time && value.duration === undefined) phrase = matchDuration(text, position);
    if (!phrase) break;
    if (phrase.recurrence && value.recurrence) {
      const { spec, startDate, forCount } = phrase.recurrence;
      if (startDate) value.recurrence.startDate = startDate;
      if (spec.untilDate) value.recurrence.spec = { ...value.recurrence.spec, untilDate: spec.untilDate };
      if (forCount) value.recurrence.forCount = forCount;
    } else {
      if (phrase.recurrence) value.recurrence = phrase.recurrence;
      if (phrase.date) value.date = phrase.date;
      if (phrase.time) value.time = phrase.time;
      if (phrase.duration !== undefined) value.duration = phrase.duration;
    }
    end = phrase.end;
    position = end;
    while (isSpace(text[position])) position += 1;
    if (position === end) break; // the next phrase must be separated by a space
  }
  if (end === index || (value.date === undefined && value.time === undefined && !value.recurrence)) return null;
  return { end, ...value };
}

/** "for N units" → untilDate = start + N units − 1 day (the last day is included, contract 8.1). */
export function resolveRepeat(value: RecurrenceValue, today: string): { spec: RecurrenceSpec; startDate?: string } {
  const start = value.startDate ?? today;
  const spec = { ...value.spec };
  if (value.forCount && !spec.untilDate) {
    spec.untilDate = addDays(addUnits(start, value.forCount.count, value.forCount.unit), -1);
  }
  return value.startDate ? { spec, startDate: value.startDate } : { spec };
}
