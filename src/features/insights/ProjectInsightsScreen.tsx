import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { productivityApi } from '../../api/productivity';
import { queryKeys } from '../../api/queryKeys';
import { QueryStateView } from '../../components/QueryStateView';
import { SubHeader } from '../../components/SubHeader';
import { formatDateKey } from '../../lib/dates/format';
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { MiniBars } from '../productivity/MiniBars';
import { ProgressBar } from '../productivity/ProgressBar';
import { barRatios } from '../productivity/productivityModel';
import { projectDisplayName } from '../projects/appearance';
import { useProject } from '../projects/useProjects';

/** Project Insights (M10 plan F6): progress of the project's own tasks + tasks completed per day (14 days). */
export function ProjectInsightsScreen({ projectId }: { projectId: string }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const project = useProject(projectId);
  const query = useQuery({
    queryKey: queryKeys.insights.project(projectId),
    queryFn: () => productivityApi.projectInsights(projectId),
  });
  const data = query.data;
  const ratios = barRatios(data?.completedByDay.map((day) => day.count) ?? []);
  const stats: { key: string; label: string; value: number }[] = data
    ? [
        { key: 'total', label: t('insights.total'), value: data.totalTasks },
        { key: 'completed', label: t('insights.completed'), value: data.completedTasks },
        { key: 'active', label: t('insights.active'), value: data.activeTasks },
        { key: 'overdue', label: t('insights.overdue'), value: data.overdueTasks },
      ]
    : [];
  const title = project.data ? `${t('insights.title')} · ${projectDisplayName(project.data)}` : t('insights.title');
  return (
    <View style={styles.fill} testID="insights-screen">
      <SubHeader title={title} onBack={() => router.back()} testID="insights-header" />
      {!data ? (
        <QueryStateView query={query} testID="insights-state" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('insights.progress')}</Text>
            <Text style={styles.big} testID="insights-percent">
              {t('insights.progressValue', { percent: data.progressPercent })}
            </Text>
            <ProgressBar ratio={data.progressPercent / 100} testID="insights-bar" />
            {data.totalTasks === 0 ? <Text style={styles.hint}>{t('insights.empty')}</Text> : null}
          </View>
          <View style={styles.stats}>
            {stats.map((stat) => (
              <View key={stat.key} style={styles.stat} testID={`insights-${stat.key}`}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.section}>{t('insights.completedByDay')}</Text>
          <MiniBars
            testID="insights-days"
            bars={data.completedByDay.map((day, index) => ({
              key: day.date,
              label: index % 2 === 1 ? '' : formatDateKey(day.date, false).slice(0, 5),
              ratio: ratios[index],
              strong: day.count > 0,
              accessibilityLabel: `${formatDateKey(day.date, false)}: ${day.count}`,
            }))}
          />
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingBottom: 40, gap: 16 },
    card: { backgroundColor: palette.bg2, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: palette.line },
    cardTitle: { ...type.label, color: palette.ink2 },
    big: { ...type.screenTitle, color: palette.ink },
    hint: { ...type.meta, color: palette.mute },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    stat: { flexBasis: '47%', flexGrow: 1, backgroundColor: palette.soft, borderRadius: 12, padding: 12, gap: 2 },
    statValue: { ...type.screenTitle, color: palette.acc2 },
    statLabel: { ...type.meta, color: palette.ink2 },
    section: { ...type.section, color: palette.ink },
  });
}
