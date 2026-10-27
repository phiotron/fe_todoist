import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ActionMenu } from '../../components/ActionMenu';
import { AddRow } from '../../components/AddRow';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StateView } from '../../components/StateView';
import { dateKeyInZone, groupTodayView } from '../../lib/dates';
import { formatDateKey, formatDayHeader, weekdayName } from '../../lib/dates/format';
import { useNow } from '../../lib/useNow';
import { gutter, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { openQuickAdd } from '../quickAdd/quickAddTarget';
import { SelectionScope } from '../tasks/SelectionScope';
import { useTaskSelection } from '../tasks/selection';
import { TaskListView } from '../tasks/TaskListView';
import { nodeRow, sectionRow, taskRows, type TaskListRow } from '../tasks/taskRows';
import { useTaskList } from '../tasks/useTaskList';
import { overdueRows, useOverdueReschedule } from './overdue';

function TodayBody() {
  const styles = useThemedStyles(createTodayScreenStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const today = dateKeyInZone(now, timeZone);
  const selection = useTaskSelection();
  const { query, tasks } = useTaskList({ view: 'today', today });
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = useOverdueReschedule();

  const rows = useMemo(() => {
    const groups = groupTodayView(tasks, now, timeZone);
    const result: TaskListRow[] = overdueRows(groups.overdue, {
      collapsed,
      onToggle: () => setCollapsed((value) => !value),
      onReschedule: overdue.start,
    }, palette);
    if (groups.today.length > 0) {
      result.push(sectionRow('today', { title: formatDayHeader(today, today), count: groups.today.length }), ...taskRows(groups.today));
    }
    if (result.length > 0) {
      result.push(
        nodeRow(
          'add',
          <View style={styles.add}>
            <AddRow label={t('views.addTask')} onPress={() => openQuickAdd({ dueDate: today })} requiresOnline testID="today-add" />
          </View>,
        ),
      );
    }
    return result;
    // overdue.start is a fresh closure each render, but only opens the sheet.
  }, [tasks, now, timeZone, collapsed, today, t, palette]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtitle = query.isPending
    ? undefined
    : t('views.today.subtitle', { n: tasks.length, date: `${weekdayName(today)} ${formatDateKey(today, false)}` });

  return (
    <View style={styles.fill}>
      <ScreenHeader
        title={t('views.today.title')}
        subtitle={subtitle}
        right={<IconButton icon="more-horizontal" label={t('views.today.menu')} onPress={() => setMenuOpen(true)} testID="today-menu-open" />}
      />
      <View style={styles.error}>
        <ErrorText message={overdue.errorMessage} testID="today-error" />
      </View>
      <TaskListView
        rows={rows}
        query={query}
        showProject
        testID="today-list"
        empty={
          <StateView
            tone="ok"
            icon="check-circle"
            title={t('views.today.emptyTitle')}
            message={t('views.today.emptyText')}
            actionLabel={t('views.addTask')}
            onAction={() => openQuickAdd({ dueDate: today })}
            testID="today-empty"
          />
        }
      />
      {overdue.sheet}
      <ActionMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        testID="today-menu"
        items={[{ key: 'select', label: t('views.selectTasks'), icon: 'check-square', onPress: () => selection?.start() }]}
      />
    </View>
  );
}

/** Today (M-Main): Overdue (collapsible, Reschedule) + today's tasks; the + button adds due today. */
export function TodayScreen() {
  return (
    <SelectionScope>
      <TodayBody />
    </SelectionScope>
  );
}

function createTodayScreenStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    add: { paddingHorizontal: gutter },
    error: { paddingHorizontal: gutter },
  });
}
