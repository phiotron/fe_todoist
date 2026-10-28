import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task } from '../../../api/models';
import { Chip } from '../../../components/Chip';
import { dateKeyInZone, describeDeadline, describeDue } from '../../../lib/dates';
import { useDisplayPrefs } from '../../../lib/dates/displayFormat';
import { formatDateKey, formatDueLabel } from '../../../lib/dates/format';
import { describeRecurrence } from '../../../lib/recurrence/describe';
import { fromRRule, toRRule } from '../../../lib/recurrence/rrule';
import type { RecurrenceSpec } from '../../../lib/recurrence/types';
import { size, type, useTheme, useThemedStyles } from '../../../theme';
import type { Palette } from '../../../theme/palette';
import { TaskReminderChip } from '../../reminders/TaskReminderChip';
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

/** The repeat fields to save with the due: only when the sheet's rule differs from the draft's (else the due alone changes). */
function repeatPatch(draft: TaskDraft, rule: RecurrenceSpec | null | undefined): Partial<TaskDraft> {
  if (rule === undefined) return {};
  const recurrenceRule = rule ? toRRule(rule) : null;
  const recurrenceFromCompletion = rule?.fromCompletion ?? false;
  const changed =
    recurrenceRule !== draft.recurrenceRule ||
    (recurrenceRule !== null && recurrenceFromCompletion !== draft.recurrenceFromCompletion);
  return changed ? { recurrenceRule, recurrenceFromCompletion } : {};
}

/** null = does not repeat; undefined = a rule outside the subset the app understands (never edited here). */
function repeatOf(draft: TaskDraft): RecurrenceSpec | null | undefined {
  if (!draft.recurrenceRule) return null;
  try {
    return { ...fromRRule(draft.recurrenceRule), fromCompletion: draft.recurrenceFromCompletion };
  } catch {
    return undefined;
  }
}

/**
 * M-TaskDetail rows after the description (spec 9.2 order): the **date row**, then the chips Deadline, Priority and
 * "Chuyển tới". M2 adds Labels, M4 Reminders, M12 Location, M8 Assignee to the chip row.
 */
export function TaskChips({ task, draft, now, timeZone, onCommit, onMove, readOnly = false }: TaskChipsProps) {
  const styles = useThemedStyles(createTaskChipsStyles);
  // Redraw when the user changes the date / time format (the formatting functions read the same store).
  useDisplayPrefs();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const [sheet, setSheet] = useState<Sheet>('none');
  const due: DueValue = { dueDate: draft.dueDate, dueDatetime: draft.dueDatetime, durationMinutes: draft.durationMinutes };
  const dueLabel = describeDue(due, now, timeZone);
  const tone = dueTone({ ...due, completedAt: task.completedAt }, now, timeZone, palette);
  const deadline = describeDeadline(draft.deadlineDate, now, timeZone);
  const deadlinePassed = deadline !== null && deadline.daysLeft < 0;
  // M6c: the rule as the sheet edits it. undefined = a rule this app cannot read: the Repeat row stays hidden so saving
  // the date never rewrites a rule the user did not touch.
  const repeatSpec = repeatOf(draft);

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
      {repeatSpec ? (
        <View style={styles.repeatRow} testID="task-repeat">
          <Feather name="repeat" size={size.iconSmall} color={palette.acc} />
          <Text style={[type.meta, styles.repeatText]} testID="task-repeat-text">
            {describeRecurrence(repeatSpec)}
          </Text>
        </View>
      ) : null}
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
          color={draft.priority < 4 ? priorityColor(draft.priority, palette) : undefined}
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
        <TaskReminderChip task={task} timeZone={timeZone} readOnly={readOnly} />
        <Chip large icon="arrow-right" label={t('taskDetail.move.chip')} disabled={readOnly} onPress={onMove} testID="task-move-chip" />
      </View>
      <ScheduleSheet
        visible={sheet === 'date'}
        value={due}
        repeat={repeatSpec}
        onSelect={(value, rule) =>
          onCommit({
            dueDate: value.dueDate,
            dueDatetime: value.dueDatetime,
            durationMinutes: value.durationMinutes,
            ...repeatPatch(draft, rule),
          })
        }
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

function createTaskChipsStyles(palette: Palette) {
  return StyleSheet.create({
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
    repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    repeatText: { flex: 1, color: palette.ink2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 4 },
  });
}
