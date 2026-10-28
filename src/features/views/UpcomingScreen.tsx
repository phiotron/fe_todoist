import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionMenu } from '../../components/ActionMenu';
import { AddRow } from '../../components/AddRow';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { addDays, dateKeyInZone, dayRange, groupByDueDate, upcomingJumpLimit, weekDays, weekStart } from '../../lib/dates';
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDayHeader, monthTitle } from '../../lib/dates/format';
import { useNow } from '../../lib/useNow';
import { gutter, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { DisplaySheet } from '../display/DisplaySheet';
import { BoardView } from '../board/BoardView';
import { dayBoardColumns } from '../board/boardColumns';
import { CalendarView } from '../calendar/CalendarView';
import { allTasksScope, calendarFilters } from '../calendar/useCalendarTasks';
import { CompletedTodayBlock } from '../display/CompletedTodayBlock';
import { UPCOMING_VIEW_KEY, layoutOf } from '../display/displayRules';
import { useViewDisplay, type ViewDisplay } from '../display/useViewDisplay';
import { CalendarEventRows } from '../calendar/CalendarEventRows';
import { clampWindowEnd, eventsOnDay } from '../calendar/calendarEvents';
import { EVENTS_MAX_SPAN_DAYS, useCalendarEvents } from '../calendar/useCalendar';
import { openQuickAdd } from '../quickAdd/quickAddTarget';
import { NO_DUE } from '../schedule/dueValue';
import { ScheduleSheet } from '../schedule/ScheduleSheet';
import { useDateSettings } from '../settings/useDateSettings';
import { SelectionScope } from '../tasks/SelectionScope';
import { useTaskSelection } from '../tasks/selection';
import { TaskListView } from '../tasks/TaskListView';
import { nodeRow, sectionRow, taskRows, type TaskListRow } from '../tasks/taskRows';
import { useTaskList } from '../tasks/useTaskList';
import { openCount, overdueRows, useOverdueReschedule } from './overdue';
import { setUpcomingDay, useUpcomingDay } from './upcomingDayStore';
import { useUpcomingDays } from './useUpcomingDays';
import { WeekStrip } from './WeekStrip';

function UpcomingBody({ display }: { display: ViewDisplay }) {
  const styles = useThemedStyles(createUpcomingScreenStyles);
  // Redraw when the user changes the date / time format (the formatting functions read the same store).
  const displayPrefs = useDisplayPrefs();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const settings = useDateSettings();
  const selection = useTaskSelection();
  const today = dateKeyInZone(now, timeZone);
  // Jumps (picker, strip, next week) stop at today + 3 months; scrolling the list by hand still goes on up to 2 years.
  const jumpLimit = upcomingJumpLimit(today);
  const thisWeek = weekStart(today, settings.startDay);
  const storedDay = useUpcomingDay();
  const selectedDay = storedDay && storedDay >= today ? storedDay : today;
  // Keep a DAY inside the shown week, not the week's first day: when the first day of the week changes (settings), the
  // week is rebuilt around the same day instead of staying on the old boundaries.
  const [shownDay, setShownDay] = useState(today);
  const shownWeek = weekStart(shownDay, settings.startDay);
  // After midnight into a new week the state would still point at the week that is over.
  const weekStartKey = shownWeek < thisWeek ? thisWeek : shownWeek;
  const [overdueCollapsed, setOverdueCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const listRef = useRef<FlatList<TaskListRow>>(null);
  // Day windows from today (spec 12.3): every day up to `loadedThrough` gets a header, even when empty.
  const upcoming = useUpcomingDays(today, display.params);
  const overdue = useTaskList({ view: 'overdue', today });
  const reschedule = useOverdueReschedule();
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = upcoming.query;
  const { loadedThrough } = upcoming;
  // M13b: read-only events of the connected calendar for the days loaded so far (window of at most 31 days).
  const calendarEvents = useCalendarEvents(today, clampWindowEnd(today, loadedThrough, EVENTS_MAX_SPAN_DAYS)).events;

  const rows = useMemo(() => {
    const byDay = groupByDueDate(upcoming.tasks);
    const result: TaskListRow[] = overdueRows(overdue.tasks, {
      collapsed: overdueCollapsed,
      onToggle: () => setOverdueCollapsed((value) => !value),
      onReschedule: reschedule.start,
    }, palette);
    if (overdue.query.hasNextPage) {
      result.push(
        nodeRow(
          'overdue-more',
          <View style={styles.more}>
            <AppButton
              variant="ghost"
              color={palette.acc}
              label={t('views.overdue.loadMore')}
              onPress={() => void overdue.query.fetchNextPage()}
              testID="overdue-load-more"
            />
          </View>,
        ),
      );
    }
    for (const day of dayRange(today, loadedThrough)) {
      const list = byDay.get(day) ?? [];
      result.push(sectionRow(`d-${day}`, { title: formatDayHeader(day, today), count: openCount(list) }));
      const dayEvents = eventsOnDay(calendarEvents, day);
      if (dayEvents.length > 0) {
        result.push(nodeRow(`ev-${day}`, <CalendarEventRows events={dayEvents} testID={`upcoming-events-${day}`} />));
      }
      result.push(...taskRows(list));
      result.push(
        nodeRow(
          `add-${day}`,
          <View style={styles.add}>
            <AddRow label={t('views.addTask')} onPress={() => openQuickAdd({ dueDate: day })} requiresOnline testID={`upcoming-add-${day}`} />
          </View>,
        ),
      );
    }
    // M7: Display → Completed tasks also shows what was completed today.
    if (display.options.showCompleted === true) {
      result.push(nodeRow('completed-today', <CompletedTodayBlock today={today} />));
    }
    return result;
    // reschedule.start only opens the sheet; overdue.query is read for hasNextPage / fetchNextPage.
  }, [upcoming.tasks, loadedThrough, overdue.tasks, overdue.query.hasNextPage, today, overdueCollapsed, t, palette, displayPrefs, display.options.showCompleted, calendarEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  // M7: List / Board / Calendar of Upcoming (saved with the Display). The board has one column per loaded day.
  const layout = layoutOf(display.options);
  const boardColumns = useMemo(
    () => dayBoardColumns(dayRange(today, loadedThrough), groupByDueDate(upcoming.tasks), today),
    [today, loadedThrough, upcoming.tasks],
  );
  const calendarScope = useMemo(() => allTasksScope(), []);

  // Scroll to the target day, loading more pages / windows first while it has not arrived (spec 9.2: infinite list of days, at most 2 years; jumps are limited to 3 months, so only a few windows load here).
  useEffect(() => {
    if (!target) return;
    const index = rows.findIndex((row) => row.key === `d-${target}`);
    if (index >= 0) {
      try {
        listRef.current?.scrollToIndex({ index, animated: true });
      } catch {
        // The row is not measured yet: TaskListView's onScrollToIndexFailed jumps near it and retries a few times, then gives up.
      }
      setTarget(null);
    } else if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    } else if (!hasNextPage) {
      setTarget(null);
    }
  }, [target, rows, hasNextPage, isFetchingNextPage, fetchNextPage]);

  function chooseDay(day: string) {
    setUpcomingDay(day);
    setTarget(day);
  }

  function shiftWeek(delta: 1 | -1) {
    const next = addDays(weekStartKey, 7 * delta);
    if (next < thisWeek || next > jumpLimit) return;
    setShownDay(next);
    chooseDay(next <= today && addDays(next, 6) >= today ? today : next);
  }

  function jumpTo(day: string) {
    // Never before today, never past the jump limit (today + 3 months): the picker locks those days, this guards the rest.
    const clamped = day < today ? today : day > jumpLimit ? jumpLimit : day;
    setShownDay(clamped);
    chooseDay(clamped);
  }

  const viewingOtherWeek = weekStartKey !== thisWeek || selectedDay !== today;
  const header = (
    <>
      <ScreenHeader
        title={t('views.upcoming.title')}
        right={
          <>
            <Pressable
              testID="upcoming-month"
              accessibilityRole="adjustable"
              accessibilityLabel={t('views.upcoming.pickDate')}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'increment') shiftWeek(1);
                if (event.nativeEvent.actionName === 'decrement') shiftWeek(-1);
              }}
              onPress={() => setJumpOpen(true)}
              style={styles.month}
            >
              <Text style={type.bodyStrong}>{monthTitle(selectedDay)}</Text>
              <Feather name="chevron-down" size={size.iconSmall} color={palette.ink2} />
            </Pressable>
            <IconButton icon="more-horizontal" label={t('views.upcoming.menu')} onPress={() => setMenuOpen(true)} testID="upcoming-menu-open" />
          </>
        }
      />
      {viewingOtherWeek ? (
        <View style={styles.todayButton}>
          <AppButton
            variant="ghost"
            size="sm"
            color={palette.acc}
            label={t('views.upcoming.goToday')}
            onPress={() => jumpTo(today)}
            testID="upcoming-today"
          />
        </View>
      ) : null}
      <WeekStrip
        days={weekDays(weekStartKey)}
        today={today}
        maxDate={jumpLimit}
        selected={selectedDay}
        onSelectDay={chooseDay}
        onShiftWeek={shiftWeek}
        onLongPressDay={(day) => openQuickAdd({ dueDate: day })}
      />
      <View style={styles.error}>
        <ErrorText message={reschedule.errorMessage} testID="upcoming-error" />
      </View>
    </>
  );

  return (
    <View style={styles.fill}>
      {header}
      {layout === 'BOARD' ? (
        <BoardView columns={boardColumns} query={upcoming.query} showProject autoLoadAll={false} testID="upcoming-board" />
      ) : layout === 'CALENDAR' ? (
        <CalendarView scope={calendarScope} filters={calendarFilters(display.params)} testID="upcoming-calendar" />
      ) : (
        <TaskListView rows={rows} query={upcoming.query} showProject testID="upcoming-list" listRef={listRef} initialNumToRender={100} />
      )}
      {reschedule.sheet}
      <ScheduleSheet
        visible={jumpOpen}
        mode="date"
        allowNoDate={false}
        title={t('views.upcoming.pickDate')}
        minDate={today}
        maxDate={jumpLimit}
        value={{ ...NO_DUE, dueDate: selectedDay }}
        onSelect={(due) => {
          if (due.dueDate) jumpTo(due.dueDate);
        }}
        onClose={() => setJumpOpen(false)}
        testID="upcoming-jump"
      />
      <ActionMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        testID="upcoming-menu"
        items={[
          { key: 'display', label: t('display.open'), icon: 'sliders', onPress: () => setDisplayOpen(true) },
          { key: 'select', label: t('views.selectTasks'), icon: 'check-square', onPress: () => selection?.start() },
          { key: 'view-activity', label: t('activity.viewActivity'), icon: 'activity', requiresOnline: true, onPress: () => router.push('/activity') },
        ]}
      />
      <DisplaySheet visible={displayOpen} viewKey={UPCOMING_VIEW_KEY} onClose={() => setDisplayOpen(false)} />
    </View>
  );
}

/** Upcoming (M-Upcoming): week strip + one block per day from today on, Overdue with Reschedule at the top. */
export function UpcomingScreen() {
  const styles = useThemedStyles(createUpcomingScreenStyles);
  const { palette } = useTheme();
  const display = useViewDisplay(UPCOMING_VIEW_KEY);
  return (
    <SelectionScope>
      {display.ready ? (
        <UpcomingBody display={display} />
      ) : (
        <ActivityIndicator testID="upcoming-display-loading" color={palette.acc} style={styles.loading} />
      )}
    </SelectionScope>
  );
}

function createUpcomingScreenStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    month: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: size.touch, paddingHorizontal: 4 },
    todayButton: { alignItems: 'flex-end', paddingHorizontal: gutter },
    add: { paddingHorizontal: gutter },
    more: { paddingHorizontal: gutter, alignItems: 'flex-start' },
    error: { paddingHorizontal: gutter },
    loading: { padding: 24 },
  });
}

