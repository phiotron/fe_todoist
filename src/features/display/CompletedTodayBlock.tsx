import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { QueryStateView } from '../../components/QueryStateView';
import { SectionHeader } from '../../components/SectionHeader';
import { useNow } from '../../lib/useNow';
import { gutter, useTheme } from '../../theme';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { TaskRowEnvProvider } from '../tasks/taskRowEnv';
import { TaskRow } from '../tasks/TaskRow';
import { useToggleTask } from '../tasks/useTaskActions';
import { useTaskList } from '../tasks/useTaskList';

/**
 * M7 Display → Completed tasks on Today / Upcoming (plan M7 F2): the tasks completed TODAY in the account time zone,
 * every project (GET tasks?view=completed&since=today&until=today, M1), reopened from their circle. Nothing when empty.
 */
export function CompletedTodayBlock({ today, testID = 'completed-today' }: { today: string; testID?: string }) {
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const { query, tasks } = useTaskList({ view: 'completed', since: today, until: today });
  const { toggle, pendingId } = useToggleTask();

  if (query.isError) return <QueryStateView query={query} testID={`${testID}-state`} />;
  if (tasks.length === 0) return null;
  return (
    <TaskRowEnvProvider fetchLists>
    <View testID={testID}>
      <View style={styles.pad}>
        <SectionHeader title={t('display.completedToday')} count={tasks.length} tone="muted" testID={`${testID}-header`} />
      </View>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          now={now}
          timeZone={timeZone}
          showProject
          onToggle={toggle}
          toggleDisabled={pendingId === task.id}
        />
      ))}
      {query.hasNextPage ? (
        <View style={styles.pad}>
          <AppButton
            variant="ghost"
            color={palette.acc}
            label={t('common.loadMore')}
            busy={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
            testID={`${testID}-load-more`}
          />
        </View>
      ) : null}
    </View>
    </TaskRowEnvProvider>
  );
}

const styles = StyleSheet.create({ pad: { paddingHorizontal: gutter } });
