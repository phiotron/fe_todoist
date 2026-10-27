import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { QueryStateView } from '../../components/QueryStateView';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { ProjectScreen } from '../projects/ProjectScreen';
import { useProjects } from '../projects/useProjects';

/** Inbox tab: the Inbox is a project (`tasks?projectId=<Inbox>`, spec 4.1), found in the projects list first. */
export function InboxScreen() {
  const styles = useThemedStyles(createInboxScreenStyles);
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

function createInboxScreenStyles(palette: Palette) {
  return StyleSheet.create({ fill: { flex: 1, backgroundColor: palette.bg } });
}
