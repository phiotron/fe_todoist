import type { ReminderRuntimeSettings } from './reminderSettings';
import { useReminderResponses } from './useReminderResponses';
import { useReminderSync } from './useReminderSync';

/**
 * Mounted once inside the signed-in layout; renders nothing. `settings` comes from me/settings through
 * toReminderRuntimeSettings (null while unknown). The layout supplies it once the settings source (M3 useSettings)
 * exists; until then the runtime is not mounted.
 */
export function ReminderRuntime({ settings }: { settings: ReminderRuntimeSettings | null }) {
  useReminderSync(settings);
  useReminderResponses();
  return null;
}
