import type { TFunction } from 'i18next';
import { addDays } from '../../lib/dates';
import { formatDateKey, weekdayShort } from '../../lib/dates/format';
import type { RecurrenceSpec, Weekday } from '../../lib/recurrence/types';

const ORDER: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const WORKDAYS = 'MO,TU,WE,TH,FR';

/** Short weekday name in the UI language (2026-10-19 is a Monday). */
const weekdayName = (weekday: Weekday) => weekdayShort(addDays('2026-10-19', ORDER.indexOf(weekday)));

function ordinal(value: number, t: TFunction): string {
  return value === -1 ? t('quickAdd.recurrence.ordinalLast') : t(`quickAdd.recurrence.ordinal${value}`);
}

function base(spec: RecurrenceSpec, t: TFunction): string {
  const n = spec.interval;
  const days = spec.byDay ?? [];
  switch (spec.freq) {
    case 'DAILY':
      return n > 1 ? t('quickAdd.recurrence.dailyN', { n }) : t('quickAdd.recurrence.daily');
    case 'WEEKLY': {
      if (days.length === 0) return n > 1 ? t('quickAdd.recurrence.weeklyN', { n }) : t('quickAdd.recurrence.weekly');
      if (n === 1 && days.map((day) => day.weekday).join(',') === WORKDAYS) return t('quickAdd.recurrence.workdays');
      const names = days.map((day) => weekdayName(day.weekday)).join(', ');
      return n > 1 ? t('quickAdd.recurrence.weeklyNOn', { n, days: names }) : t('quickAdd.recurrence.weeklyOn', { days: names });
    }
    case 'MONTHLY':
      if (spec.bySetPos === -1) return t('quickAdd.recurrence.monthlyLastWorkday');
      if (spec.byMonthDay?.[0] === -1) return t('quickAdd.recurrence.monthlyLastDay');
      if (spec.byMonthDay?.length) return t('quickAdd.recurrence.monthlyDay', { day: spec.byMonthDay[0] });
      if (days[0]?.ordinal !== undefined) {
        return t('quickAdd.recurrence.monthlyOrdinal', { ordinal: ordinal(days[0].ordinal, t), weekday: weekdayName(days[0].weekday) });
      }
      return n > 1 ? t('quickAdd.recurrence.monthlyN', { n }) : t('quickAdd.recurrence.monthly');
    case 'YEARLY':
      if (spec.byMonth?.length && spec.byMonthDay?.length) {
        const key = `2024-${String(spec.byMonth[0]).padStart(2, '0')}-${String(spec.byMonthDay[0]).padStart(2, '0')}`;
        return t('quickAdd.recurrence.yearlyOn', { date: formatDateKey(key, false) });
      }
      return n > 1 ? t('quickAdd.recurrence.yearlyN', { n }) : t('quickAdd.recurrence.yearly');
  }
}

/** "every Mon, Wed", "every 3rd Fri", "every month after completion until 01/12"… for the Repeat chip. */
export function recurrenceLabel(spec: RecurrenceSpec, t: TFunction): string {
  let rule = base(spec, t);
  if (spec.fromCompletion) rule = t('quickAdd.recurrence.fromCompletion', { rule });
  if (spec.untilDate) rule = t('quickAdd.recurrence.until', { rule, date: formatDateKey(spec.untilDate, false) });
  return rule;
}
