import i18n from '../../i18n';
import { addDays, isoWeekday, type DeadlineLabel, type DueLabel } from './index';

const WEEKDAY_NAMES: ReadonlyArray<() => string> = [
  () => i18n.t('dates.weekday.mon'),
  () => i18n.t('dates.weekday.tue'),
  () => i18n.t('dates.weekday.wed'),
  () => i18n.t('dates.weekday.thu'),
  () => i18n.t('dates.weekday.fri'),
  () => i18n.t('dates.weekday.sat'),
  () => i18n.t('dates.weekday.sun'),
];

const WEEKDAY_SHORT: ReadonlyArray<() => string> = [
  () => i18n.t('dates.weekdayShort.mon'),
  () => i18n.t('dates.weekdayShort.tue'),
  () => i18n.t('dates.weekdayShort.wed'),
  () => i18n.t('dates.weekdayShort.thu'),
  () => i18n.t('dates.weekdayShort.fri'),
  () => i18n.t('dates.weekdayShort.sat'),
  () => i18n.t('dates.weekdayShort.sun'),
];

export function weekdayName(dateKey: string): string {
  return WEEKDAY_NAMES[isoWeekday(dateKey) - 1]();
}

/** "T2" … "CN" for the week strip. */
export function weekdayShort(dateKey: string): string {
  return WEEKDAY_SHORT[isoWeekday(dateKey) - 1]();
}

/** "25/10", or "25/10/2027" when asked for the year. */
export function formatDateKey(dateKey: string, withYear: boolean): string {
  const [year, month, day] = dateKey.split('-');
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

/** "Tháng 10, 2026" (week strip, calendar). */
export function monthTitle(dateKey: string): string {
  const [year, month] = dateKey.split('-');
  return i18n.t('dates.monthTitle', { month: Number(month), year });
}

export function formatDueLabel(label: DueLabel): string {
  let day: string;
  switch (label.kind) {
    case 'today':
      day = i18n.t('dates.today');
      break;
    case 'tomorrow':
      day = i18n.t('dates.tomorrow');
      break;
    case 'yesterday':
      day = i18n.t('dates.yesterday');
      break;
    case 'weekday':
      day = weekdayName(label.dateKey);
      break;
    default:
      day = formatDateKey(label.dateKey, !label.sameYear);
  }
  if (!label.time) return day;
  return label.endTime ? `${day} ${label.time}–${label.endTime}` : `${day} ${label.time}`;
}

/** Upcoming day header, e.g. "24/10 · Ngày mai · Thứ Bảy" or "25/10 · Chủ nhật". */
export function formatDayHeader(dateKey: string, todayKey: string): string {
  const date = formatDateKey(dateKey, dateKey.slice(0, 4) !== todayKey.slice(0, 4));
  const weekday = weekdayName(dateKey);
  if (dateKey === todayKey) return `${date} · ${i18n.t('dates.today')} · ${weekday}`;
  if (dateKey === addDays(todayKey, 1)) return `${date} · ${i18n.t('dates.tomorrow')} · ${weekday}`;
  return `${date} · ${weekday}`;
}

/** "30 phút", "1 giờ", "1 giờ 30 phút". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return i18n.t('dates.duration.minutes', { n: rest });
  if (rest === 0) return i18n.t('dates.duration.hours', { n: hours });
  return i18n.t('dates.duration.hoursMinutes', { h: hours, m: rest });
}

/** "Còn 3 ngày" / "Hạn chót hôm nay" / "Trễ hạn chót 3 ngày" (spec 5.2). */
export function formatDeadline(label: DeadlineLabel): string {
  if (label.daysLeft > 0) return i18n.t('dates.deadline.daysLeft', { n: label.daysLeft });
  if (label.daysLeft === 0) return i18n.t('dates.deadline.today');
  return i18n.t('dates.deadline.overdue', { n: -label.daysLeft });
}
