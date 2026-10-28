import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { QueryStateView } from '../../components/QueryStateView';
import { StateView } from '../../components/StateView';
import { formatDateKey } from '../../lib/dates/format';
import { dateKeyInZone, nowLocal } from '../../lib/dates';
import { formatTime } from '../../lib/dates/displayFormat';
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { parseInstant } from '../../lib/dates/instant';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { SettingsPage } from '../settings/SettingsPage';
import { useSettingsStyles } from '../settings/ui';
import { useBackups } from './useTemplates';

/** Settings → Backups (M11 F8): the daily server backups, newest first. View only — no restore or download here (ADR 0006). */
export function BackupsScreen() {
  const shared = useSettingsStyles();
  useDisplayPrefs(); // redraw when the date / time format changes
  const { t } = useTranslation();
  const timeZone = useUserTimeZone();
  const backups = useBackups();
  const today = dateKeyInZone(new Date(), timeZone);

  return (
    <SettingsPage testID="backups-screen" title={t('templates.backups.title')}>
      <Text style={shared.notice}>{t('templates.backups.intro')}</Text>
      {!backups.data ? (
        <QueryStateView query={backups} testID="backups-state" />
      ) : backups.data.length === 0 ? (
        <StateView tone="ok" icon="archive" title={t('templates.backups.empty')} testID="backups-empty" />
      ) : (
        <View>
          {backups.data.map((backup) => {
            const local = nowLocal(parseInstant(backup.createdAt), timeZone);
            const day = local.slice(0, 10);
            return (
              <ListRow
                key={backup.id}
                testID={`backup-row-${backup.id}`}
                title={t('templates.backups.when', {
                  date: formatDateKey(day, day.slice(0, 4) !== today.slice(0, 4)),
                  time: formatTime(local.slice(11, 16)),
                })}
                icon="archive"
                iconBox
                right={t('templates.backups.counts', { projects: backup.projectCount, tasks: backup.taskCount })}
              />
            );
          })}
        </View>
      )}
    </SettingsPage>
  );
}
