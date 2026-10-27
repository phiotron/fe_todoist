import { readLabelFormats, type LabelFormats } from './reminderLabel';

/**
 * Date / time format used to label reminders. The account's dateFormat / timeFormat settings arrive with M3
 * (me/settings); until then the spec defaults (DMY, 24 h) apply. Call sites already use this hook, so the settings
 * source is swapped in one place.
 */
export function useReminderFormats(): LabelFormats {
  return readLabelFormats(null);
}
