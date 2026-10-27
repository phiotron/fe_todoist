import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task } from '../../../api/models';
import { Chip } from '../../../components/Chip';
import { dateKeyInZone, describeDeadline, describeDue } from '../../../lib/dates';
import { formatDateKey, formatDueLabel } from '../../../lib/dates/format';
import { palette, size, type } from '../../../theme';
import { NO_DUE, type DueValue } from '../../schedule/dueValue';
import { LabelChip } from '../../labels/LabelChip';
import { ScheduleSheet } from '../../schedule/ScheduleSheet';
import { dueTone } from '../dueTone';
import { priorityColor } from '../priority';
import { PriorityMenu } from '../PriorityMenu';
import type { TaskDraft } from './draft';

interface TaskChipsProps {
  task: Task;
  draft: TaskDraft;
  now: Date;
  timeZone: string;
  /** Saves the change at once (useTaskEditor.commit). */
  onCommit: (patch: Partial<TaskDraft>) => void;
  /** Opens the project picker (useTaskMove.start). */
  onMove: () => void;
  /** Completed task or archived project / section (`useTaskAccess(task).readOnly`): shows the values, changes nothing. */
  readOnly?: boolean;
}

type Sheet = 'none' | 'date' | 'deadline' | 'priority';

/**
 * M-TaskDetail rows after the description (spec 9.2 order): the **date row**, then the chips Deadline, Priority and
 * "Chuyển tới". M2 adds Labels, M4 Reminders, M12 Location, M8 Assignee to the chip row.
 */
export function TaskChips({ task, draft, now, timeZone, onCommit, onMove, readOnly = false }: TaskChipsProps) {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState<Sheet>('none');
  const due: DueValue = { dueDate: draft.dueDate, dueDatetime: draft.dueDatetime, durationMinutes: draft.durationMinutes };
  const dueLabel = describeDue(due, now, timeZone);
  const tone = dueTone({ ...due, completedAt: task.completedAt }, now, timeZone);
  const deadline = describeDeadline(draft.deadlineDate, now, timeZone);
  const deadlinePassed = deadline !== null && deadline.daysLeft < 0;

  return (
    <View>
      <Pressable
        testID="task-date"
        accessibilityRole="button"
        accessibilityLabel={t('taskDetail.date.row')}
        accessibilityState={{ disabled: readOnly }}
        disabled={readOnly}
        onPress={() => setSheet('date')}
        style={styles.dateRow}
      >
        <Feather name={dueLabel?.time ? 'clock' : 'calendar'} size={size.icon} color={dueLabel ? tone : palette.mute} />
        <Text style={[type.bodyStrong, styles.dateText, { color: dueLabel ? tone : palette.mute }]}>
          {dueLabel ? formatDueLabel(dueLabel) : t('taskDetail.date.add')}
        </Text>
        <Feather name="chevron-right" size={size.iconSmall} color={palette.mute} />
      </Pressable>
      <View style={styles.chips}>
        <Chip
          large
          icon="target"
          label={deadline ? t('taskDetail.deadline.chipWithDate', { date: formatDateKey(deadline.dateKey, deadline.dateKey.slice(0, 4) !== dateKeyInZone(now, timeZone).slice(0, 4)) }) : t('taskDetail.deadline.chip')}
          color={deadlinePassed ? palette.warn : undefined}
          disabled={readOnly}
          onPress={() => setSheet('deadline')}
          testID="task-deadline-chip"
        />
        <Chip
          large
          icon="flag"
          label={`P${draft.priority}`}
          accessibilityLabel={t('taskDetail.priority.chip', { n: draft.priority })}
          color={draft.priority < 4 ? priorityColor(draft.priority) : undefined}
          disabled={readOnly}
          onPress={() => setSheet('priority')}
          testID="task-priority-chip"
        />
        <LabelChip
          large
          labelIds={draft.labelIds}
          onChange={(labelIds) => onCommit({ labelIds })}
          disabled={readOnly}
          testID="task-label-chip"
        />
        <Chip large icon="arrow-right" label={t('taskDetail.move.chip')} disabled={readOnly} onPress={onMove} testID="task-move-chip" />
      </View>
      <ScheduleSheet
        visible={sheet === 'date'}
        value={due}
        onSelect={(value) => onCommit({ dueDate: value.dueDate, dueDatetime: value.dueDatetime, durationMinutes: value.durationMinutes })}
        onClose={() => setSheet('none')}
        testID="task-date-sheet"
      />
      <ScheduleSheet
        visible={sheet === 'deadline'}
        mode="date"
        title={t('taskDetail.deadline.title')}
        noDateLabel={t('taskDetail.deadline.remove')}
        value={draft.deadlineDate ? { ...NO_DUE, dueDate: draft.deadlineDate } : NO_DUE}
        onSelect={(value) => onCommit({ deadlineDate: value.dueDate })}
        onClose={() => setSheet('none')}
        testID="task-deadline-sheet"
      />
      <PriorityMenu visible={sheet === 'priority'} value={draft.priority} onSelect={(priority) => onCommit({ priority })} onClose={() => setSheet('none')} bottom={300} />
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  dateText: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 4 },
});
