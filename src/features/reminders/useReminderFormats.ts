import { useSettings } from '../settings/useSettings';
import { readLabelFormats, type LabelFormats } from './reminderLabel';

/** Date / time format used to label reminders: the account's dateFormat / timeFormat (me/settings), DMY + 24 h by default. */
export function useReminderFormats(): LabelFormats {
  const { settings } = useSettings();
  return readLabelFormats(settings);
}
