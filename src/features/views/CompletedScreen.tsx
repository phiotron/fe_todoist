import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { Task, TaskListParams } from '../../api/models';
import { Chip } from '../../components/Chip';
import { StateView } from '../../components/StateView';
import { SubHeader } from '../../components/SubHeader';
import { addDays, dateKeyInZone, nowLocal } from '../../lib/dates';
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDateKey, weekdayName } from '../../lib/dates/format';
import { parseInstant } from '../../lib/dates/instant';
import { useNow } from '../../lib/useNow';
import { gutter, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { NO_DUE, type DueValue } from '../schedule/dueValue';
import { ScheduleSheet } from '../schedule/ScheduleSheet';
import { TaskListView } from '../tasks/TaskListView';
import { sectionRow, taskRows, type TaskListRow } from '../tasks/taskRows';
import { useTaskList } from '../tasks/useTaskList';

/**
 * Completed (M-Completed, tab "Tasks"): `GET tasks?view=completed[&since&until]` — completed tasks of every project
 * (one row per task, sub-tasks included; archived projects left out) grouped by the day they were completed in the
 * ACCOUNT time zone, newest first; the filled circle reopens a task. `since` / `until` = whole days of the account zone,
 * both ends included; the screen never sends since > until (400). The Activity log tab is M10.
 */
export function CompletedScreen() {
  const styles = useThemedStyles(createCompletedScreenStyles);
  // Redraw when the user changes the date / time format (the formatting functions read the same store).
  useDisplayPrefs();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const today = dateKeyInZone(now, timeZone);
  const [since, setSince] = useState<string>();
  const [until, setUntil] = useState<string>();
  const [picker, setPicker] = useState<'since' | 'until' | null>(null);
  const params = useMemo<TaskListParams>(() => ({ view: 'completed', since, until }), [since, until]);
  const { query, tasks } = useTaskList(params);
  const showYear = (key: string) => key.slice(0, 4) !== today.slice(0, 4);

  function chooseSince(due: DueValue) {
    const next = due.dueDate ?? undefined;
    setSince(next);
    // A range running backwards is a 400: a since after the until drops the until.
    if (next && until && next > until) setUntil(undefined);
  }

  const rows = useMemo(() => {
    const byDay = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.completedAt) continue;
      const day = nowLocal(parseInstant(task.completedAt), timeZone).slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), task]);
    }
    const result: TaskListRow[] = [];
    for (const [day, list] of byDay) {
      const weekday = weekdayName(day);
      const title =
        day === today
          ? t('views.completed.today', { weekday })
          : day === addDays(today, -1)
            ? t('views.completed.yesterday', { weekday })
            : t('views.completed.day', { weekday, date: formatDateKey(day, day.slice(0, 4) !== today.slice(0, 4)) });
      result.push(sectionRow(`c-${day}`, { title, count: list.length }), ...taskRows(list));
    }
    return result;
  }, [tasks, timeZone, today, t]);

  return (
    <View style={styles.fill}>
      <SubHeader title={t('views.completed.title')} onBack={() => router.back()} testID="completed-header" />
      <View style={styles.range}>
        <Chip
          large
          icon="calendar"
          selected={since !== undefined}
          label={since ? t('views.completed.sinceChip', { date: formatDateKey(since, showYear(since)) }) : t('views.completed.sinceEmpty')}
          onPress={() => setPicker('since')}
          testID="completed-since-chip"
        />
        <Chip
          large
          icon="calendar"
          selected={until !== undefined}
          label={until ? t('views.completed.untilChip', { date: formatDateKey(until, showYear(until)) }) : t('views.completed.untilEmpty')}
          onPress={() => setPicker('until')}
          testID="completed-until-chip"
        />
      </View>
      <TaskListView
        rows={rows}
        query={query}
        showProject
        showCompletedTime
        testID="completed-list"
        empty={
          <StateView
            tone="ok"
            icon="check-circle"
            title={since || until ? t('views.completed.emptyRange') : t('views.completed.emptyTitle')}
            testID="completed-empty"
          />
        }
      />
      <ScheduleSheet
        visible={picker === 'since'}
        mode="date"
        title={t('views.completed.sinceTitle')}
        noDateLabel={t('views.completed.noBound')}
        value={since ? { ...NO_DUE, dueDate: since } : NO_DUE}
        onSelect={chooseSince}
        onClose={() => setPicker(null)}
        testID="completed-since"
      />
      <ScheduleSheet
        visible={picker === 'until'}
        mode="date"
        title={t('views.completed.untilTitle')}
        noDateLabel={t('views.completed.noBound')}
        minDate={since}
        value={until ? { ...NO_DUE, dueDate: until } : NO_DUE}
        onSelect={(due) => setUntil(due.dueDate ?? undefined)}
        onClose={() => setPicker(null)}
        testID="completed-until"
      />
    </View>
  );
}

function createCompletedScreenStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    range: { flexDirection: 'row', gap: 8, paddingHorizontal: gutter, paddingVertical: 8 },
  });
}
