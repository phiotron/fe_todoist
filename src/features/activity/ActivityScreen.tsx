import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SubHeader } from '../../components/SubHeader';
import { useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { ActivityLogView } from './ActivityLogView';

/**
 * View activity (M10 plan F5): the Activity log of ONE task or project (Inbox is a project), or everything when neither
 * is given (Today / Upcoming). The scope comes from the route params.
 */
export function ActivityScreen({ projectId, taskId }: { projectId?: string; taskId?: string }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const scope = useMemo(() => ({ projectId, taskId }), [projectId, taskId]);
  return (
    <View style={styles.fill} testID="activity-screen">
      <SubHeader title={t('activity.title')} onBack={() => router.back()} testID="activity-header" />
      <ActivityLogView scope={scope} filters={!taskId} />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({ fill: { flex: 1, backgroundColor: palette.bg } });
}
