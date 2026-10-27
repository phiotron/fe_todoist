import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { Task } from '../../api/models';
import { describeDeadline, describeDue, nowLocal } from '../../lib/dates';
import { formatDeadline, formatDueLabel } from '../../lib/dates/format';
import { parseInstant } from '../../lib/dates/instant';
import { size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { progressLabel } from '../subtasks/tree';
import { dueTone } from './dueTone';

interface TaskMetaProps {
  task: Task;
  now: Date;
  timeZone: string;
  showProject: boolean;
  /** Completed screen: "HH:mm" of completion (account time zone) instead of the due (M-Completed). */
  showCompletedTime?: boolean;
}

/** .meta line: due (date tone), deadline, sub-task progress, project / parent. M2 adds labels (.tag) here. */
export function TaskMeta({ task, now, timeZone, showProject, showCompletedTime = false }: TaskMetaProps) {
  const styles = useThemedStyles(createTaskMetaStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const due = describeDue(task, now, timeZone);
  const deadline = describeDeadline(task.deadlineDate, now, timeZone);
  const progress = progressLabel(task);
  const tone = dueTone(task, now, timeZone, palette);
  const completedTime = showCompletedTime && task.completedAt ? nowLocal(parseInstant(task.completedAt), timeZone).slice(11, 16) : null;
  const items = [
    completedTime ? (
      <Text key="completed-at" style={styles.text} testID={`task-completed-at-${task.id}`}>
        {completedTime}
      </Text>
    ) : null,
    due && !completedTime ? (
      <View key="due" style={styles.item} testID={`task-due-${task.id}`}>
        <Feather name={due.time ? 'clock' : 'calendar'} size={size.iconSmall - 2} color={tone} />
        <Text style={[type.meta, { color: tone }]}>{formatDueLabel(due)}</Text>
      </View>
    ) : null,
    deadline ? (
      <View key="deadline" style={styles.item} testID={`task-deadline-${task.id}`}>
        <Feather name="target" size={size.iconSmall - 2} color={deadline.daysLeft < 0 ? palette.warn : palette.mute} />
        <Text style={[type.meta, { color: deadline.daysLeft < 0 ? palette.warn : palette.mute }]}>{formatDeadline(deadline)}</Text>
      </View>
    ) : null,
    progress ? (
      <View
        key="progress"
        style={styles.item}
        testID={`task-progress-${task.id}`}
        accessibilityLabel={t('taskList.progress', { done: task.completedSubtaskCount, total: task.subtaskCount })}
      >
        <Feather name="list" size={size.iconSmall - 2} color={palette.mute} />
        <Text style={styles.text}>{progress}</Text>
      </View>
    ) : null,
    showProject && task.parentContent ? (
      <View key="parent" style={styles.item}>
        <Feather name="corner-down-right" size={size.iconSmall - 2} color={palette.mute} />
        <Text style={styles.text} numberOfLines={1}>
          {task.parentContent}
        </Text>
      </View>
    ) : null,
    showProject ? (
      <Text key="project" style={styles.text} numberOfLines={1}>
        {task.projectName}
      </Text>
    ) : null,
  ].filter(Boolean);
  if (items.length === 0) return null;
  return <View style={styles.meta}>{items}</View>;
}

function createTaskMetaStyles(palette: Palette) {
  return StyleSheet.create({
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginTop: 4 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    text: { ...type.meta, color: palette.mute },
  });
}
