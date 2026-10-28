import { router } from 'expo-router';
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
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDateKey, formatDayHeader, weekdayName } from '../../lib/dates/format';
import { useNow } from '../../lib/useNow';
import { gutter, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { DisplaySheet } from '../display/DisplaySheet';
import { BoardView } from '../board/BoardView';
import { todayBoardColumns } from '../board/boardColumns';
import { CalendarView } from '../calendar/CalendarView';
import { calendarFilters, todayScope } from '../calendar/useCalendarTasks';
import { CompletedTodayBlock } from '../display/CompletedTodayBlock';
import { TODAY_VIEW_KEY, layoutOf } from '../display/displayRules';
import { displayRows } from '../display/groupTasks';
import { useGroupContext } from '../display/useGroupContext';
import { useViewDisplay, type ViewDisplay } from '../display/useViewDisplay';
import { CalendarEventRows } from '../calendar/CalendarEventRows';
import { eventsOnDay } from '../calendar/calendarEvents';
import { useCalendarEvents } from '../calendar/useCalendar';
import { openQuickAdd } from '../quickAdd/quickAddTarget';
import { SelectionScope } from '../tasks/SelectionScope';
import { useTaskSelection } from '../tasks/selection';
import { TaskListView } from '../tasks/TaskListView';
import { nodeRow, sectionRow, type TaskListRow } from '../tasks/taskRows';
import { useTaskList } from '../tasks/useTaskList';
import { usePendingDrop, withPendingDrop } from '../dnd/usePendingDrop';
import { openCount, overdueRows, useOverdueReschedule } from './overdue';
import { TODAY_BLOCK, useTodayDnd } from './dayListDnd';

function TodayBody({ display }: { display: ViewDisplay }) {
  const styles = useThemedStyles(createTodayScreenStyles);
  // Redraw when the user changes the date / time format (the formatting functions read the same store).
  const displayPrefs = useDisplayPrefs();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const today = dateKeyInZone(now, timeZone);
  const selection = useTaskSelection();
  const { query, tasks: serverTasks } = useTaskList({ view: 'today', today, ...display.params });
  // DND: a drop shows at once, until the list is fetched again
  const pendingDrop = usePendingDrop([serverTasks]);
  const tasks = useMemo(() => withPendingDrop(serverTasks, pendingDrop.pending), [serverTasks, pendingDrop.pending]);
  const groupBy = display.options.groupBy;
  const ctx = useGroupContext(groupBy);
  const groups = useMemo(() => groupTodayView(tasks, now, timeZone), [tasks, now, timeZone]);
  const dnd = useTodayDnd({
    overdue: groups.overdue,
    today: groups.today,
    todayKey: today,
    // the day order is what the list shows only with the default sort (date ascending) and no grouping
    ordered: display.options.sortBy === 'DATE' && display.options.sortDirection !== 'DESC' && groupBy === 'NONE',
    setPending: pendingDrop.set,
    clearPending: pendingDrop.clear,
  });
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const overdue = useOverdueReschedule();
  // M13b: read-only events of the connected calendar (nothing is requested while no calendar is connected).
  const calendar = useCalendarEvents(today, today);
  const todayEvents = useMemo(() => eventsOnDay(calendar.events, today), [calendar.events, today]);

  const rows = useMemo(() => {
    const result: TaskListRow[] = [];
    if (todayEvents.length > 0) {
      result.push(nodeRow('calendar-events', <CalendarEventRows events={todayEvents} testID="today-calendar-events" showTitle />));
    }
    result.push(
      ...overdueRows(groups.overdue, {
        collapsed,
        onToggle: () => setCollapsed((value) => !value),
        onReschedule: overdue.start,
      }, palette),
    );
    if (groups.today.length > 0) {
      // Counts follow the Overdue block: a task completed a moment ago keeps its (struck) row until the refetch but is not counted.
      // DND: the header takes drops for the top of today
      result.push(sectionRow('today', { title: formatDayHeader(today, today), count: openCount(groups.today) }, TODAY_BLOCK), ...displayRows(groups.today, groupBy, ctx));
    }
    // M7: Display → Completed tasks also shows what was completed today.
    if (display.options.showCompleted === true) {
      result.push(nodeRow('completed-today', <CompletedTodayBlock today={today} />));
    }
    if (result.length > 0) {
      result.push(
        nodeRow(
          'add',
          <View style={styles.add}>
            <AddRow label={t('views.addTask')} onPress={() => openQuickAdd({ dueDate: today })} requiresOnline testID="today-add" />
          </View>,
          TODAY_BLOCK, // DND: "Add task" takes drops for the end of today
        ),
      );
    }
    return result;
    // overdue.start is a fresh closure each render, but only opens the sheet.
  }, [groups, collapsed, today, groupBy, ctx, t, palette, displayPrefs, display.options.showCompleted, todayEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  // M7: List / Board / Calendar of Today (saved with the Display).
  const layout = layoutOf(display.options);
  const boardColumns = useMemo(
    () => todayBoardColumns(tasks, now, timeZone, today, groupBy, ctx),
    [tasks, now, timeZone, today, groupBy, ctx],
  );
  const calendarScope = useMemo(() => todayScope(), []);

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
      {layout === 'BOARD' ? (
        <BoardView columns={boardColumns} query={query} showProject testID="today-board" />
      ) : layout === 'CALENDAR' ? (
        <CalendarView scope={calendarScope} filters={calendarFilters(display.params)} testID="today-calendar" />
      ) : (
        <TaskListView
          rows={rows}
          query={query}
          showProject
          testID="today-list"
          dnd={dnd}
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
      )}
      {overdue.sheet}
      <ActionMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        testID="today-menu"
        items={[
          { key: 'display', label: t('display.open'), icon: 'sliders', onPress: () => setDisplayOpen(true) },
          { key: 'select', label: t('views.selectTasks'), icon: 'check-square', onPress: () => selection?.start() },
          { key: 'view-activity', label: t('activity.viewActivity'), icon: 'activity', requiresOnline: true, onPress: () => router.push('/activity') },
        ]}
      />
      <DisplaySheet visible={displayOpen} viewKey={TODAY_VIEW_KEY} onClose={() => setDisplayOpen(false)} />
    </View>
  );
}

/** Today (M-Main): Overdue (collapsible, Reschedule) + today's tasks; the + button adds due today. */
export function TodayScreen() {
  const styles = useThemedStyles(createTodayScreenStyles);
  const { palette } = useTheme();
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

function createTodayScreenStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    add: { paddingHorizontal: gutter },
    error: { paddingHorizontal: gutter },
    loading: { padding: 24 },
  });
}

