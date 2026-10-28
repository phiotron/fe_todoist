import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useTaskSelection } from '../tasks/selection';
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

function BoardCard({ task, readOnly, showProject, allTasks }: { task: Task; readOnly: boolean; showProject: boolean; allTasks: readonly Task[] }) {
  const styles = useThemedStyles(createBoardStyles);
  const { t } = useTranslation();
  const online = useIsOnline();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const selection = useTaskSelection();
  const { toggle, pendingId } = useToggleTask();
  const selecting = selection?.active === true;
  const selected = selection?.ids.has(task.id) === true;
  const canDrag = online && isDraggable(task, readOnly);

  return (
    <Draggable
      testID={`board-card-${task.id}`}
      accessibilityLabel={t('board.openTask', { name: task.content })}
      enabled={canDrag}
      payload={(): DragPayload => ({ taskIds: dragTaskIds(task, selection, allTasks), task })}
      onPress={() => (selecting ? selection?.toggle(task.id) : router.push(`/task/${task.id}`))}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <Checkbox
        testID={`board-toggle-${task.id}`}
        priority={task.priority}
        checked={task.completedAt !== null}
        label={t('taskList.complete', { name: task.content })}
        disabled={readOnly || selecting || !online || pendingId === task.id}
        onPress={() => toggle(task)}
      />
      <View style={styles.cardBody}>
        <Text style={[type.taskTitle, styles.cardTitle]} numberOfLines={3}>
          {task.content}
        </Text>
        <TaskMeta task={task} now={now} timeZone={timeZone} showProject={showProject} />
      </View>
    </Draggable>
  );
}

function Column({ column, readOnly, showProject, allTasks, onDrop }: {
  column: BoardColumn;
  readOnly: boolean;
  showProject: boolean;
  allTasks: readonly Task[];
  onDrop: (column: BoardColumn, payload: DragPayload) => void;
}) {
  const styles = useThemedStyles(createBoardStyles);
  const { t } = useTranslation();
  const { dragging } = useDragState();
  const open = column.tasks.filter((task) => task.completedAt === null).length;
  const add = column.add;
  return (
    <DropZone
      id={column.key}
      testID={`board-column-${column.key}`}
      accepts={() => column.drop !== null}
      onDrop={(payload) => onDrop(column, payload)}
      style={styles.column}
      overStyle={styles.columnOver}
    >
      <SectionHeader title={column.title} count={open} tone={column.tone} testID={`board-column-header-${column.key}`} />
      <ScrollView scrollEnabled={!dragging} contentContainerStyle={styles.columnContent} nestedScrollEnabled>
        {column.tasks.length === 0 ? <Text style={styles.empty}>{t('board.empty')}</Text> : null}
        {column.tasks.map((task) => (
          <BoardCard key={task.id} task={task} readOnly={readOnly} showProject={showProject} allTasks={allTasks} />
        ))}
        {add && !readOnly ? (
          <AddRow
            label={t('board.addTask')}
            requiresOnline
            onPress={() => openQuickAdd(add)}
            testID={`board-add-${column.key}`}
          />
        ) : null}
      </ScrollView>
    </DropZone>
  );
}

function Columns({ columns, readOnly, showProject, testID, onNearEnd }: Required<Pick<BoardViewProps, 'readOnly' | 'showProject' | 'testID'>> & { columns: readonly BoardColumn[]; onNearEnd?: () => void }) {
  const styles = useThemedStyles(createBoardStyles);
  const { dragging } = useDragState();
  const selection = useTaskSelection();
  const drop = useTaskDrop();
  const allTasks = columns.flatMap((column) => column.tasks);

  function onDrop(column: BoardColumn, payload: DragPayload) {
    const body = planColumnDrop(column, payload.taskIds);
    if (!body) return;
    void drop.sendBatch(body).then(() => {
      if (payload.taskIds.length > 1) selection?.clear();
    });
  }

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
          allTasks={allTasks}
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
