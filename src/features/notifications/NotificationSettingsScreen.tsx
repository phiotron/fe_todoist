import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import type { NotificationScope } from '../../api/notifications';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { SettingsPage } from '../settings/SettingsPage';
import { SettingsSection, SwitchRow, useSettingsStyles } from '../settings/ui';
import { useNotificationSettings, useUpdateNotificationSetting } from './useNotifications';

/** Events that create inbox entries today; the other switches are saved but have no effect yet (plan M8b F5). */
const ACTIVE_EVENTS: ReadonlySet<string> = new Set(['COMMENT_MENTION']);

const SCOPES: readonly { scope: NotificationScope; title: 'notifications.settings.projectTitle' | 'notifications.settings.workspaceTitle' }[] = [
  { scope: 'PROJECT', title: 'notifications.settings.projectTitle' },
  { scope: 'WORKSPACE', title: 'notifications.settings.workspaceTitle' },
];

/** Settings › Notifications: Project / Workspace notification switches (spec 3.2 M8b). */
export function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const query = useNotificationSettings();
  const update = useUpdateNotificationSetting();
  return (
    <SettingsPage testID="notification-settings-screen" title={t('notifications.settings.title')}>
      <Text style={styles.hint}>{t('notifications.settings.hint')}</Text>
      {query.data === undefined ? (
        <QueryStateView query={query} testID="notification-settings-state" />
      ) : (
        SCOPES.map(({ scope, title }) => (
          <SettingsSection key={scope} testID={`notification-settings-${scope}`} title={t(title)}>
            {query.data.items
              .filter((item) => item.scope === scope)
              .map((item) => (
                <SwitchRow
                  key={item.event}
                  testID={`notification-setting-${item.event}`}
                  label={t(`notifications.settings.events.${item.event}`)}
                  hint={ACTIVE_EVENTS.has(item.event) ? undefined : t('notifications.settings.notYet')}
                  value={item.enabled}
                  disabled={update.pending}
                  onChange={(enabled) => void update.save({ ...item, enabled })}
                />
              ))}
          </SettingsSection>
        ))
      )}
      <ErrorText testID="notification-settings-error" message={update.error ? t('notifications.settings.saveFailed') : undefined} />
    </SettingsPage>
  );
}
