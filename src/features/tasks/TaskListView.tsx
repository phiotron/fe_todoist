import { useCallback, useState, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { Task } from '../../api/models';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { SectionHeader } from '../../components/SectionHeader';
import type { PagedQuery } from '../../lib/usePagedList';
import { useNow } from '../../lib/useNow';
import { gutter, palette } from '../../theme';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { ScheduleSheet } from '../schedule/ScheduleSheet';
import { NO_DUE, dueValueOf, type DueValue } from '../schedule/dueValue';
import type { TaskListRow } from './taskRows';
import { TaskRow } from './TaskRow';
import { useToggleTask, useUpdateTask } from './useTaskActions';

export interface TaskListViewProps {
  rows: readonly TaskListRow[];
  query: PagedQuery;
  /** Shown when the list loaded and has no rows (StateView of M-Empty). */
  empty?: ReactNode;
  testID?: string;
  showProject?: boolean;
  /** Rendered above the rows (scrolls with them). */
  header?: ReactNode;
  readOnly?: boolean;
  /** Completed screen: show completion times. */
  showCompletedTime?: boolean;
  /** For scrollToIndex (Upcoming week strip). */
  listRef?: Ref<FlatList<TaskListRow>>;
}

/**
 * Every task list of the app: section headers / task rows / custom nodes, pull to refresh, "load more" near the end
 * and with a footer button (spec 5.10), skeleton / offline / error placeholder when nothing is cached, swipe
 * "Schedule" through the shared ScheduleSheet (PATCH with the task's version).
 */
export function TaskListView({
  rows,
  query,
  empty = null,
  testID = 'task-list',
  showProject = false,
  header,
  readOnly = false,
  showCompletedTime = false,
  listRef,
}: TaskListViewProps) {
  const { t } = useTranslation();
  const timeZone = useUserTimeZone();
  const now = useNow();
  const { toggle, pendingId, errorMessage } = useToggleTask();
  const update = useUpdateTask();
  const [scheduling, setScheduling] = useState<Task | null>(null);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  function reschedule(task: Task, due: DueValue) {
    update.mutate({ taskId: task.id, body: { version: task.version, ...due } });
  }

  function renderRow({ item }: { item: TaskListRow }) {
    if (item.type === 'section') {
      return (
        <View style={styles.section}>
          <SectionHeader {...item.props} testID={`section-header-${item.key}`} />
        </View>
      );
    }
    if (item.type === 'node') return <>{item.node}</>;
    return (
      <TaskRow
        task={item.task}
        depth={item.depth}
        now={now}
        timeZone={timeZone}
        showProject={showProject}
        onToggle={toggle}
        onSchedule={setScheduling}
        toggleDisabled={pendingId === item.task.id}
        readOnly={readOnly}
        showCompletedTime={showCompletedTime}
      />
    );
  }

  let footer: ReactNode = null;
  if (query.hasNextPage) {
    footer = query.isFetchingNextPage ? (
      <ActivityIndicator testID={`${testID}-loading-more`} color={palette.acc} style={styles.footer} />
    ) : (
      <View style={styles.footer}>
        <AppButton variant="ghost" color={palette.acc} label={t('taskList.loadMore')} onPress={loadMore} testID={`${testID}-load-more`} />
      </View>
    );
  }

  const message = errorMessage ?? (update.error ? describeError(update.error).message : undefined);
  return (
    <View style={styles.fill}>
      {message ? (
        <View style={styles.error}>
          <ErrorText message={message} testID={`${testID}-error`} />
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        testID={testID}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        ListHeaderComponent={header ? <>{header}</> : undefined}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        onScrollToIndexFailed={() => undefined}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            colors={[palette.acc]}
          />
        }
        ListEmptyComponent={
          query.isPending || query.isError ? <QueryStateView query={query} testID={`${testID}-state`} /> : <>{empty}</>
        }
        ListFooterComponent={<>{footer}</>}
        contentContainerStyle={styles.content}
      />
      <ScheduleSheet
        visible={scheduling !== null}
        value={scheduling ? dueValueOf(scheduling) : NO_DUE}
        onSelect={(due) => {
          if (scheduling) reschedule(scheduling, due);
        }}
        onClose={() => setScheduling(null)}
        testID="schedule"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  section: { paddingHorizontal: gutter },
  error: { paddingHorizontal: gutter },
  footer: { padding: 16, alignItems: 'center' },
  /** Room for the FAB and the Undo toast above the tab bar. */
  content: { paddingBottom: 168 },
});
