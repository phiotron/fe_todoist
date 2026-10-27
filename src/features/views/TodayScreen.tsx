import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ActionMenu } from '../../components/ActionMenu';
import { AddRow } from '../../components/AddRow';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StateView } from '../../components/StateView';
import { dateKeyInZone, groupTodayView } from '../../lib/dates';
import { formatDateKey, formatDayHeader, weekdayName } from '../../lib/dates/format';
import { useNow } from '../../lib/useNow';
import { gutter, palette } from '../../theme';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { DisplaySheet } from '../display/DisplaySheet';
import { TODAY_VIEW_KEY } from '../display/displayRules';
import { displayRows } from '../display/groupTasks';
import { useGroupContext } from '../display/useGroupContext';
import { useViewDisplay, type ViewDisplay } from '../display/useViewDisplay';
import { openQuickAdd } from '../quickAdd/quickAddTarget';
import { SelectionScope } from '../tasks/SelectionScope';
import { useTaskSelection } from '../tasks/selection';
import { TaskListView } from '../tasks/TaskListView';
import { nodeRow, sectionRow, type TaskListRow } from '../tasks/taskRows';
import { useTaskList } from '../tasks/useTaskList';
import { openCount, overdueRows, useOverdueReschedule } from './overdue';

function TodayBody({ display }: { display: ViewDisplay }) {
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const today = dateKeyInZone(now, timeZone);
  const selection = useTaskSelection();
  const { query, tasks } = useTaskList({ view: 'today', today, ...display.params });
  const groupBy = display.options.groupBy;
  const ctx = useGroupContext(groupBy);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const overdue = useOverdueReschedule();

  const rows = useMemo(() => {
    const groups = groupTodayView(tasks, now, timeZone);
    const result: TaskListRow[] = overdueRows(groups.overdue, {
      collapsed,
      onToggle: () => setCollapsed((value) => !value),
      onReschedule: overdue.start,
    });
    if (groups.today.length > 0) {
      // Counts follow the Overdue block: a task completed a moment ago keeps its (struck) row until the refetch but is not counted.
      result.push(sectionRow('today', { title: formatDayHeader(today, today), count: openCount(groups.today) }), ...displayRows(groups.today, groupBy, ctx));
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
  }, [tasks, now, timeZone, collapsed, today, groupBy, ctx, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtitle = query.isPending
    ? undefined
    : t('views.today.subtitle', { n: openCount(tasks), date: `${weekdayName(today)} ${formatDateKey(today, false)}` });

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
        items={[
          { key: 'display', label: t('display.open'), icon: 'sliders', onPress: () => setDisplayOpen(true) },
          { key: 'select', label: t('views.selectTasks'), icon: 'check-square', onPress: () => selection?.start() },
        ]}
      />
      <DisplaySheet visible={displayOpen} viewKey={TODAY_VIEW_KEY} onClose={() => setDisplayOpen(false)} />
    </View>
  );
}

/** Today (M-Main): Overdue (collapsible, Reschedule) + today's tasks; the + button adds due today. */
export function TodayScreen() {
  const display = useViewDisplay(TODAY_VIEW_KEY);
  return (
    <SelectionScope>
      {display.ready ? (
        <TodayBody display={display} />
      ) : (
        <ActivityIndicator testID="today-display-loading" color={palette.acc} style={styles.loading} />
      )}
    </SelectionScope>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  add: { paddingHorizontal: gutter },
  error: { paddingHorizontal: gutter },
  loading: { padding: 24 },
});
