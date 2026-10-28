import { toReminderRuntimeSettings } from '../reminderSettings';

const BASE = { remindersEnabled: true, autoReminderMinutes: 30, timeZone: 'Asia/Ho_Chi_Minh' };

describe('toReminderRuntimeSettings', () => {
  it('takes the reminder fields and the account time zone from me/settings', () => {
    expect(
      toReminderRuntimeSettings({ ...BASE, remindersEnabled: false, autoReminderMinutes: 60, timeZone: 'America/New_York' }),
    ).toEqual({
      enabled: false,
      timeZone: 'America/New_York',
      autoReminderMinutes: 60,
      // M12 fields fall back to their defaults while the server has not sent them
      snoozeMinutes: 15,
      pinReminders: false,
      urgentDeviceId: null,
    });
    expect(toReminderRuntimeSettings({ ...BASE, autoReminderMinutes: null })?.autoReminderMinutes).toBeNull();
  });

  it('stays unknown while the cached settings predate the reminder fields (never "disabled")', () => {
    // A settings cache written before M4 has no remindersEnabled: reading that as "off" would cancel every reminder.
    expect(toReminderRuntimeSettings({ autoReminderMinutes: 30, timeZone: 'Asia/Ho_Chi_Minh' })).toBeNull();
  });
});
