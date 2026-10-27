import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { QueryStateView } from '../../components/QueryStateView';
import { SectionHeader } from '../../components/SectionHeader';
import { useNow } from '../../lib/useNow';
import { gutter, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { treeRows } from '../tasks/taskRows';
import { TaskRow } from '../tasks/TaskRow';
import { useToggleTask } from '../tasks/useTaskActions';
import { useTaskList } from '../tasks/useTaskList';

/** Display → Completed tasks (spec 9.2): the project's completed tasks (with subtrees), reopened from their circle. */
export function CompletedTasksBlock({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
  const styles = useThemedStyles(createCompletedTasksBlockStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const { query, tasks } = useTaskList({ projectId, completed: true });
  const { toggle, pendingId } = useToggleTask();

  return (
    <View testID="completed-block">
      <View style={styles.pad}>
        <SectionHeader title={t('projectScreen.completedBlock.title')} count={tasks.length} tone="muted" testID="completed-block-header" />
      </View>
      {query.isPending || query.isError ? <QueryStateView query={query} testID="completed-block-state" /> : null}
      {!query.isPending && !query.isError && tasks.length === 0 ? (
        <Text style={styles.empty}>{t('projectScreen.completedBlock.empty')}</Text>
      ) : null}
      {treeRows(tasks).map((row) =>
        row.type === 'task' ? (
          <TaskRow
            key={row.key}
            task={row.task}
            depth={row.depth}
            now={now}
            timeZone={timeZone}
            onToggle={toggle}
            toggleDisabled={pendingId === row.task.id}
            readOnly={readOnly}
          />
        ) : null,
      )}
      {query.hasNextPage ? (
        <View style={styles.pad}>
          <AppButton
            variant="ghost"
            color={palette.acc}
            label={t('common.loadMore')}
            busy={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
            testID="completed-block-load-more"
          />
        </View>
      ) : null}
    </View>
  );
}

function createCompletedTasksBlockStyles(palette: Palette) {
  return StyleSheet.create({
    pad: { paddingHorizontal: gutter },
    empty: { ...type.body, color: palette.mute, paddingHorizontal: gutter, paddingVertical: 12 },
  });
}
