import { warnLog, type ReminderLog } from './syncReminders';
import type { ReminderPermission, ReminderRequest, ReminderScheduler, ScheduledReminder } from './types';

/** Snooze / Complete buttons on a reminder notification (spec 5.8). */
export interface ReminderActionLabels {
  snooze: string;
  complete: string;
}

export type ReminderTapAction = 'open' | 'snooze' | 'complete';

/** What the user did with a reminder notification. */
export interface ReminderTap {
  action: ReminderTapAction;
  taskId: string;
  /** Identifier of the notification (to dismiss it from the tray). */
  notificationId: string;
  title: string;
}

/**
 * Everything the reminder feature needs from the OS notification layer. The app talks only to this port; the
 * implementation backed by `expo-notifications` (channel, category buttons, permission, scheduler, taps) is
 * installed once at startup with setReminderPlatform(). Until then the "unavailable" platform below is used, so
 * the rest of the feature (sync logic, editors, settings) runs and is testable without the native module.
 */
export interface ReminderPlatform {
  scheduler: ReminderScheduler;
  /** Android 13+ shows the permission prompt only once a channel exists, so call this before asking. */
  ensureChannel(name: string): Promise<void>;
  configureActions(labels: ReminderActionLabels): Promise<void>;
  /** Reminders also show as a banner while the app is in the foreground. Call once at startup. */
  configurePresentation(): void;
  getPermission(): Promise<ReminderPermission>;
  /** Shows the system prompt (POST_NOTIFICATIONS on Android 13+). */
  requestPermission(): Promise<ReminderPermission>;
  /** Android 14+ leaves exact alarms off until the user allows them (spec 5.8, 17, 18.1 I12). */
  needsExactAlarmGrant(): boolean;
  /** The system "Alarms & reminders" page; the app settings page when that fails. Never throws. */
  openExactAlarmSettings(): Promise<void>;
  /** The response that opened the app (cold start), consumed once. */
  takeLastTap(): ReminderTap | null;
  /** Responses while the app runs. Returns an unsubscribe function. */
  addTapListener(onTap: (tap: ReminderTap) => void): () => void;
  /** Removes a shown notification from the tray. Never throws. */
  dismiss(notificationId: string): Promise<void>;
  /** Sign-out / session end: drop every reminder. Never throws. */
  cancelAll(): Promise<void>;
}

const noopScheduler: ReminderScheduler = {
  listScheduled: async (): Promise<ScheduledReminder[]> => [],
  schedule: async (_request: ReminderRequest) => undefined,
  cancel: async () => undefined,
  cancelAll: async () => undefined,
};

/** Used when no notification module is installed: nothing can be shown, so permission is never granted. */
export const unavailableReminderPlatform: ReminderPlatform = {
  scheduler: noopScheduler,
  ensureChannel: async () => undefined,
  configureActions: async () => undefined,
  configurePresentation: () => undefined,
  getPermission: async () => ({ status: 'denied', granted: false, canAskAgain: false }),
  requestPermission: async () => ({ status: 'denied', granted: false, canAskAgain: false }),
  needsExactAlarmGrant: () => false,
  openExactAlarmSettings: async () => undefined,
  takeLastTap: () => null,
  addTapListener: () => () => undefined,
  dismiss: async () => undefined,
  cancelAll: async () => undefined,
};

let current: ReminderPlatform = unavailableReminderPlatform;

export function getReminderPlatform(): ReminderPlatform {
  return current;
}

/** Install the real implementation (startup) or a fake (tests). Pass null to restore the unavailable platform. */
export function setReminderPlatform(platform: ReminderPlatform | null): void {
  current = platform ?? unavailableReminderPlatform;
}

/** Sign-out / session end: drop every reminder, whatever the platform does. Never throws. */
export async function cancelAllReminders(log: ReminderLog = warnLog): Promise<void> {
  try {
    await current.cancelAll();
  } catch (error) {
    log(`cancel all reminders failed: ${error instanceof Error ? error.name : 'unknown error'}`);
  }
}
