import type { RecurrenceSpec, Weekday } from './types';

/**
 * RRULE rút gọn (contract 8.1) — cùng tập con, cùng dạng chuẩn với backend `RecurrenceRule`: FREQ; INTERVAL (bỏ khi 1);
 * BYMONTH; BYMONTHDAY; BYDAY; BYSETPOS; UNTIL (yyyyMMdd). Không tiền tố "RRULE:", không COUNT / BYHOUR / BYMINUTE.
 */

export const WEEKDAY_CODES: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const MAX_INTERVAL = 999;
const MAX_LENGTH = 500;
const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
const KEYS = ['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'BYSETPOS', 'UNTIL'];

export class InvalidRecurrenceError extends Error {
  constructor(rule: string) {
    super(`Unsupported repeat rule: ${rule}`);
    this.name = 'InvalidRecurrenceError';
  }
}

export function toRRule(spec: RecurrenceSpec): string {
  const parts = [`FREQ=${spec.freq}`];
  if (spec.interval !== 1) parts.push(`INTERVAL=${spec.interval}`);
  if (spec.byMonth?.length) parts.push(`BYMONTH=${spec.byMonth.join(',')}`);
  if (spec.byMonthDay?.length) parts.push(`BYMONTHDAY=${spec.byMonthDay.join(',')}`);
  if (spec.byDay?.length) parts.push(`BYDAY=${spec.byDay.map((d) => `${d.ordinal ?? ''}${d.weekday}`).join(',')}`);
  if (spec.bySetPos !== undefined) parts.push(`BYSETPOS=${spec.bySetPos}`);
  if (spec.untilDate) parts.push(`UNTIL=${spec.untilDate.replace(/-/g, '')}`);
  return parts.join(';');
}

/** `fromCompletion` is not part of the rule string (it is a separate field): the result always has it false. */
export function fromRRule(rule: string): RecurrenceSpec {
  const fail = (): never => {
    throw new InvalidRecurrenceError(rule);
  };
  if (typeof rule !== 'string' || rule.length === 0 || rule.length > MAX_LENGTH) return fail();
  const parts = new Map<string, string>();
  for (const part of rule.split(';')) {
    const match = /^([A-Z]+)=([A-Z0-9,-]+)$/.exec(part);
    if (!match || parts.has(match[1])) return fail();
    parts.set(match[1], match[2]);
  }
  if (![...parts.keys()].every((key) => KEYS.includes(key)) || !parts.has('FREQ')) return fail();
  const freq = FREQS.find((candidate) => candidate === parts.get('FREQ'));
  if (!freq) return fail();

  const integer = (text: string): number => (/^-?[0-9]{1,3}$/.test(text) ? Number(text) : fail());
  const intList = (text: string, allowLast: boolean, min: number, max: number): number[] => {
    const values = text.split(',').map(integer);
    const ok = values.every((n) => (allowLast && n === -1) || (n >= min && n <= max));
    return ok && new Set(values).size === values.length ? values : fail();
  };

  const interval = parts.has('INTERVAL') ? integer(parts.get('INTERVAL') as string) : 1;
  if (interval < 1 || interval > MAX_INTERVAL) return fail();

  let byDay: RecurrenceSpec['byDay'];
  if (parts.has('BYDAY')) {
    const items = (parts.get('BYDAY') as string).split(',');
    if (new Set(items).size !== items.length) return fail();
    byDay = items.map((item) => {
      const match = /^(-1|[1-4])?(MO|TU|WE|TH|FR|SA|SU)$/.exec(item);
      if (!match || (match[1] !== undefined && (freq === 'DAILY' || freq === 'WEEKLY'))) return fail();
      return match[1] === undefined
        ? { weekday: match[2] as Weekday }
        : { weekday: match[2] as Weekday, ordinal: Number(match[1]) };
    });
  }
  let byMonthDay: number[] | undefined;
  if (parts.has('BYMONTHDAY')) {
    if (freq === 'WEEKLY') return fail();
    byMonthDay = intList(parts.get('BYMONTHDAY') as string, true, 1, 31);
  }
  const byMonth = parts.has('BYMONTH') ? intList(parts.get('BYMONTH') as string, false, 1, 12) : undefined;
  let bySetPos: number | undefined;
  if (parts.has('BYSETPOS')) {
    bySetPos = integer(parts.get('BYSETPOS') as string);
    if (!byDay || !(bySetPos === -1 || (bySetPos >= 1 && bySetPos <= 4))) return fail();
  }
  let untilDate: string | undefined;
  if (parts.has('UNTIL')) {
    const match = /^([0-9]{4})([0-9]{2})([0-9]{2})$/.exec(parts.get('UNTIL') as string);
    if (!match) return fail();
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    const key = `${match[1]}-${match[2]}-${match[3]}`;
    if (date.toISOString().slice(0, 10) !== key) return fail();
    untilDate = key;
  }
  return {
    freq,
    interval,
    ...(byDay ? { byDay } : {}),
    ...(byMonthDay ? { byMonthDay } : {}),
    ...(byMonth ? { byMonth } : {}),
    ...(bySetPos !== undefined ? { bySetPos } : {}),
    ...(untilDate ? { untilDate } : {}),
    fromCompletion: false,
  };
}
