import { Feather } from '@expo/vector-icons';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { TaskListParams } from '../../api/models';
import { AppButton } from '../../components/AppButton';
import { IconButton } from '../../components/IconButton';
import { QueryStateView } from '../../components/QueryStateView';
import { Segmented } from '../../components/Segmented';
import { dateKeyInZone, taskDateKey } from '../../lib/dates';
import { monthTitle } from '../../lib/dates/format';
import { useNow } from '../../lib/useNow';
import { size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { useTaskDrop } from '../board/useTaskDrop';
import { DragProvider, useDragState, type DragPayload, type DropPoint } from '../dnd/dnd';
import { openQuickAdd } from '../quickAdd/quickAddTarget';
import { useDateSettings } from '../settings/useDateSettings';
import { AgendaList, CalendarChip, MonthGrid, TimeGrid, type CalendarHandlers } from './CalendarBodies';
import {
  CALENDAR_MODES,
  DEFAULT_CALENDAR_MODE,
  planDayDrop,
  planSlotDrop,
  shiftAnchor,
  slotMinutes,
  visibleDays,
  windowOf,
  type CalendarMode,
} from './calendarModel';
import { useCalendarTasks, type CalendarScope } from './useCalendarTasks';

/** The mode of the calendar is remembered while the app runs (all calendars share it). */
let rememberedMode: CalendarMode = DEFAULT_CALENDAR_MODE;
const modeListeners = new Set<() => void>();
export function setCalendarMode(mode: CalendarMode): void {
  if (mode === rememberedMode) return;
  rememberedMode = mode;
  modeListeners.forEach((listener) => listener());
}
function useCalendarMode(): CalendarMode {
  return useSyncExternalStore(
    (listener) => {
      modeListeners.add(listener);
      return () => {
        modeListeners.delete(listener);
      };
    },
    () => rememberedMode,
    () => rememberedMode,
  );
}

const MODE_LABEL_KEY: Record<CalendarMode, string> = {
  AGENDA: 'calendar.mode.agenda',
  THREE_DAYS: 'calendar.mode.threeDays',
  WEEK: 'calendar.mode.week',
  MONTH: 'calendar.mode.month',
};

interface CalendarViewProps {
  scope: CalendarScope;
  /** The Display filters of the view (priority / label / due); sort and group never go to the calendar. */
  filters: Pick<TaskListParams, 'filterPriority' | 'filterLabelId' | 'filterDue'>;
  /** Archived project: the calendar can be read but nothing is dragged. */
  readOnly?: boolean;
  testID?: string;
}

function NoDateTray({ tasks, readOnly }: { tasks: ReturnType<typeof useCalendarTasks>['noDateTasks']; readOnly: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { dragging } = useDragState();
  return (
    <View style={styles.tray} testID="calendar-tray">
      <Text style={[type.bodyStrong, styles.trayTitle]}>{t('calendar.noDateTitle')}</Text>
      <Text style={[type.caption, styles.trayHint]}>{tasks.length === 0 ? t('calendar.noDateEmpty') : t('calendar.noDateHint')}</Text>
      <ScrollView horizontal scrollEnabled={!dragging} contentContainerStyle={styles.trayRow}>
        {tasks.map((task) => (
          <View key={task.id} style={styles.trayItem}>
            <CalendarChip task={task} readOnly={readOnly} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function CalendarInner({ scope, filters, readOnly = false }: CalendarViewProps) {
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const { startDay } = useDateSettings();
  const today = dateKeyInZone(now, timeZone);
  const mode = useCalendarMode();
  const [anchor, setAnchor] = useState(today);
  const [trayOpen, setTrayOpen] = useState(false);
  const drop = useTaskDrop();

  const { from, to } = useMemo(() => windowOf(mode, anchor, startDay), [mode, anchor, startDay]);
  const days = useMemo(() => visibleDays(mode, anchor, startDay), [mode, anchor, startDay]);
  const { tasks, query, noDateTasks, noDateQuery } = useCalendarTasks({ scope, from, to, filters, withNoDate: trayOpen });
  const undated = useMemo(() => noDateTasks.filter((task) => taskDateKey(task) === null && task.completedAt === null), [noDateTasks]);

  // PERF4: one stable handlers object (the bodies are memoised); what changes lives in a ref read when a handler runs.
  const live = useRef({ drop, setAnchor });
  live.current = { drop, setAnchor };
  const handlers = useMemo<CalendarHandlers>(
    () => ({
      readOnly,
      onDropSlot: (day: string, payload: DragPayload, point: DropPoint) => {
        void live.current.drop.sendUpdate(payload.task.id, planSlotDrop(payload.task, day, slotMinutes(point.y)));
      },
      onDropDay: (day: string, payload: DragPayload) => {
        // Dropping on the day the task already has changes nothing (a timed task keeps its time anyway).
        if (taskDateKey(payload.task) === day) return;
        void live.current.drop.sendBatch(planDayDrop(payload.taskIds, day));
      },
      onAddOnDay: (day: string) => openQuickAdd({ dueDate: day }),
      onOpenDay: (day: string) => {
        setCalendarMode('THREE_DAYS');
        live.current.setAnchor(day);
      },
    }),
    [readOnly],
  );

  const title = mode === 'MONTH' || mode === 'WEEK' ? monthTitle(anchor) : monthTitle(days[0]);
  function changeMode(next: CalendarMode) {
    setCalendarMode(next);
  }

  let body;
  if (query.isPending || (query.isError && tasks.length === 0)) {
    body = <QueryStateView query={query} testID="calendar-state" />;
  } else if (mode === 'AGENDA') {
    body = <AgendaList days={days} tasks={tasks} today={today} handlers={handlers} />;
  } else if (mode === 'MONTH') {
    body = <MonthGrid days={days} tasks={tasks} today={today} anchor={anchor} handlers={handlers} />;
  } else {
    body = <TimeGrid days={days} tasks={tasks} today={today} handlers={handlers} />;
  }

  return (
    <View style={styles.fill}>
      <View style={styles.bar}>
        <Segmented
          testID="calendar-mode"
          options={CALENDAR_MODES.map((key) => ({ key, label: t(MODE_LABEL_KEY[key]) }))}
          value={mode}
          onChange={changeMode}
        />
      </View>
      <View style={styles.nav}>
        <IconButton icon="chevron-left" label={t('calendar.previous')} onPress={() => setAnchor(shiftAnchor(mode, anchor, -1))} testID="calendar-prev" />
        <Text style={[type.bodyStrong, styles.title]} numberOfLines={1} testID="calendar-title">
          {title}
        </Text>
        <IconButton icon="chevron-right" label={t('calendar.next')} onPress={() => setAnchor(shiftAnchor(mode, anchor, 1))} testID="calendar-next" />
        <AppButton variant="ghost" size="sm" color={palette.acc} label={t('calendar.today')} onPress={() => setAnchor(today)} testID="calendar-today" />
        <Pressable
          onPress={() => setTrayOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: trayOpen }}
          testID="calendar-no-date"
          style={styles.noDate}
        >
          <Feather name="inbox" size={size.iconSmall} color={palette.ink2} />
          <Text style={[type.buttonSmall, { color: palette.ink2 }]}>
            {trayOpen ? t('calendar.noDateTitle') : t('calendar.noDate', { n: undated.length })}
          </Text>
        </Pressable>
      </View>
      {query.isError && tasks.length > 0 ? <Text style={styles.error}>{describeError(query.error).message}</Text> : null}
      <View style={styles.fill}>{body}</View>
      {trayOpen ? (
        noDateQuery.isPending ? (
          <QueryStateView query={noDateQuery} testID="calendar-tray-state" />
        ) : (
          <NoDateTray tasks={undated} readOnly={readOnly} />
        )
      ) : null}
    </View>
  );
}

/**
 * M7 Calendar layout (plan M7 F4): Agenda / 3 days / Week / Month over GET tasks?view=calendar. Long press a task and
 * drag it onto a day (schedule, a timed task keeps its time) or onto a time slot (day + time + duration, 30 minutes by
 * default); "No date" opens a tray whose tasks can be dragged into the calendar.
 */
export function CalendarView(props: CalendarViewProps) {
  return (
    <DragProvider>
      <CalendarInner {...props} />
    </DragProvider>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    bar: { paddingHorizontal: 16, paddingBottom: 4 },
    nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 },
    title: { flex: 1, color: palette.ink, textAlign: 'center' },
    noDate: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: size.touch, paddingHorizontal: 8 },
    error: { ...type.meta, color: palette.warn, paddingHorizontal: 16 },
    tray: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 8,
      paddingBottom: 24,
      backgroundColor: palette.bg,
      borderTopWidth: 1,
      borderTopColor: palette.line,
      minHeight: 120,
    },
    trayTitle: { color: palette.ink, paddingHorizontal: 16 },
    trayHint: { color: palette.mute, paddingHorizontal: 16, paddingBottom: 6 },
    trayRow: { paddingHorizontal: 12, gap: 8 },
    trayItem: { width: 180 },
  });
}
