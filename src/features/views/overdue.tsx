import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../../api/describeError';
import type { Task } from '../../api/models';
import { AppButton } from '../../components/AppButton';
import type { Palette } from '../../theme/palette';
import { useSnackbar } from '../../components/Snackbar';
import i18n from '../../i18n';
import { dateKeyInZone } from '../../lib/dates';
import { useNow } from '../../lib/useNow';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { NO_DUE } from '../schedule/dueValue';
import { ScheduleSheet } from '../schedule/ScheduleSheet';
import { sectionRow, taskRows, type TaskListRow } from '../tasks/taskRows';
import { useRescheduleOverdue } from '../tasks/useTaskActions';

interface OverdueRowsOptions {
  collapsed: boolean;
  onToggle: () => void;
  onReschedule: () => void;
}

/**
 * "Quá hạn" (warn) + count + "Dời lịch", then its tasks unless collapsed (Today and Upcoming). `tasks` = the Overdue BLOCK
 * (due day before today, spec 5.1): already split by `groupTodayView` / `view=overdue`, never by `isOverdue`.
 */
export function overdueRows(
  tasks: readonly Task[],
  { collapsed, onToggle, onReschedule }: OverdueRowsOptions,
  palette: Palette,
): TaskListRow[] {
  if (tasks.length === 0) return [];
  const reschedule = (
    <AppButton
      variant="ghost"
      size="sm"
      color={palette.acc}
      label={i18n.t('views.overdue.reschedule')}
      onPress={onReschedule}
      requiresOnline
      testID="overdue-reschedule"
    />
  );
  return [
    sectionRow('overdue', { title: i18n.t('views.overdue.title'), count: tasks.length, tone: 'danger', collapsed, onToggle, right: reschedule }),
    ...(collapsed ? [] : taskRows(tasks)),
  ];
}

/**
 * Reschedule flow: `start()` opens the day picker, picking a day sends one request and shows the result as a toast.
 * Spec 12.5: only days ≥ today can be chosen (`minDate`); timed tasks keep their time.
 */
export function useOverdueReschedule(): { start: () => void; sheet: ReactNode; errorMessage: string | undefined } {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const reschedule = useRescheduleOverdue();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const [open, setOpen] = useState(false);
  const sheet = (
    <ScheduleSheet
      visible={open}
      mode="date"
      allowNoDate={false}
      minDate={dateKeyInZone(now, timeZone)}
      title={t('views.overdue.rescheduleTitle')}
      value={NO_DUE}
      onSelect={(due) => {
        if (!due.dueDate) return;
        reschedule.mutate(due.dueDate, {
          onSuccess: (result) =>
            snackbar.show({ message: t('views.overdue.rescheduled', { n: result.affectedTaskIds.length }) }),
        });
      }}
      onClose={() => setOpen(false)}
      testID="reschedule"
    />
  );
  return {
    start: () => setOpen(true),
    sheet,
    errorMessage: reschedule.error ? describeError(reschedule.error).message : undefined,
  };
}
