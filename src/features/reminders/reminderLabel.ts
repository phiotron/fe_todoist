import type { TFunction } from 'i18next';
import { describeOffset, formatFloatingForDisplay, type DateFormat, type TimeFormat } from '../../lib/reminders';

export interface LabelFormats {
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

/** Server reminder (ReminderResponse) or a draft (Quick Add). */
export interface LabelledReminder {
  type: 'ABSOLUTE' | 'RELATIVE' | 'LOCATION';
  at?: string | null;
  minuteOffset?: number | null;
  /** M12 */
  urgent?: boolean;
  /** M12 LOCATION: draft field `trigger`, server field `locationTrigger`. */
  trigger?: 'ON_ENTER' | 'ON_LEAVE';
  locationTrigger?: 'ON_ENTER' | 'ON_LEAVE' | null;
  /** M12 LOCATION: name of the saved place (drafts carry it; server reminders get it from the locations list). */
  locationName?: string;
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
  if (reminder.type === 'LOCATION') {
    const trigger = reminder.trigger ?? reminder.locationTrigger ?? 'ON_ENTER';
    const place = reminder.locationName ?? t('reminders.location.unknownPlace');
    return t(trigger === 'ON_LEAVE' ? 'reminders.location.leaveLabel' : 'reminders.location.enterLabel', { place });
  }
  const base =
    reminder.type === 'RELATIVE'
      ? offsetLabel(reminder.minuteOffset ?? 0, t)
      : (formatFloatingForDisplay(reminder.at ?? '', formats.dateFormat, formats.timeFormat) ?? reminder.at ?? '');
  return reminder.urgent ? t('reminders.urgent.label', { label: base }) : base;
}

/** Reminders chip text (design M-TaskDetail shows the value): none → "Reminders", one → it, more → first + " +N". */
export function reminderChipLabel(labels: readonly string[], t: TFunction): string {
  if (labels.length === 0) return t('reminders.chip.label');
  if (labels.length === 1) return labels[0];
  return t('reminders.chip.more', { label: labels[0], count: labels.length - 1 });
}
