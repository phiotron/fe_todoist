import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { Task } from '../../api/models';
import type { IconName } from '../../components/IconButton';
import { useIsOnline } from '../../lib/useIsOnline';
import { gutter, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { Checkbox } from './Checkbox';
import { useTaskSelection } from './selection';
import { swipeSide, useSwipeSettings, type SwipeAction } from './swipe';
import { TaskMeta } from './TaskMeta';
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
    SELECT: { icon: 'check-square', color: palette.acc },
    DELETE: { icon: 'trash-2', color: palette.warn, iconColor: palette.onwarn },
  };
}

/** .task row: checkbox, 16/500 title, one line of description, meta; swipe actions; long press = multi-select. */
export function TaskRow({
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
}: TaskRowProps) {
  const styles = useThemedStyles(createTaskRowStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const online = useIsOnline();
  const selection = useTaskSelection();
  const swipe = useSwipeSettings();
  const { requestDelete, dialog } = useDeleteTaskSwipe();
  const swipeRef = useRef<SwipeableMethods>(null);
  const completed = task.completedAt !== null;
  const selecting = selection?.active === true;
  const selected = selection?.ids.has(task.id) === true;
  // Completed tasks (Completed tasks block) and read-only rows cannot be selected: batch SCHEDULE / MOVE would answer 409 task-completed.
  const selectable = selection && !readOnly && !completed ? selection : null;

  function run(action: SwipeAction) {
    if (action === 'COMPLETE' && !completed) onToggle(task);
    else if (action === 'SCHEDULE') onSchedule?.(task);
    else if (action === 'SELECT') selection?.start(task.id);
    // Not deleted here: this only opens the confirmation (BR-11).
    else if (action === 'DELETE') requestDelete({ id: task.id, content: task.content, subtaskCount: task.subtaskCount });
  }

  const row = (
    <Pressable
      testID={`task-row-${task.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => (selecting ? selectable?.toggle(task.id) : router.push(`/task/${task.id}`))}
      onLongPress={selectable ? () => (selecting ? selectable.toggle(task.id) : selectable.start(task.id)) : undefined}
      style={[styles.row, { paddingLeft: gutter + (depth - 1) * INDENT }, selected && styles.selected]}
    >
      <Checkbox
        testID={`task-toggle-${task.id}`}
        priority={task.priority}
        checked={completed}
        label={completed ? t('taskList.reopenTask', { name: task.content }) : t('taskList.complete', { name: task.content })}
        disabled={readOnly || selecting || toggleDisabled || !online}
        onPress={() => onToggle(task)}
      />
      <View style={styles.body}>
        <Text style={[type.taskTitle, styles.title, completed && styles.done]} numberOfLines={2}>
          {task.content}
        </Text>
        {task.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {task.description}
          </Text>
        ) : null}
        <TaskMeta task={task} now={now} timeZone={timeZone} showProject={showProject} showCompletedTime={showCompletedTime} />
      </View>
    </Pressable>
  );

  if (readOnly || completed || selecting || !online) return row;
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
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
      renderLeftActions={swipe.right === 'NONE' ? undefined : () => renderPanel(swipe.right)}
      renderRightActions={swipe.left === 'NONE' ? undefined : () => renderPanel(swipe.left)}
      onSwipeableOpen={(direction: string) => {
        swipeRef.current?.close();
        run(swipeSide(direction) === 'right' ? swipe.right : swipe.left);
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
    body: { flex: 1 },
    title: { color: palette.ink },
    done: { color: palette.mute, textDecorationLine: 'line-through' },
    description: { ...type.meta, color: palette.mute, marginTop: 2 },
    panel: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  });
}
