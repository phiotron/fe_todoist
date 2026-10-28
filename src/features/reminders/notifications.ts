import * as Notifications from 'expo-notifications';
import type { NotificationResponse } from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { getTasklyAndroid } from '../../lib/native/tasklyAndroid';
import { createUrgentAwareScheduler } from './urgentScheduler';
import { errorName, warnLog, type ReminderLog } from './syncReminders';
import { setReminderPlatform, type ReminderActionLabels, type ReminderPlatform, type ReminderTap, type ReminderTapAction } from './platform';
import type { ReminderPermission, ReminderRequest, ReminderScheduler, ScheduledKind, ScheduledReminder } from './types';

/** Android notification channel for task reminders. */
export const REMINDER_CHANNEL_ID = 'reminders';
/** M12: channel of urgent reminders when the native alarm is missing (max importance, rings through Do Not Disturb). */
export const URGENT_CHANNEL_ID = 'urgent-reminders';
/** Notification category carrying the Snooze / Complete buttons (spec 5.8). */
export const REMINDER_CATEGORY_ID = 'task-reminder';
export const SNOOZE_ACTION_ID = 'snooze';
export const COMPLETE_ACTION_ID = 'complete';

const KINDS: readonly ScheduledKind[] = ['AUTO', 'ABSOLUTE', 'RELATIVE', 'SNOOZE'];

type NotificationData = Record<string, unknown> | null | undefined;

function stringOf(data: NotificationData, field: string): string | null {
  const value = data?.[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function kindOf(data: NotificationData): ScheduledKind | null {
  const value = data?.kind;
  return KINDS.includes(value as ScheduledKind) ? (value as ScheduledKind) : null;
}

/** ReminderScheduler backed by expo-notifications. Every scheduled notification of the app is a reminder. */
export const expoReminderScheduler: ReminderScheduler = {
  async listScheduled(): Promise<ScheduledReminder[]> {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests.map((request) => ({
      id: request.identifier,
      taskId: stringOf(request.content.data, 'taskId'),
      kind: kindOf(request.content.data),
      signature: stringOf(request.content.data, 'signature'),
    }));
  },

  async schedule(reminder: ReminderRequest): Promise<void> {
    // Cancel first so a changed reminder never fires twice, whatever the platform does with a reused id.
    await Notifications.cancelScheduledNotificationAsync(reminder.id);
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: { taskId: reminder.taskId, kind: reminder.kind, signature: reminder.signature },
        categoryIdentifier: REMINDER_CATEGORY_ID,
        // M12 Pin reminders (and urgent ones): Android cannot swipe them away; tapping a button still clears them.
        ...(reminder.pinned || reminder.urgent ? { sticky: true } : {}),
        ...(reminder.urgent ? { priority: 'max' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.fireAtMs,
        channelId: reminder.urgent ? URGENT_CHANNEL_ID : REMINDER_CHANNEL_ID,
      },
    });
  },

  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
  cancelAll: () => Notifications.cancelAllScheduledNotificationsAsync(),
};

/**
 * Android 13+ only shows the permission prompt once a channel exists, so call this first. M12: with `urgentName` the
 * urgent channel is created too (max importance, bypasses Do Not Disturb).
 */
export async function ensureReminderChannel(name: string, os: string = Platform.OS, urgentName?: string): Promise<void> {
  if (os !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name,
    importance: Notifications.AndroidImportance.HIGH,
  });
  if (urgentName) {
    await Notifications.setNotificationChannelAsync(URGENT_CHANNEL_ID, {
      name: urgentName,
      importance: Notifications.AndroidImportance.MAX,
      bypassDnd: true,
    });
  }
}

/**
 * Snooze / Complete buttons on every reminder (spec 5.8). Both open the app, which then snoozes or completes:
 * no background JS is needed and it works even when the app process was killed.
 */
export async function configureReminderActions(labels: ReminderActionLabels): Promise<void> {
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [
    { identifier: SNOOZE_ACTION_ID, buttonTitle: labels.snooze, options: { opensAppToForeground: true } },
    { identifier: COMPLETE_ACTION_ID, buttonTitle: labels.complete, options: { opensAppToForeground: true } },
  ]);
}

function toPermission(response: { status: string; granted: boolean; canAskAgain: boolean }): ReminderPermission {
  const status = response.granted ? 'granted' : response.status === 'undetermined' ? 'undetermined' : 'denied';
  return { status, granted: response.granted, canAskAgain: response.canAskAgain };
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  return toPermission(await Notifications.getPermissionsAsync());
}

/** Shows the system prompt (POST_NOTIFICATIONS on Android 13+). */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  return toPermission(await Notifications.requestPermissionsAsync());
}

/**
 * Android 14+ (API 34) leaves SCHEDULE_EXACT_ALARM off until the user allows "Alarms & reminders"; without it
 * expo-notifications falls back to an inexact alarm, so reminders may come a few minutes late (spec 5.8, 17).
 * expo-notifications 58 can tell whether it is allowed, so the Settings hint shows only while it is not (plan
 * Task 7 step 3b). When the question cannot be answered, fall back to "Android 14 and later" (decision 13).
 */
export async function needsExactAlarmGrant(
  os: string = Platform.OS,
  version: string | number = Platform.Version,
): Promise<boolean> {
  if (os !== 'android') return false;
  try {
    return !(await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return Number(version) >= 34;
  }
}

/**
 * The system page where the user allows exact alarms for this app (resolves when the user comes back); the app's
 * own settings page when that fails (for example the permission is not declared in the manifest).
 */
export async function openExactAlarmSettings(log: ReminderLog = warnLog): Promise<void> {
  try {
    await Notifications.requestExactAlarmPermissionsAsync();
  } catch (error) {
    log(`exact alarm settings unavailable: ${errorName(error)}`);
    await Linking.openSettings().catch(() => undefined);
  }
}

/** Reminders also show as a banner while the app is in the foreground. Call once at startup. */
export function configureReminderPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const TAP_ACTIONS = new Map<string, ReminderTapAction>([
  [Notifications.DEFAULT_ACTION_IDENTIFIER, 'open'],
  [SNOOZE_ACTION_ID, 'snooze'],
  [COMPLETE_ACTION_ID, 'complete'],
]);

/** null for other actions (e.g. dismiss) or notifications without a task. */
export function parseReminderTap(response: NotificationResponse): ReminderTap | null {
  const action = TAP_ACTIONS.get(response.actionIdentifier);
  const { request } = response.notification;
  const taskId = stringOf(request.content.data, 'taskId');
  if (!action || !taskId) return null;
  return { action, taskId, notificationId: request.identifier, title: request.content.title ?? '' };
}

/** The response that opened the app (cold start), consumed once so a later remount does not replay it. */
export function takeLastReminderTap(): ReminderTap | null {
  const response = Notifications.getLastNotificationResponse();
  if (!response) return null;
  Notifications.clearLastNotificationResponse();
  return parseReminderTap(response);
}

/** Responses while the app is running (foreground or background). Returns an unsubscribe function. */
export function addReminderTapListener(onTap: (tap: ReminderTap) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const tap = parseReminderTap(response);
    if (!tap) return;
    Notifications.clearLastNotificationResponse();
    onTap(tap);
  });
  return () => subscription.remove();
}

/** Removes a shown notification from the tray. Never throws. */
export async function dismissReminder(notificationId: string, log: ReminderLog = warnLog): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (error) {
    log(`dismiss reminder failed: ${errorName(error)}`);
  }
}

/** Sign-out / session end: drop every reminder. Never throws (signing out must not depend on it). */
export async function cancelAllReminders(log: ReminderLog = warnLog): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    log(`cancel all reminders failed: ${errorName(error)}`);
  }
}

/** The ReminderPlatform port backed by expo-notifications (installed at startup by installReminderPlatform). */
export const expoReminderPlatform: ReminderPlatform = {
  // M12: urgent requests ring as native full-screen alarms when the TasklyAndroid module is in the build.
  scheduler: createUrgentAwareScheduler(expoReminderScheduler, getTasklyAndroid),
  ensureChannel: (name, urgentName) => ensureReminderChannel(name, Platform.OS, urgentName),
  configureActions: configureReminderActions,
  configurePresentation: configureReminderPresentation,
  getPermission: getReminderPermission,
  requestPermission: requestReminderPermission,
  needsExactAlarmGrant: () => needsExactAlarmGrant(),
  openExactAlarmSettings: () => openExactAlarmSettings(),
  takeLastTap: takeLastReminderTap,
  addTapListener: addReminderTapListener,
  dismiss: (notificationId) => dismissReminder(notificationId),
  cancelAll: () => expoReminderScheduler.cancelAll(),
};

let installed = false;

/**
 * Startup, once: the app talks to notifications only through the ReminderPlatform port, so install the
 * expo-notifications implementation and show reminders as banners while the app is open. Calling it again does nothing.
 */
export function installReminderPlatform(): void {
  if (installed) return;
  installed = true;
  setReminderPlatform(expoReminderPlatform);
  expoReminderPlatform.configurePresentation();
}

/** Test only: allow installReminderPlatform to run again. */
export function resetReminderPlatformInstall(): void {
  installed = false;
}

