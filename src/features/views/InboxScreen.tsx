import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { QueryStateView } from '../../components/QueryStateView';
import { ScreenHeader } from '../../components/ScreenHeader';
import { palette } from '../../theme';
import { ProjectScreen } from '../projects/ProjectScreen';
import { useProjects } from '../projects/useProjects';

/** Inbox tab: the Inbox is a project (`tasks?projectId=<Inbox>`, spec 4.1), found in the projects list first. */
export function InboxScreen() {
  const { t } = useTranslation();
  const { query, inbox } = useProjects();
  if (!inbox) {
    return (
      <View style={styles.fill}>
        <ScreenHeader title={t('views.inbox.title')} />
        <QueryStateView query={query} testID="inbox-state" />
      </View>
    );
  }
  return <ProjectScreen projectId={inbox.id} tab />;
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: palette.bg } });
