import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
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
  /** Rows drawn on the first render (FlatList default 10); Upcoming draws a whole day window at once. */
  initialNumToRender?: number;
}

/** scrollToIndex retries after onScrollToIndexFailed, and the gap after which a new failure counts as a new jump. */
export const MAX_SCROLL_RETRIES = 4;
const SCROLL_RETRY_WINDOW_MS = 500;

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
  initialNumToRender,
}: TaskListViewProps) {
  const { t } = useTranslation();
  const timeZone = useUserTimeZone();
  const now = useNow();
  const { toggle, pendingId, errorMessage } = useToggleTask();
  const update = useUpdateTask();
  const [scheduling, setScheduling] = useState<Task | null>(null);

  const innerRef = useRef<FlatList<TaskListRow> | null>(null);
  const retryAttempts = useRef({ index: -1, count: 0, at: 0 });
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(retryTimer.current), []);
  const setListRef = useCallback(
    (list: FlatList<TaskListRow> | null) => {
      innerRef.current = list;
      if (typeof listRef === 'function') listRef(list);
      else if (listRef) (listRef as { current: FlatList<TaskListRow> | null }).current = list;
    },
    [listRef],
  );
  // The list has no getItemLayout (rows differ in height): a row far below is not measured yet, so jump near it by the
  // average row height first, then ask for the row itself once that stretch has been laid out.
  const onScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    innerRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    clearTimeout(retryTimer.current);
    // A scrollToIndex that fails again re-enters here: give up after a few tries instead of retrying forever.
    // A failure long after the last one is a new jump, not another retry of the old one.
    const now = Date.now();
    const last = retryAttempts.current;
    const sameJump = last.index === info.index && now - last.at < SCROLL_RETRY_WINDOW_MS;
    retryAttempts.current = { index: info.index, count: sameJump ? last.count : 0, at: now };
    if (retryAttempts.current.count >= MAX_SCROLL_RETRIES) return;
    retryAttempts.current.count += 1;
    retryTimer.current = setTimeout(() => {
      try {
        innerRef.current?.scrollToIndex({ index: info.index, animated: true });
      } catch {
        // The rows changed meanwhile and the index no longer exists: nothing to scroll to.
      }
    }, 50);
  }, []);

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
        ref={setListRef}
        {...(initialNumToRender === undefined ? {} : { initialNumToRender })}
        testID={testID}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        ListHeaderComponent={header ? <>{header}</> : undefined}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        onScrollToIndexFailed={onScrollToIndexFailed}
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
