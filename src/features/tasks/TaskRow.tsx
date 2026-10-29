import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { Task } from '../../api/models';
import type { IconName } from '../../components/IconButton';
import { openTaskReminders } from '../reminders/openTaskReminders';
import { gutter, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { Draggable, useDragState } from '../dnd/dnd';
import { Checkbox } from './Checkbox';
import { TaskRowEnvProvider, useTaskRowEnv, type TaskRowEnv } from './taskRowEnv';
import { useTaskSelection } from './selection';
import { swipeSide, useSwipeSettings, type SwipeAction } from './swipe';
import { useSwipeArmed } from './swipeArming';
import { TaskMeta } from './TaskMeta';
import { displayContent, isUncompletable } from './uncompletable';
import { useDeleteTaskSwipe } from './useDeleteTaskSwipe';

const INDENT = 24;

export interface TaskRowProps {
  task: Task;
  /** 1 = root; each level indents by 24. */
  depth?: number;
  now: Date;
  timeZone: string;
  /** Aggregated views: show the project (and parent) name. */
  showProject?: boolean;
  onToggle: (task: Task) => void;
  /** Swipe "Schedule": open the date picker for this task. */
  onSchedule?: (task: Task) => void;
  toggleDisabled?: boolean;
  /** Archived project: nothing can change (decision #22). */
  readOnly?: boolean;
  /** Completed screen: show the completion time in the meta line. */
  showCompletedTime?: boolean;
  /**
   * DND in lists: the row can be lifted and dragged (Todoist): hold then move = drag, hold then release = multi-select.
   * Needs an enclosing DragProvider (TaskListView adds it). Off in the multi-select mode.
   */
  draggable?: boolean;
}

interface SwipeLook {
  icon: IconName;
  color: string;
  /** Icon colour on the panel; defaults to the on-accent colour. */
  iconColor?: string;
}

function swipeLookFor(palette: Palette): Partial<Record<SwipeAction, SwipeLook>> {
  return {
    COMPLETE: { icon: 'check-circle', color: palette.ok },
    SCHEDULE: { icon: 'calendar', color: palette.vio },
    REMINDERS: { icon: 'bell', color: palette.p2 },
    SELECT: { icon: 'check-square', color: palette.acc },
    DELETE: { icon: 'trash-2', color: palette.warn, iconColor: palette.onwarn },
  };
}

/**
 * .task row: checkbox, 16/500 title, one line of description, meta; swipe actions; long press = multi-select.
 * Memoised (the list passes stable props, so a refetch / minute tick only redraws rows that changed) and reads shared
 * data from the list's TaskRowEnv; a row outside a list builds its own.
 */
export const TaskRow = memo(function TaskRow(props: TaskRowProps) {
  const env = useTaskRowEnv();
  if (env) return <TaskRowView {...props} env={env} />;
  return (
    <TaskRowEnvProvider fetchLists={props.showProject ?? false}>
      <TaskRowWithEnv {...props} />
    </TaskRowEnvProvider>
  );
});

function TaskRowWithEnv(props: TaskRowProps) {
  const env = useTaskRowEnv();
  return env ? <TaskRowView {...props} env={env} /> : null;
}

function TaskRowView({
  task,
  depth = 1,
  now,
  timeZone,
  showProject = false,
  onToggle,
  onSchedule,
  toggleDisabled = false,
  readOnly = false,
  showCompletedTime = false,
  draggable = false,
  env,
}: TaskRowProps & { env: TaskRowEnv }) {
  const styles = useThemedStyles(createTaskRowStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const online = env.online;
  const selection = useTaskSelection();
  const swipe = useSwipeSettings();
  const { requestDelete, dialog } = useDeleteTaskSwipe();
  const swipeRef = useRef<SwipeableMethods>(null);
  const armed = useSwipeArmed(env.arming, task.id);
  // PERM: task of a team project where I am a Member / Guest → tick only (no other swipe; selection offers only Complete)
  const capabilities = env.capabilitiesOf(task.projectId);
  const completeOnly = capabilities.canCompleteTasks && !capabilities.canEditTasks;
  const selectOptions = completeOnly ? { completeOnly: true } : undefined;
  const completed = task.completedAt !== null;
  // REVIEW: pending = asked for review (still open). A Member may cancel only their own request, and cannot reopen a
  // completed task of a team project (only admins complete there); an admin's circle is never locked.
  const pending = task.reviewStatus === 'PENDING';
  const mineRequest = pending && env.meId !== null && task.reviewRequestedBy === env.meId;
  const lockedPending = completeOnly && pending && env.meId !== null && !mineRequest;
  const lockedDone = completeOnly && completed;
  const selecting = selection?.active === true;
  const selected = selection?.ids.has(task.id) === true;
  // Completed tasks (Completed tasks block) and read-only rows cannot be selected: batch SCHEDULE / MOVE would answer 409 task-completed.
  const selectable = selection && !readOnly && !completed ? selection : null;
  const swipeRight = completeOnly && swipe.right !== 'COMPLETE' ? 'NONE' : swipe.right;
  const swipeLeft = completeOnly && swipe.left !== 'COMPLETE' ? 'NONE' : swipe.left;

  const uncompletable = isUncompletable(task.content);
  const drag = useDragState();
  const dragging = drag.dragging;
  const beingDragged = drag.payload?.task.id === task.id;

  function run(action: SwipeAction) {
    if (action === 'COMPLETE' && !completed) {
      if (!uncompletable && !lockedPending) onToggle(task);
    }
    else if (action === 'SCHEDULE') onSchedule?.(task);
    else if (action === 'REMINDERS') openTaskReminders(router, task.id);
    else if (action === 'SELECT') selection?.start(task.id);
    // Not deleted here: this only opens the confirmation (BR-11).
    else if (action === 'DELETE') requestDelete({ id: task.id, content: task.content, subtaskCount: task.subtaskCount });
  }

  const onPress = () => (selecting ? selectable?.toggle(task.id, selectOptions) : router.push(`/task/${task.id}`));
  const onLongPress = selectable
    ? () => (selecting ? selectable.toggle(task.id, selectOptions) : selectable.start(task.id, selectOptions))
    : undefined;
  const rowStyle = [styles.row, { paddingLeft: gutter + (depth - 1) * INDENT }, selected && styles.selected, beingDragged && styles.lifted];
  // PERM × DND: a Member / Guest of a team project cannot move or reschedule its tasks → no drag (hold still selects, Complete only).
  const canDrag = draggable && capabilities.canEditTasks && !readOnly && !completed && !selecting;
  const content = (
    <>
      {uncompletable ? (
        <View testID={`task-note-${task.id}`} style={styles.noteGap} />
      ) : (
        <Checkbox
          testID={`task-toggle-${task.id}`}
          priority={task.priority}
          checked={completed}
          pending={pending}
          label={
            lockedDone
              ? t('review.lockedDone', { name: task.content })
              : completed
                ? t('taskList.reopenTask', { name: task.content })
                : mineRequest
                  ? t('review.cancelTask', { name: task.content })
                  : lockedPending
                    ? t('review.pendingTask', { name: task.content })
                    : t('taskList.complete', { name: task.content })
          }
          disabled={readOnly || selecting || toggleDisabled || !online || lockedPending}
          onPress={() => (lockedDone ? env.explainLockedDone() : onToggle(task))}
        />
      )}
      <View style={styles.body}>
        <Text style={[type.taskTitle, styles.title, completed && styles.done]} numberOfLines={2}>
          {displayContent(task.content)}
        </Text>
        {task.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {task.description}
          </Text>
        ) : null}
        <TaskMeta task={task} now={now} timeZone={timeZone} showProject={showProject} showCompletedTime={showCompletedTime} />
      </View>
    </>
  );
  const row = canDrag ? (
    <Draggable
      testID={`task-row-${task.id}`}
      accessibilityState={{ selected }}
      enabled
      payload={() => ({ taskIds: [task.id], task })}
      onPress={onPress}
      onLongPress={onLongPress}
      style={rowStyle}
    >
      {content}
    </Draggable>
  ) : (
    <Pressable
      testID={`task-row-${task.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={rowStyle}
    >
      {content}
    </Pressable>
  );

  if (!armed || readOnly || completed || selecting || !online || (completeOnly && swipeRight === 'NONE' && swipeLeft === 'NONE')) return row;
  const renderPanel = (action: SwipeAction) => {
    const look = swipeLookFor(palette)[action];
    if (!look) return null;
    return (
      <View style={[styles.panel, { backgroundColor: look.color }]}>
        <Feather name={look.icon} size={size.iconLarge} color={look.iconColor ?? palette.onacc} />
      </View>
    );
  };
  const swipeable = (
    <Swipeable
      ref={swipeRef}
      testID={`task-swipe-${task.id}`}
      // a drag in progress must not turn into a swipe (same tree either way, so the lifted row keeps its touch)
      enabled={!dragging}
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
      renderLeftActions={swipeRight === 'NONE' ? undefined : () => renderPanel(swipeRight)}
      renderRightActions={swipeLeft === 'NONE' ? undefined : () => renderPanel(swipeLeft)}
      onSwipeableOpen={(direction: string) => {
        swipeRef.current?.close();
        run(swipeSide(direction) === 'right' ? swipeRight : swipeLeft);
      }}
    >
      {row}
    </Swipeable>
  );
  return (
    <>
      {swipeable}
      {dialog}
    </>
  );
}

function createTaskRowStyles(palette: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 12,
      paddingRight: gutter,
      backgroundColor: palette.bg,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    selected: { backgroundColor: palette.soft },
    /** The row being dragged stays in place, faded, while its ghost follows the finger. */
    lifted: { opacity: 0.4 },
    body: { flex: 1 },
    /** Where the checkbox would be: keeps the name aligned with the other rows. */
    noteGap: { width: size.touch / 2 },
    title: { color: palette.ink },
    done: { color: palette.mute, textDecorationLine: 'line-through' },
    description: { ...type.meta, color: palette.mute, marginTop: 2 },
    panel: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  });
}
