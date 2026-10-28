import i18n from '../../i18n';
import { formatDateKey } from '../dates/format';
import type { RecurrenceSpec, Weekday } from './types';

/** Text of a rule for the task detail and the Repeat sheet ("Every 2 weeks on Mon", "Every month on day 31, until 31/12/2026"). */

const WEEKDAY_NAME: Record<Weekday, () => string> = {
  MO: () => i18n.t('dates.weekday.mon'),
  TU: () => i18n.t('dates.weekday.tue'),
  WE: () => i18n.t('dates.weekday.wed'),
  TH: () => i18n.t('dates.weekday.thu'),
  FR: () => i18n.t('dates.weekday.fri'),
  SA: () => i18n.t('dates.weekday.sat'),
  SU: () => i18n.t('dates.weekday.sun'),
};

const NTH: Record<string, () => string> = {
  '1': () => i18n.t('recurrence.describe.nth.1'),
  '2': () => i18n.t('recurrence.describe.nth.2'),
  '3': () => i18n.t('recurrence.describe.nth.3'),
  '4': () => i18n.t('recurrence.describe.nth.4'),
  '-1': () => i18n.t('recurrence.describe.nth.last'),
};

const WORKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR'];

export function weekdayName(code: Weekday): string {
  return WEEKDAY_NAME[code]();
}

function isWorkdays(spec: RecurrenceSpec): boolean {
  const days = spec.byDay ?? [];
  return (
    days.length === 5 &&
    days.every((item) => item.ordinal === undefined) &&
    WORKDAYS.every((code) => days.some((item) => item.weekday === code))
  );
}

/** Day + month without a year (the display format setting decides the order). */
function dayMonth(month: number, day: number): string {
  return formatDateKey(`2000-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, false);
}

function base(spec: RecurrenceSpec): string {
  const n = spec.interval;
  const one = n === 1;
  const days = spec.byDay ?? [];
  const monthDays = spec.byMonthDay ?? [];
  const months = spec.byMonth ?? [];
  switch (spec.freq) {
    case 'DAILY':
      return one ? i18n.t('recurrence.describe.daily') : i18n.t('recurrence.describe.everyNDays', { n });
    case 'WEEKLY': {
      if (isWorkdays(spec)) {
        return one ? i18n.t('recurrence.describe.weekdays') : i18n.t('recurrence.describe.weekdaysEveryNWeeks', { n });
      }
      if (days.length === 0) return one ? i18n.t('recurrence.describe.weekly') : i18n.t('recurrence.describe.everyNWeeks', { n });
      const list = days.map((item) => weekdayName(item.weekday)).join(', ');
      return one
        ? i18n.t('recurrence.describe.weeklyOn', { days: list })
        : i18n.t('recurrence.describe.everyNWeeksOn', { n, days: list });
    }
    case 'MONTHLY': {
      if (spec.bySetPos === -1 && isWorkdays(spec) && one) return i18n.t('recurrence.describe.lastWorkday');
      if (days.length === 1 && days[0].ordinal !== undefined && monthDays.length === 0 && one) {
        return i18n.t('recurrence.describe.monthlyNth', { day: weekdayName(days[0].weekday), nth: NTH[String(days[0].ordinal)]() });
      }
      if (monthDays.length > 0 && days.length === 0) {
        if (monthDays.length === 1 && monthDays[0] === -1) {
          return one ? i18n.t('recurrence.describe.monthlyLastDay') : i18n.t('recurrence.describe.everyNMonthsLastDay', { n });
        }
        const list = monthDays.join(', ');
        return one
          ? i18n.t('recurrence.describe.monthlyDay', { days: list })
          : i18n.t('recurrence.describe.everyNMonthsDay', { n, days: list });
      }
      if (days.length === 0) return one ? i18n.t('recurrence.describe.monthly') : i18n.t('recurrence.describe.everyNMonths', { n });
      return i18n.t('recurrence.describe.custom');
    }
    default: {
      if (days.length === 1 && days[0].ordinal !== undefined && months.length === 1 && one) {
        return i18n.t('recurrence.describe.yearlyNth', {
          day: weekdayName(days[0].weekday),
          nth: NTH[String(days[0].ordinal)](),
          month: months[0],
        });
      }
      if (days.length === 0 && months.length === 1 && monthDays.length === 1 && monthDays[0] !== -1) {
        const date = dayMonth(months[0], monthDays[0]);
        return one ? i18n.t('recurrence.describe.yearlyOn', { date }) : i18n.t('recurrence.describe.everyNYearsOn', { n, date });
      }
      if (days.length === 0 && months.length === 0 && monthDays.length === 0) {
        return one ? i18n.t('recurrence.describe.yearly') : i18n.t('recurrence.describe.everyNYears', { n });
      }
      return i18n.t('recurrence.describe.custom');
    }
  }
}

export function describeRecurrence(spec: RecurrenceSpec): string {
  const parts = [base(spec)];
  if (spec.untilDate) parts.push(i18n.t('recurrence.describe.until', { date: formatDateKey(spec.untilDate, true) }));
  if (spec.fromCompletion) parts.push(i18n.t('recurrence.describe.fromCompletion'));
  return parts.join(', ');
}
