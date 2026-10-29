import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { Task } from '../../api/models';
import { AddRow } from '../../components/AddRow';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { SectionHeader } from '../../components/SectionHeader';
import { FAB_CLEARANCE } from '../../components/tabBarMetrics';
import { useIsOnline } from '../../lib/useIsOnline';
import type { PagedQuery } from '../../lib/usePagedList';
import { useNow } from '../../lib/useNow';
import { gutter, radius, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { DragProvider, Draggable, DropZone, useDragState, type DragPayload } from '../dnd/dnd';
import { openQuickAdd } from '../quickAdd/quickAddTarget';
import { Checkbox } from '../tasks/Checkbox';
import { useTaskSelection, type TaskSelection } from '../tasks/selection';
import { TaskMeta } from '../tasks/TaskMeta';
import { useToggleTask } from '../tasks/useTaskActions';
import { isDraggable, planColumnDrop, type BoardColumn } from './boardColumns';
import { useTaskDrop } from './useTaskDrop';

export const COLUMN_WIDTH = 288;
/** Pixels from the right edge at which a lazily loaded board (Upcoming) asks for the next window. */
const NEAR_END = COLUMN_WIDTH * 2;

interface BoardViewProps {
  columns: readonly BoardColumn[];
  /** The list query behind the columns: every page is loaded (a board shows the whole view). */
  query: PagedQuery;
  readOnly?: boolean;
  showProject?: boolean;
  /** false = pages load on demand when the board is scrolled near its right edge (Upcoming: day windows up to 2 years). */
  autoLoadAll?: boolean;
  testID?: string;
}

/** The tasks a drag carries: the whole selection when the card is part of it, else the card alone (draggable ones only). */
export function dragTaskIds(task: Task, selection: { active: boolean; ids: ReadonlySet<string> } | null, all: readonly Task[]): string[] {
  if (!selection?.active || !selection.ids.has(task.id)) return [task.id];
  const draggable = new Set(all.filter((item) => isDraggable(item)).map((item) => item.id));
  return [...selection.ids].filter((id) => draggable.has(id));
}

interface BoardCardProps {
  task: Task;
  readOnly: boolean;
  showProject: boolean;
  now: Date;
  timeZone: string;
  online: boolean;
  selecting: boolean;
  selected: boolean;
  /** This card's own checkbox is waiting for its request. */
  pending: boolean;
  toggle: (task: Task) => void;
  /** Read when a drag starts / the card is tapped: the selection may have changed since the last render. */
  selectionRef: RefObject<TaskSelection | null>;
  allTasksRef: RefObject<readonly Task[]>;
}

/**
 * PERF4: a card owns NO hook that talks to the network or a store (it used to run useToggleTask = 4 mutations,
 * useIsOnline = a NetInfo listener, useUserTimeZone, useTaskSelection... 320 times on an 8 x 40 board). Everything
 * shared comes in as props, so React.memo keeps a card still while a drag starts or another card is selected.
 */
const BoardCard = memo(function BoardCard({ task, readOnly, showProject, now, timeZone, online, selecting, selected, pending, toggle, selectionRef, allTasksRef }: BoardCardProps) {
  const styles = useThemedStyles(createBoardStyles);
  const { t } = useTranslation();
  const canDrag = online && isDraggable(task, readOnly);
  const payload = useCallback(
    (): DragPayload => ({ taskIds: dragTaskIds(task, selectionRef.current, allTasksRef.current ?? []), task }),
    [task, selectionRef, allTasksRef],
  );
  const open = useCallback(() => {
    const selection = selectionRef.current;
    if (selection?.active) selection.toggle(task.id);
    else router.push(`/task/${task.id}`);
  }, [task.id, selectionRef]);
  const complete = useCallback(() => toggle(task), [toggle, task]);

  return (
    <Draggable
      testID={`board-card-${task.id}`}
      accessibilityLabel={t('board.openTask', { name: task.content })}
      enabled={canDrag}
      payload={payload}
      onPress={open}
      style={selected ? [styles.card, styles.cardSelected] : styles.card}
    >
      <Checkbox
        testID={`board-toggle-${task.id}`}
        priority={task.priority}
        checked={task.completedAt !== null}
        label={t('taskList.complete', { name: task.content })}
        disabled={readOnly || selecting || !online || pending}
        onPress={complete}
      />
      <View style={styles.cardBody}>
        <Text style={[type.taskTitle, styles.cardTitle]} numberOfLines={3}>
          {task.content}
        </Text>
        <TaskMeta task={task} now={now} timeZone={timeZone} showProject={showProject} />
      </View>
    </Draggable>
  );
});

interface ColumnProps {
  column: BoardColumn;
  readOnly: boolean;
  showProject: boolean;
  now: Date;
  timeZone: string;
  online: boolean;
  selecting: boolean;
  selectedIds: ReadonlySet<string> | null;
  pendingId: unknown;
  toggle: (task: Task) => void;
  selectionRef: RefObject<TaskSelection | null>;
  allTasksRef: RefObject<readonly Task[]>;
  onDrop: (column: BoardColumn, payload: DragPayload) => void;
}

const keyOfTask = (task: Task) => task.id;

/**
 * A column is a FlatList: only the cards near the screen exist (a board of 320 cards used to mount all of them at once,
 * inside nested ScrollViews). The header / empty text / "+ Add task" ride along as list parts.
 */
const Column = memo(function Column({ column, readOnly, showProject, now, timeZone, online, selecting, selectedIds, pendingId, toggle, selectionRef, allTasksRef, onDrop }: ColumnProps) {
  const styles = useThemedStyles(createBoardStyles);
  const { t } = useTranslation();
  const { dragging } = useDragState();
  const open = useMemo(() => column.tasks.filter((task) => task.completedAt === null).length, [column.tasks]);
  const add = column.add;
  const renderItem = useCallback(
    ({ item: task }: { item: Task }) => (
      <BoardCard
        task={task}
        readOnly={readOnly}
        showProject={showProject}
        now={now}
        timeZone={timeZone}
        online={online}
        selecting={selecting}
        selected={selectedIds?.has(task.id) === true}
        pending={pendingId === task.id}
        toggle={toggle}
        selectionRef={selectionRef}
        allTasksRef={allTasksRef}
      />
    ),
    [readOnly, showProject, now, timeZone, online, selecting, selectedIds, pendingId, toggle, selectionRef, allTasksRef],
  );
  const accepts = useCallback(() => column.drop !== null, [column.drop]);
  const drop = useCallback((payload: DragPayload) => onDrop(column, payload), [onDrop, column]);
  return (
    <DropZone
      id={column.key}
      testID={`board-column-${column.key}`}
      accepts={accepts}
      onDrop={drop}
      style={styles.column}
      overStyle={styles.columnOver}
    >
      <SectionHeader title={column.title} count={open} tone={column.tone} testID={`board-column-header-${column.key}`} />
      <FlatList
        data={column.tasks}
        keyExtractor={keyOfTask}
        renderItem={renderItem}
        extraData={renderItem}
        scrollEnabled={!dragging}
        contentContainerStyle={styles.columnContent}
        nestedScrollEnabled
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<Text style={styles.empty}>{t('board.empty')}</Text>}
        ListFooterComponent={
          add && !readOnly ? (
            <AddRow label={t('board.addTask')} requiresOnline onPress={() => openQuickAdd(add)} testID={`board-add-${column.key}`} />
          ) : undefined
        }
      />
    </DropZone>
  );
});

function Columns({ columns, readOnly, showProject, testID, onNearEnd }: Required<Pick<BoardViewProps, 'readOnly' | 'showProject' | 'testID'>> & { columns: readonly BoardColumn[]; onNearEnd?: () => void }) {
  const styles = useThemedStyles(createBoardStyles);
  const { dragging } = useDragState();
  const selection = useTaskSelection();
  const drop = useTaskDrop();
  const online = useIsOnline();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const { toggle, pendingId } = useToggleTask();
  const allTasks = useMemo(() => columns.flatMap((column) => column.tasks), [columns]);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const allTasksRef = useRef<readonly Task[]>(allTasks);
  allTasksRef.current = allTasks;
  const dropRef = useRef({ sendBatch: drop.sendBatch, selection });
  dropRef.current = { sendBatch: drop.sendBatch, selection };

  const onDrop = useCallback((column: BoardColumn, payload: DragPayload) => {
    const body = planColumnDrop(column, payload.taskIds);
    if (!body) return;
    void dropRef.current.sendBatch(body).then(() => {
      if (payload.taskIds.length > 1) dropRef.current.selection?.clear();
    });
  }, []);

  const selecting = selection?.active === true;
  const selectedIds = selecting ? (selection?.ids ?? null) : null;

  return (
    <ScrollView
      horizontal
      scrollEnabled={!dragging}
      testID={testID}
      contentContainerStyle={styles.board}
      scrollEventThrottle={64}
      onScroll={
        onNearEnd
          ? (event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              if (contentOffset.x + layoutMeasurement.width >= contentSize.width - NEAR_END) onNearEnd();
            }
          : undefined
      }
    >
      {columns.map((column) => (
        <Column
          key={column.key}
          column={column}
          readOnly={readOnly}
          showProject={showProject}
          now={now}
          timeZone={timeZone}
          online={online}
          selecting={selecting}
          selectedIds={selectedIds}
          pendingId={pendingId}
          toggle={toggle}
          selectionRef={selectionRef}
          allTasksRef={allTasksRef}
          onDrop={onDrop}
        />
      ))}
    </ScrollView>
  );
}

/**
 * M7 Board (plan M7 F3): one column per section / group / day, scrolled sideways. Long press a card and drag it onto
 * another column: one tasks/batch request (MOVE to the section, SCHEDULE to the day, PRIORITY). With multi-select, a
 * selected card carries the whole selection. Sub-tasks and completed tasks do not move; tap = open the task.
 */
export function BoardView({ columns, query, readOnly = false, showProject = false, autoLoadAll = true, testID = 'board' }: BoardViewProps) {
  const styles = useThemedStyles(createBoardStyles);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (autoLoadAll && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [autoLoadAll, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (query.isPending || (query.isError && columns.every((column) => column.tasks.length === 0))) {
    return <QueryStateView query={query} testID={`${testID}-state`} />;
  }
  return (
    <DragProvider style={styles.fill}>
      {query.isError ? (
        <View style={styles.pad}>
          <ErrorText message={describeError(query.error).message} testID={`${testID}-error`} />
        </View>
      ) : null}
      <Columns
        columns={columns}
        readOnly={readOnly}
        showProject={showProject}
        testID={testID}
        onNearEnd={!autoLoadAll && hasNextPage && !isFetchingNextPage ? () => void fetchNextPage() : undefined}
      />
    </DragProvider>
  );
}

function createBoardStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    pad: { paddingHorizontal: gutter },
    board: { paddingHorizontal: gutter / 2, paddingBottom: FAB_CLEARANCE, gap: 12 },
    column: {
      width: COLUMN_WIDTH,
      paddingHorizontal: 8,
      paddingTop: 4,
      borderRadius: radius.control,
      backgroundColor: palette.soft,
    },
    columnOver: { borderWidth: 2, borderColor: palette.acc },
    columnContent: { gap: 8, paddingBottom: 16 },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: radius.control,
      backgroundColor: palette.bg,
      borderWidth: 1,
      borderColor: palette.line,
    },
    cardSelected: { borderColor: palette.acc },
    cardBody: { flex: 1 },
    cardTitle: { color: palette.ink },
    empty: { ...type.meta, color: palette.mute, paddingVertical: 8 },
  });
}
