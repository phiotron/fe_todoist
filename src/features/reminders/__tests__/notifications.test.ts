import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import {
  permission,
  resetNotificationsMock,
  scheduledNotifications,
  setExactAlarmPermission,
  setLastNotificationTap,
  setNotificationPermission,
  tapResponse,
} from '../../../test/notifications';
import {
  COMPLETE_ACTION_ID,
  REMINDER_CATEGORY_ID,
  REMINDER_CHANNEL_ID,
  SNOOZE_ACTION_ID,
  addReminderTapListener,
  cancelAllReminders,
  configureReminderActions,
  configureReminderPresentation,
  dismissReminder,
  ensureReminderChannel,
  expoReminderScheduler,
  getReminderPermission,
  needsExactAlarmGrant,
  openExactAlarmSettings,
  parseReminderTap,
  requestReminderPermission,
  takeLastReminderTap,
} from '../notifications';
import type { ReminderRequest } from '../types';

const REQUEST: ReminderRequest = {
  id: 'auto:t-1',
  taskId: 't-1',
  kind: 'AUTO',
  fireAtMs: Date.parse('2026-10-23T04:30:00Z'),
  title: 'Họp nhóm',
  body: 'Sắp đến hạn',
  signature: 'sig-1',
};

describe('expoReminderScheduler', () => {
  beforeEach(resetNotificationsMock);

  it('schedules a date notification identified by the occurrence key, with the reminder buttons', async () => {
    await expoReminderScheduler.schedule(REQUEST);

    expect(await scheduledNotifications()).toEqual([
      {
        identifier: 'auto:t-1',
        content: {
          title: 'Họp nhóm',
          body: 'Sắp đến hạn',
          data: { taskId: 't-1', kind: 'AUTO', signature: 'sig-1' },
          categoryIdentifier: REMINDER_CATEGORY_ID,
        },
        trigger: { type: 'date', date: REQUEST.fireAtMs, channelId: REMINDER_CHANNEL_ID },
      },
    ]);
  });

  it('replaces the previous notification with the same id (cancel first, then schedule)', async () => {
    await expoReminderScheduler.schedule(REQUEST);
    await expoReminderScheduler.schedule({ ...REQUEST, fireAtMs: REQUEST.fireAtMs + 60_000, signature: 'sig-2' });

    expect(await scheduledNotifications()).toHaveLength(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('auto:t-1');
    expect(await expoReminderScheduler.listScheduled()).toEqual([
      { id: 'auto:t-1', taskId: 't-1', kind: 'AUTO', signature: 'sig-2' },
    ]);
  });

  it('reports notifications it did not create as unknown', async () => {
    await Notifications.scheduleNotificationAsync({ identifier: 'other', content: { title: 'x' }, trigger: null });

    expect(await expoReminderScheduler.listScheduled()).toEqual([
      { id: 'other', taskId: null, kind: null, signature: null },
    ]);
  });

  it('cancels one or all', async () => {
    await expoReminderScheduler.schedule(REQUEST);
    await expoReminderScheduler.schedule({ ...REQUEST, id: 'r-2', kind: 'ABSOLUTE' });

    await expoReminderScheduler.cancel('auto:t-1');
    expect((await scheduledNotifications()).map((notification) => notification.identifier)).toEqual(['r-2']);

    await expoReminderScheduler.cancelAll();
    expect(await scheduledNotifications()).toEqual([]);
  });
});

describe('channel, buttons, permission and presentation', () => {
  beforeEach(resetNotificationsMock);

  it('creates a high-importance Android channel and skips other platforms', async () => {
    await ensureReminderChannel('Nhắc việc', 'android');
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(REMINDER_CHANNEL_ID, {
      name: 'Nhắc việc',
      importance: Notifications.AndroidImportance.HIGH,
    });

    jest.mocked(Notifications.setNotificationChannelAsync).mockClear();
    await ensureReminderChannel('Nhắc việc', 'ios');
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it.each([
    [permission('granted'), { status: 'granted', granted: true, canAskAgain: true }],
    [permission('undetermined'), { status: 'undetermined', granted: false, canAskAgain: true }],
    [permission('denied', false), { status: 'denied', granted: false, canAskAgain: false }],
  ])('maps the permission response %#', async (response, expected) => {
    setNotificationPermission(response);
    expect(await getReminderPermission()).toEqual(expected);
  });

  it('requests the permission through the system prompt', async () => {
    setNotificationPermission(permission('undetermined'), permission('granted'));

    expect(await requestReminderPermission()).toEqual({ status: 'granted', granted: true, canAskAgain: true });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('shows reminders as banners even while the app is open', async () => {
    configureReminderPresentation();

    const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0][0];
    await expect(handler?.handleNotification({} as never)).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('registers Snooze and Complete buttons that open the app', async () => {
    await configureReminderActions({ snooze: 'Hoãn', complete: 'Hoàn thành' });

    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(REMINDER_CATEGORY_ID, [
      { identifier: SNOOZE_ACTION_ID, buttonTitle: 'Hoãn', options: { opensAppToForeground: true } },
      { identifier: COMPLETE_ACTION_ID, buttonTitle: 'Hoàn thành', options: { opensAppToForeground: true } },
    ]);
  });

  it('cancelAllReminders never throws', async () => {
    jest.mocked(Notifications.cancelAllScheduledNotificationsAsync).mockRejectedValueOnce(new Error('native'));
    const log = jest.fn();

    await expect(cancelAllReminders(log)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('dismissReminder never throws', async () => {
    jest.mocked(Notifications.dismissNotificationAsync).mockRejectedValueOnce(new Error('native'));
    const log = jest.fn();

    await expect(dismissReminder('auto:t-1', log)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('dismiss reminder failed: Error');
  });

  it('needs the exact-alarm grant only on Android while the system has not allowed it (spec 5.8, 18.1 I12)', async () => {
    setExactAlarmPermission(permission('denied'));
    await expect(needsExactAlarmGrant('android', 34)).resolves.toBe(true);

    setExactAlarmPermission(permission('granted'));
    await expect(needsExactAlarmGrant('android', 35)).resolves.toBe(false);

    setExactAlarmPermission(permission('denied'));
    await expect(needsExactAlarmGrant('ios', 34)).resolves.toBe(false);
    expect(Notifications.getExactAlarmPermissionsAsync).toHaveBeenCalledTimes(2);
  });

  it('falls back to "Android 14 and later" when the system cannot tell whether exact alarms are allowed', async () => {
    jest.mocked(Notifications.getExactAlarmPermissionsAsync).mockRejectedValue(new Error('native'));

    await expect(needsExactAlarmGrant('android', 34)).resolves.toBe(true);
    await expect(needsExactAlarmGrant('android', '33')).resolves.toBe(false);
  });

  it('opens the "Alarms & reminders" system page of the app', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    try {
      await openExactAlarmSettings();

      expect(Notifications.requestExactAlarmPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(openSettings).not.toHaveBeenCalled();
    } finally {
      openSettings.mockRestore();
    }
  });

  it('falls back to the app settings page when that page cannot be opened', async () => {
    jest.mocked(Notifications.requestExactAlarmPermissionsAsync).mockRejectedValueOnce(new Error('not declared'));
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const log = jest.fn();
    try {
      await openExactAlarmSettings(log);

      expect(openSettings).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith('exact alarm settings unavailable: Error');
    } finally {
      openSettings.mockRestore();
    }
  });
});

describe('responses', () => {
  beforeEach(resetNotificationsMock);

  it('reads open, snooze and complete; ignores other actions and foreign notifications', () => {
    expect(parseReminderTap(tapResponse('t-1') as never)).toEqual({
      action: 'open', taskId: 't-1', notificationId: 'auto:t-1', title: 'Họp nhóm',
    });
    expect(parseReminderTap(tapResponse('t-1', SNOOZE_ACTION_ID) as never)?.action).toBe('snooze');
    expect(parseReminderTap(tapResponse('t-1', COMPLETE_ACTION_ID) as never)?.action).toBe('complete');
    expect(parseReminderTap(tapResponse('t-1', 'expo.modules.notifications.actions.DISMISS') as never)).toBeNull();
    const foreign = {
      ...tapResponse('t-1'),
      notification: { date: 0, request: { identifier: 'x', content: { title: 'x', data: {} }, trigger: null } },
    };
    expect(parseReminderTap(foreign as never)).toBeNull();
  });

  it('takes the response that launched the app once and clears it', () => {
    setLastNotificationTap('t-7');

    expect(takeLastReminderTap()?.taskId).toBe('t-7');
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);

    setLastNotificationTap(null);
    expect(takeLastReminderTap()).toBeNull();
  });

  it('forwards responses while running and unsubscribes', () => {
    const onTap = jest.fn();
    const unsubscribe = addReminderTapListener(onTap);
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];

    listener(tapResponse('t-3') as never);
    listener(tapResponse('t-4', 'something-else') as never);
    unsubscribe();

    expect(onTap.mock.calls).toEqual([[{ action: 'open', taskId: 't-3', notificationId: 'auto:t-3', title: 'Họp nhóm' }]]);
    const subscription = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.results[0].value;
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });
});
