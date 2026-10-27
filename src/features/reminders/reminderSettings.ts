import type { PlanSettings } from '../../lib/reminders';

/** What the reminder runtime reads from me/settings (spec 12.1.1). */
export interface ReminderRuntimeSettings extends PlanSettings {
  /** null = automatic reminders off. Changing it changes the server-computed fire times. */
  autoReminderMinutes: number | null;
}

/** The slice of me/settings the runtime needs. Structural, so it fits the M3 settings type once that lands. */
export interface ReminderSettingsSource {
  remindersEnabled?: boolean;
  autoReminderMinutes?: number | null;
  timeZone: string;
}

/** null = unknown (cache written before the reminder fields existed): never read that as "disabled". */
export function toReminderRuntimeSettings(settings: ReminderSettingsSource): ReminderRuntimeSettings | null {
  if (typeof settings.remindersEnabled !== 'boolean') return null;
  return {
    enabled: settings.remindersEnabled,
    timeZone: settings.timeZone,
    autoReminderMinutes: settings.autoReminderMinutes ?? null,
  };
}
