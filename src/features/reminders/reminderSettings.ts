import type { PlanSettings } from '../../lib/reminders';

/** M12: Snooze length when the server did not send one yet (kept at 15 like M4; Todoist uses 30 — pending decision). */
export const DEFAULT_SNOOZE_MINUTES = 15;
/** M12: values of me/settings.snoozeMinutes. */
export const SNOOZE_MINUTE_CHOICES = [5, 10, 15, 30, 45, 60, 120, 180] as const;

/** What the reminder runtime reads from me/settings (spec 12.1.1). */
export interface ReminderRuntimeSettings extends PlanSettings {
  /** null = automatic reminders off. Changing it changes the server-computed fire times. */
  autoReminderMinutes: number | null;
  /** M12: minutes of the Snooze button. */
  snoozeMinutes: number;
  /** M12: reminders stay in the tray until tapped. */
  pinReminders: boolean;
  /** M12: install id of the device that rings urgent reminders (null = none). */
  urgentDeviceId: string | null;
  /** M12: this device is urgentDeviceId (filled in by ReminderHost once the install id is known). */
  urgentHere?: boolean;
}

/** The slice of me/settings the runtime needs. Structural, so it fits the M3 settings type once that lands. */
export interface ReminderSettingsSource {
  remindersEnabled?: boolean;
  autoReminderMinutes?: number | null;
  timeZone: string;
  snoozeMinutes?: number;
  pinReminders?: boolean;
  urgentDeviceId?: string | null;
}

/** null = unknown (cache written before the reminder fields existed): never read that as "disabled". */
export function toReminderRuntimeSettings(settings: ReminderSettingsSource): ReminderRuntimeSettings | null {
  if (typeof settings.remindersEnabled !== 'boolean') return null;
  return {
    enabled: settings.remindersEnabled,
    timeZone: settings.timeZone,
    autoReminderMinutes: settings.autoReminderMinutes ?? null,
    snoozeMinutes: typeof settings.snoozeMinutes === 'number' ? settings.snoozeMinutes : DEFAULT_SNOOZE_MINUTES,
    pinReminders: settings.pinReminders === true,
    urgentDeviceId: settings.urgentDeviceId ?? null,
  };
}
