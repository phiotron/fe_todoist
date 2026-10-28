import * as Notifications from 'expo-notifications';

type StatusName = 'granted' | 'denied' | 'undetermined';

export interface FakePermission {
  status: StatusName;
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
}

const asMock = (fn: unknown) => fn as jest.Mock;

export function permission(status: StatusName, canAskAgain = true): FakePermission {
  return { status, granted: status === 'granted', canAskAgain, expires: 'never' };
}

/** getPermissionsAsync answers `current`; requestPermissionsAsync answers `afterRequest`. */
export function setNotificationPermission(current: FakePermission, afterRequest: FakePermission = current): void {
  asMock(Notifications.getPermissionsAsync).mockImplementation(async () => current);
  asMock(Notifications.requestPermissionsAsync).mockImplementation(async () => afterRequest);
}

/** getExactAlarmPermissionsAsync answers `current`; requestExactAlarmPermissionsAsync answers `afterRequest`. */
export function setExactAlarmPermission(current: FakePermission, afterRequest: FakePermission = current): void {
  asMock(Notifications.getExactAlarmPermissionsAsync).mockImplementation(async () => current);
  asMock(Notifications.requestExactAlarmPermissionsAsync).mockImplementation(async () => afterRequest);
}

/** A response as expo-notifications delivers it: a tap (default action) or a button of the reminder category. */
export function tapResponse(
  taskId: string,
  actionIdentifier: string = Notifications.DEFAULT_ACTION_IDENTIFIER,
  options: { identifier?: string; title?: string } = {},
) {
  return {
    actionIdentifier,
    notification: {
      date: 0,
      request: {
        identifier: options.identifier ?? `auto:${taskId}`,
        content: { title: options.title ?? 'Họp nhóm', body: 'Sắp đến hạn', data: { taskId, kind: 'AUTO' } },
        trigger: null,
      },
    },
  };
}

/** The response returned by getLastNotificationResponse (it launched the app); null = none. */
export function setLastNotificationTap(taskId: string | null, actionIdentifier?: string): void {
  asMock(Notifications.getLastNotificationResponse).mockImplementation(() =>
    taskId === null ? null : tapResponse(taskId, actionIdentifier),
  );
}

/** Listener most recently registered with addNotificationResponseReceivedListener. */
export function lastTapListener(): (response: unknown) => void {
  const calls = asMock(Notifications.addNotificationResponseReceivedListener).mock.calls;
  return calls[calls.length - 1][0];
}

export function scheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

const TRACKED = [
  'setNotificationHandler',
  'setNotificationChannelAsync',
  'setNotificationCategoryAsync',
  'requestPermissionsAsync',
  'getExactAlarmPermissionsAsync',
  'requestExactAlarmPermissionsAsync',
  'cancelScheduledNotificationAsync',
  'dismissNotificationAsync',
  'clearLastNotificationResponse',
  'addNotificationResponseReceivedListener',
] as const;

/** Call in beforeEach: empty schedule, permissions granted, no pending response, call history cleared. */
export async function resetNotificationsMock(): Promise<void> {
  setNotificationPermission(permission('granted'));
  setExactAlarmPermission(permission('granted'));
  setLastNotificationTap(null);
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const name of TRACKED) asMock(Notifications[name]).mockClear();
}
