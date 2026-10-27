import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { StateView } from '../../components/StateView';
import { SubHeader } from '../../components/SubHeader';
import { gutter, palette, type } from '../../theme';
import { projectDisplayName } from './appearance';
import { ProjectIcon } from './ProjectIcon';
import { projectTreeRows } from './projectTree';
import { useArchivedProjects, useUnarchiveProject } from './useProjects';

/** Archived projects as a tree: open one (read-only) or restore it with its sub-projects (spec 5.7). */
export function ArchivedProjectsScreen() {
  const { t } = useTranslation();
  const { query, projects } = useArchivedProjects();
  const unarchive = useUnarchiveProject();
  const rows = useMemo(() => projectTreeRows(projects), [projects]);

  return (
    <View style={styles.fill}>
      <SubHeader title={t('projects.archived.title')} onBack={() => router.back()} testID="archived-header" />
      <ErrorText message={unarchive.error ? describeError(unarchive.error).message : undefined} testID="archived-error" />
      {query.isPending || query.isError ? (
        <QueryStateView query={query} testID="archived-state" />
      ) : rows.length === 0 ? (
        <StateView tone="ok" icon="archive" title={t('projects.archived.empty')} testID="archived-empty" />
      ) : (
        <ScrollView>
          {rows.map(({ project, depth }) => (
            <View key={project.id} style={[styles.row, { paddingLeft: gutter + (depth - 1) * 20 }]}>
              <Pressable
                testID={`archived-project-${project.id}`}
                accessibilityRole="button"
                onPress={() => router.push(`/project/${project.id}`)}
                style={styles.main}
              >
                <ProjectIcon project={project} />
                <Text style={[type.body, styles.name]} numberOfLines={1}>
                  {projectDisplayName(project)}
                </Text>
              </Pressable>
              <AppButton
                variant="outline"
                size="sm"
                label={t('projects.archived.restore')}
                requiresOnline
                busy={unarchive.isPending && unarchive.variables === project.id}
                onPress={() => unarchive.mutate(project.id)}
                testID={`archived-restore-${project.id}`}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingRight: gutter,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  name: { flex: 1, color: palette.ink },
});
