import { FakeReminderPlatform } from '../../../test/fakeReminderPlatform';
import {
  cancelAllReminders,
  getReminderPlatform,
  setReminderPlatform,
  unavailableReminderPlatform,
} from '../platform';

afterEach(() => setReminderPlatform(null));

describe('reminder platform port', () => {
  it('starts as the unavailable platform: nothing can be shown, so permission is never granted', async () => {
    expect(getReminderPlatform()).toBe(unavailableReminderPlatform);
    await expect(getReminderPlatform().getPermission()).resolves.toEqual({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });
    await expect(getReminderPlatform().scheduler.listScheduled()).resolves.toEqual([]);
    expect(getReminderPlatform().takeLastTap()).toBeNull();
    await expect(getReminderPlatform().needsExactAlarmGrant()).resolves.toBe(false);
  });

  it('installs a platform and restores the unavailable one with null', () => {
    const fake = new FakeReminderPlatform();
    setReminderPlatform(fake);
    expect(getReminderPlatform()).toBe(fake);

    setReminderPlatform(null);
    expect(getReminderPlatform()).toBe(unavailableReminderPlatform);
  });

  it('cancelAllReminders drops every scheduled reminder', async () => {
    const fake = new FakeReminderPlatform();
    await fake.scheduler.schedule({
      id: 'auto:t-1', taskId: 't-1', kind: 'AUTO', fireAtMs: 1, title: 'x', body: 'y', signature: 's',
    });
    setReminderPlatform(fake);

    await cancelAllReminders();

    expect(fake.cancelAllCalls).toBe(1);
    expect(await fake.scheduler.listScheduled()).toEqual([]);
  });

  it('cancelAllReminders never throws (signing out must not depend on it)', async () => {
    const fake = new FakeReminderPlatform();
    fake.cancelAll = jest.fn().mockRejectedValue(new Error('native'));
    setReminderPlatform(fake);
    const log = jest.fn();

    await expect(cancelAllReminders(log)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('cancel all reminders failed: Error');
  });

  it('the fake pushes taps to listeners until they unsubscribe', () => {
    const fake = new FakeReminderPlatform();
    const onTap = jest.fn();
    const unsubscribe = fake.addTapListener(onTap);
    const tap = { action: 'snooze' as const, taskId: 't-1', notificationId: 'auto:t-1', title: 'x' };

    fake.tap(tap);
    unsubscribe();
    fake.tap(tap);

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(tap);
  });
});
