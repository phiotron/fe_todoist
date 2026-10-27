import i18n, { viTranslation } from '..';

describe('reminders locale', () => {
  it('exists in Vietnamese', () => {
    expect((viTranslation as Record<string, unknown>).reminders).toBeDefined();
  });

  it('interpolates without escaping', () => {
    expect(i18n.t('reminders.offset.minutes', { count: 30 })).toBe('30 phút trước');
    // escapeValue must stay off, otherwise "/" in dates becomes "&#x2F;".
    expect(i18n.t('reminders.chip.more', { label: '24/10/2026 09:00', count: 1 })).toBe('24/10/2026 09:00 +1');
    expect(i18n.t('reminders.settings.permissionMissing')).toBe(
      'Taskly chưa được phép gửi thông báo nên sẽ không nhắc việc.',
    );
  });
});
