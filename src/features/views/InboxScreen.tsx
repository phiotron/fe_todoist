import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { QueryStateView } from '../../components/QueryStateView';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StateView } from '../../components/StateView';
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
        {query.isSuccess ? (
          // The list loaded but holds no Inbox: nothing to show, so say so and let the user retry.
          <StateView
            tone="error"
            icon="alert-circle"
            title={t('common.loadErrorTitle')}
            message={t('errors.unknown')}
            actionLabel={t('common.retry')}
            onAction={() => void query.refetch()}
            testID="inbox-state"
          />
        ) : (
          <QueryStateView query={query} testID="inbox-state" />
        )}
      </View>
    );
  }
  return <ProjectScreen projectId={inbox.id} tab />;
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: palette.bg } });
