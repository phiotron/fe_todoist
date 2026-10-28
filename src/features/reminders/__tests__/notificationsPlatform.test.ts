import * as Notifications from 'expo-notifications';
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
  expoReminderPlatform,
  installReminderPlatform,
  resetReminderPlatformInstall,
} from '../notifications';
import { cancelAllReminders, getReminderPlatform, setReminderPlatform, unavailableReminderPlatform } from '../platform';

describe('expoReminderPlatform (the ReminderPlatform port over expo-notifications)', () => {
  beforeEach(resetNotificationsMock);

  it('schedules, lists and cancels through the scheduler', async () => {
    const { scheduler } = expoReminderPlatform;
    await scheduler.schedule({
      id: 'auto:t-1', taskId: 't-1', kind: 'AUTO', fireAtMs: 1_000, title: 'Họp', body: 'Sắp đến hạn', signature: 's1',
    });

    expect(await scheduler.listScheduled()).toEqual([{ id: 'auto:t-1', taskId: 't-1', kind: 'AUTO', signature: 's1' }]);
    expect((await scheduledNotifications())[0].content).toMatchObject({ categoryIdentifier: REMINDER_CATEGORY_ID });

    await expoReminderPlatform.cancelAll();
    expect(await scheduler.listScheduled()).toEqual([]);
  });

  it('creates the Android channel and the buttons under the names the sync passes', async () => {
    await expoReminderPlatform.ensureChannel('Nhắc việc');
    await expoReminderPlatform.configureActions({ snooze: 'Hoãn', complete: 'Hoàn thành' });

    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledTimes(1);
    expect(REMINDER_CHANNEL_ID).toBe('reminders');
  });

  it('reads and requests the notification permission', async () => {
    setNotificationPermission(permission('undetermined'), permission('denied', false));

    await expect(expoReminderPlatform.getPermission()).resolves.toMatchObject({ status: 'undetermined' });
    await expect(expoReminderPlatform.requestPermission()).resolves.toEqual({
      status: 'denied', granted: false, canAskAgain: false,
    });
  });

  it('answers whether exact alarms are still needed from the system (the test OS is not Android)', async () => {
    setExactAlarmPermission(permission('denied'));

    await expect(expoReminderPlatform.needsExactAlarmGrant()).resolves.toBe(false);
  });

  it('hands the tap that launched the app over once, then forwards live taps until unsubscribed', () => {
    setLastNotificationTap('t-9', COMPLETE_ACTION_ID);
    expect(expoReminderPlatform.takeLastTap()).toEqual({
      action: 'complete', taskId: 't-9', notificationId: 'auto:t-9', title: 'Họp nhóm',
    });

    const onTap = jest.fn();
    const unsubscribe = expoReminderPlatform.addTapListener(onTap);
    const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];
    listener(tapResponse('t-2') as never);
    unsubscribe();

    expect(onTap).toHaveBeenCalledWith(expect.objectContaining({ action: 'open', taskId: 't-2' }));
  });

  it('dismisses a shown notification', async () => {
    await expoReminderPlatform.dismiss('auto:t-1');

    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('auto:t-1');
  });
});

describe('installReminderPlatform (startup)', () => {
  beforeEach(async () => {
    await resetNotificationsMock();
    resetReminderPlatformInstall();
    setReminderPlatform(null);
  });

  afterEach(() => setReminderPlatform(null));

  it('installs the expo-notifications platform and shows reminders as banners while the app is open', async () => {
    expect(getReminderPlatform()).toBe(unavailableReminderPlatform);

    installReminderPlatform();

    expect(getReminderPlatform()).toBe(expoReminderPlatform);
    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it('does nothing when called again', () => {
    installReminderPlatform();
    installReminderPlatform();

    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it('lets sign-out cancel every scheduled reminder through the installed platform', async () => {
    installReminderPlatform();
    await expoReminderPlatform.scheduler.schedule({
      id: 'r-1', taskId: 't-1', kind: 'ABSOLUTE', fireAtMs: 1_000, title: 'x', body: 'y', signature: 's',
    });

    await cancelAllReminders();

    expect(await scheduledNotifications()).toEqual([]);
  });
});
