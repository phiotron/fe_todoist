import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { Task } from '../../api/models';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { SectionHeader } from '../../components/SectionHeader';
import { FAB_CLEARANCE } from '../../components/tabBarMetrics';
import type { PagedQuery } from '../../lib/usePagedList';
import { useNow } from '../../lib/useNow';
import { gutter, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { DragProvider, DropZone, useDragApi, useDragState } from '../dnd/dnd';
import { InsertLine } from '../dnd/InsertLine';
import { rowHalf, type ListDropTarget } from '../dnd/listDrop';
import { useListAutoScroll, type ViewRef } from '../dnd/useListAutoScroll';
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
  /** DND in the list: which tasks can be lifted and what a drop does (absent = no dragging, long press = select). */
  dnd?: ListDnd;
}

/** DND of one list screen: the screen turns a drop target into API calls (features/dnd/listDrop.ts). */
export interface ListDnd {
  canDrag: (task: Task) => boolean;
  onDrop: (task: Task, target: ListDropTarget) => void;
}

/** scrollToIndex retries after onScrollToIndexFailed, and the gap after which a new failure counts as a new jump. */
export const MAX_SCROLL_RETRIES = 4;
const SCROLL_RETRY_WINDOW_MS = 500;

/**
 * Every task list of the app: section headers / task rows / custom nodes, pull to refresh, "load more" near the end
 * and with a footer button (spec 5.10), skeleton / offline / error placeholder when nothing is cached, swipe
 * "Schedule" through the shared ScheduleSheet (PATCH with the task's version).
 */
export function TaskListView(props: TaskListViewProps) {
  const outer = useDragApi();
  // A screen that also drops outside the list (Upcoming week strip) wraps header + list in its own DragProvider.
  if (props.dnd && !props.readOnly && !outer) {
    return (
      <DragProvider>
        <TaskListBody {...props} />
      </DragProvider>
    );
  }
  return <TaskListBody {...props} />;
}

function TaskListBody({
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
  dnd: dndProp,
}: TaskListViewProps) {
  const dnd = readOnly ? undefined : dndProp;
  const { dragging } = useDragState();
  const styles = useThemedStyles(createTaskListViewStyles);
  const { palette } = useTheme();
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
  const wrapperRef = useRef<ViewRef>(null);
  const scroll = useListAutoScroll(innerRef, wrapperRef, dnd !== undefined);
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
      const headerView = (
        <View style={styles.section}>
          <SectionHeader {...item.props} testID={`section-header-${item.key}`} />
        </View>
      );
      if (!dnd || item.drop === undefined) return headerView;
      const container = item.drop;
      return (
        <DropZone
          id={`start:${container}`}
          testID={`drop-start-${container}`}
          onDrop={(payload) => dnd.onDrop(payload.task, { kind: 'container', container, edge: 'start' })}
          overStyle={styles.zoneOver}
        >
          {headerView}
        </DropZone>
      );
    }
    if (item.type === 'node') {
      if (!dnd || item.drop === undefined) return <>{item.node}</>;
      const container = item.drop;
      return (
        <DropZone
          id={`end:${container}`}
          testID={`drop-end-${container}`}
          onDrop={(payload) => dnd.onDrop(payload.task, { kind: 'container', container, edge: 'end' })}
          overStyle={styles.zoneOver}
        >
          {item.node}
        </DropZone>
      );
    }
    const task = item.task;
    const row = (
      <TaskRow
        task={task}
        depth={item.depth}
        now={now}
        timeZone={timeZone}
        showProject={showProject}
        onToggle={toggle}
        onSchedule={setScheduling}
        toggleDisabled={pendingId === task.id}
        readOnly={readOnly}
        showCompletedTime={showCompletedTime}
        draggable={dnd ? dnd.canDrag(task) : false}
      />
    );
    if (!dnd) return row;
    const zoneId = `task:${task.id}`;
    return (
      <DropZone
        id={zoneId}
        testID={`drop-task-${task.id}`}
        onDrop={(payload, point) =>
          dnd.onDrop(payload.task, { kind: 'task', taskId: task.id, after: rowHalf(point.y, point.height ?? 0) })
        }
      >
        {row}
        <InsertLine zoneId={zoneId} />
      </DropZone>
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
    <View style={styles.fill} ref={wrapperRef} collapsable={false}>
      {message ? (
        <View style={styles.error}>
          <ErrorText message={message} testID={`${testID}-error`} />
        </View>
      ) : null}
      <FlatList
        ref={setListRef}
        {...(initialNumToRender === undefined ? {} : { initialNumToRender })}
        // DND: the finger moves the ghost, not the list (auto-scroll near the edges moves it instead)
        scrollEnabled={!dragging}
        onScroll={scroll.onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={scroll.onContentSizeChange}
        onLayout={scroll.onLayout}
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

function createTaskListViewStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    section: { paddingHorizontal: gutter },
    error: { paddingHorizontal: gutter },
    footer: { padding: 16, alignItems: 'center' },
    /** A header / "Add task" row under a dragged task. */
    zoneOver: { backgroundColor: palette.soft },
    /** Room for the FAB and the Undo toast above the tab bar. */
    content: { paddingBottom: FAB_CLEARANCE },
  });
}
