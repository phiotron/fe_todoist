import { isoWeekday } from '../dates';
import { MAX_INTERVAL, WEEKDAY_CODES, toRRule } from './rrule';
import type { RecurrenceSpec, Weekday } from './types';

/**
 * Repeat sheet ↔ RecurrenceSpec. Presets (Every day / week on … / weekday / month on … / year on …) and Custom
 * (Based on Scheduled | Completed date, Every N Days | Weeks | Weekdays | Months | Years, Ends Never | On date — no "after N times", ADR 0006).
 * Rules built here already carry the anchor the server would add (BYDAY / BYMONTHDAY / BYMONTH of the due day) and use
 * the server's canonical text, so the task the server returns compares equal to what was sent.
 */

export type PresetKey = 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'yearly';
export const PRESET_KEYS: readonly PresetKey[] = ['daily', 'weekly', 'weekdays', 'monthly', 'yearly'];

export type RepeatUnit = 'days' | 'weeks' | 'weekdays' | 'months' | 'years';
export const REPEAT_UNITS: readonly RepeatUnit[] = ['days', 'weeks', 'weekdays', 'months', 'years'];

export interface CustomRepeat {
  basedOn: 'scheduled' | 'completed';
  every: number;
  unit: RepeatUnit;
  /** yyyy-MM-dd (included) or null = never. */
  endsOn: string | null;
}

const WORKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR'];
const workdayList = () => WORKDAYS.map((weekday) => ({ weekday }));

function dueParts(dueKey: string): { weekday: Weekday; day: number; month: number } {
  const [, month, day] = dueKey.split('-').map(Number);
  return { weekday: WEEKDAY_CODES[isoWeekday(dueKey) - 1], day, month };
}

export function presetSpec(key: PresetKey, dueKey: string): RecurrenceSpec {
  const { weekday, day, month } = dueParts(dueKey);
  const base = { interval: 1, fromCompletion: false };
  switch (key) {
    case 'daily':
      return { ...base, freq: 'DAILY' };
    case 'weekly':
      return { ...base, freq: 'WEEKLY', byDay: [{ weekday }] };
    case 'weekdays':
      return { ...base, freq: 'WEEKLY', byDay: workdayList() };
    case 'monthly':
      return { ...base, freq: 'MONTHLY', byMonthDay: [day] };
    default:
      return { ...base, freq: 'YEARLY', byMonth: [month], byMonthDay: [day] };
  }
}

/** The preset a rule is exactly equal to for this due day, or null (then it is a custom rule). */
export function matchPreset(spec: RecurrenceSpec, dueKey: string): PresetKey | null {
  if (spec.fromCompletion) return null;
  const text = toRRule(spec);
  return PRESET_KEYS.find((key) => toRRule(presetSpec(key, dueKey)) === text) ?? null;
}

export function defaultCustom(): CustomRepeat {
  return { basedOn: 'scheduled', every: 1, unit: 'days', endsOn: null };
}

export function isValidEvery(every: number): boolean {
  return Number.isInteger(every) && every >= 1 && every <= MAX_INTERVAL;
}

export function customToSpec(custom: CustomRepeat, dueKey: string): RecurrenceSpec {
  const { weekday, day, month } = dueParts(dueKey);
  const completed = custom.basedOn === 'completed';
  const base = { interval: custom.every, fromCompletion: completed, ...(custom.endsOn ? { untilDate: custom.endsOn } : {}) };
  switch (custom.unit) {
    case 'days':
      return { ...base, freq: 'DAILY' };
    case 'weeks':
      return { ...base, freq: 'WEEKLY', ...(completed ? {} : { byDay: [{ weekday }] }) };
    case 'weekdays':
      return { ...base, freq: 'WEEKLY', byDay: workdayList() };
    case 'months':
      return { ...base, freq: 'MONTHLY', ...(completed ? {} : { byMonthDay: [day] }) };
    default:
      return { ...base, freq: 'YEARLY', ...(completed ? {} : { byMonth: [month], byMonthDay: [day] }) };
  }
}

/**
 * The same choice made for another due day: a rule picked for "every Wednesday" and then moved to a Friday in the same
 * sheet becomes "every Friday". Rules the form cannot show are kept as they are.
 */
export function reanchor(spec: RecurrenceSpec, fromDay: string, toDay: string): RecurrenceSpec {
  if (fromDay === toDay) return spec;
  const preset = matchPreset(spec, fromDay);
  if (preset) return presetSpec(preset, toDay);
  const custom = specToCustom(spec);
  return custom ? customToSpec(custom, toDay) : spec;
}

/** Custom form of a rule, or null when the rule has a shape the form cannot show (e.g. "every 3rd Friday"). */
export function specToCustom(spec: RecurrenceSpec): CustomRepeat | null {
  const common = {
    basedOn: spec.fromCompletion ? ('completed' as const) : ('scheduled' as const),
    every: spec.interval,
    endsOn: spec.untilDate ?? null,
  };
  const days = spec.byDay ?? [];
  const monthDays = spec.byMonthDay ?? [];
  const months = spec.byMonth ?? [];
  const plainDays = days.every((item) => item.ordinal === undefined);
  if (spec.bySetPos !== undefined || !plainDays) return null;
  switch (spec.freq) {
    case 'DAILY':
      return days.length === 0 && monthDays.length === 0 && months.length === 0 ? { ...common, unit: 'days' } : null;
    case 'WEEKLY': {
      if (monthDays.length > 0 || months.length > 0) return null;
      const isWorkdays = days.length === 5 && WORKDAYS.every((code) => days.some((item) => item.weekday === code));
      if (isWorkdays) return { ...common, unit: 'weekdays' };
      return days.length <= 1 ? { ...common, unit: 'weeks' } : null;
    }
    case 'MONTHLY':
      return days.length === 0 && monthDays.length <= 1 && months.length === 0 && monthDays[0] !== -1
        ? { ...common, unit: 'months' }
        : null;
    default:
      return days.length === 0 && monthDays.length <= 1 && months.length <= 1 && monthDays[0] !== -1
        ? { ...common, unit: 'years' }
        : null;
  }
}
