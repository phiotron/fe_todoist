import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { QueryStateView } from '../../components/QueryStateView';
import { SettingsPage } from '../settings/SettingsPage';
import { SettingsSection, SwitchRow, useSettingsStyles } from '../settings/ui';
import { TestPushSection } from './TestPushSection';
import { useNotificationPrefs, type NotificationPrefKey } from './useNotificationPrefs';

const EMAIL_ROWS: readonly { key: NotificationPrefKey; label: string; hint: string }[] = [
  { key: 'morningOverview', label: 'notificationPrefs.morningOverview', hint: 'notificationPrefs.morningOverviewHint' },
  { key: 'eveningReview', label: 'notificationPrefs.eveningReview', hint: 'notificationPrefs.eveningReviewHint' },
  { key: 'subscribedEmails', label: 'notificationPrefs.subscribedEmails', hint: 'notificationPrefs.subscribedEmailsHint' },
];

const REMINDER_ROWS: readonly { key: NotificationPrefKey; label: string; hint: string }[] = [
  { key: 'reminderPush', label: 'notificationPrefs.reminderPush', hint: 'notificationPrefs.reminderPushHint' },
  { key: 'reminderEmail', label: 'notificationPrefs.reminderEmail', hint: 'notificationPrefs.reminderEmailHint' },
];

/**
 * Settings › Notifications (M13c F7): Morning overview / Evening review / Subscribed emails, and "Reminders via" push from
 * the server / email. Every switch saves at once (optimistic; a failure puts it back with an error toast).
 */
export function NotificationPrefsScreen() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { query, prefs, toggle } = useNotificationPrefs();

  const rows = (list: typeof EMAIL_ROWS) =>
    prefs
      ? list.map((row) => (
          <SwitchRow
            key={row.key}
            testID={`notification-prefs-${row.key}`}
            label={t(row.label)}
            hint={t(row.hint)}
            value={prefs[row.key]}
            onChange={(value) => toggle(row.key, value)}
          />
        ))
      : null;

  return (
    <SettingsPage testID="notification-prefs-screen" title={t('notificationPrefs.title')}>
      {prefs ? (
        <>
          <SettingsSection testID="notification-prefs-section-email" title={t('notificationPrefs.emailSection')}>
            {rows(EMAIL_ROWS)}
            <Text style={[styles.hint, { marginTop: 8 }]}>{t('notificationPrefs.timeZoneNote')}</Text>
          </SettingsSection>
          <SettingsSection testID="notification-prefs-section-reminders" title={t('notificationPrefs.remindersSection')}>
            {rows(REMINDER_ROWS)}
          </SettingsSection>
          <TestPushSection />
        </>
      ) : (
        <QueryStateView query={query} testID="notification-prefs-state" />
      )}
    </SettingsPage>
  );
}
