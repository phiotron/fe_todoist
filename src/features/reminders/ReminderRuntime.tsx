import type { ReminderRuntimeSettings } from './reminderSettings';
import { useReminderResponses } from './useReminderResponses';
import { useReminderSync } from './useReminderSync';

/**
 * Mounted once inside the signed-in layout; renders nothing. `settings` comes from me/settings through
 * toReminderRuntimeSettings (null while unknown). The layout supplies it once the settings source (M3 useSettings)
 * exists; until then the runtime is not mounted. M12: the Snooze length and Pin reminders come from the same settings.
 */
export function ReminderRuntime({ settings }: { settings: ReminderRuntimeSettings | null }) {
  useReminderSync(settings);
  useReminderResponses({ snoozeMinutes: settings?.snoozeMinutes, pinReminders: settings?.pinReminders });
  return null;
}
