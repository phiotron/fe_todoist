import type { TFunction } from 'i18next';
import { describeOffset, formatFloatingForDisplay, type DateFormat, type TimeFormat } from '../../lib/reminders';

export interface LabelFormats {
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

/** Server reminder (ReminderResponse) or a draft (Quick Add). */
export interface LabelledReminder {
  type: 'ABSOLUTE' | 'RELATIVE';
  at?: string | null;
  minuteOffset?: number | null;
}

/** me/settings date / time format (M3), DMY + 24 h when unknown. */
export function readLabelFormats(settings: { dateFormat?: string | null; timeFormat?: string | null } | null | undefined): LabelFormats {
  return {
    dateFormat: settings?.dateFormat === 'MDY' ? 'MDY' : 'DMY',
    timeFormat: settings?.timeFormat === 'H12' ? 'H12' : 'H24',
  };
}

export function offsetLabel(minutes: number, t: TFunction): string {
  const { unit, count } = describeOffset(minutes);
  switch (unit) {
    case 'atTime':
      return t('reminders.offset.atTime');
    case 'minutes':
      return t('reminders.offset.minutes', { count });
    case 'hours':
      return t('reminders.offset.hours', { count });
    case 'days':
      return t('reminders.offset.days', { count });
  }
}

export function reminderLabel(reminder: LabelledReminder, t: TFunction, formats: LabelFormats): string {
  if (reminder.type === 'RELATIVE') return offsetLabel(reminder.minuteOffset ?? 0, t);
  const at = reminder.at ?? '';
  return formatFloatingForDisplay(at, formats.dateFormat, formats.timeFormat) ?? at;
}

/** Reminders chip text (design M-TaskDetail shows the value): none → "Reminders", one → it, more → first + " +N". */
export function reminderChipLabel(labels: readonly string[], t: TFunction): string {
  if (labels.length === 0) return t('reminders.chip.label');
  if (labels.length === 1) return labels[0];
  return t('reminders.chip.more', { label: labels[0], count: labels.length - 1 });
}
