import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Task } from '../../api/models';
import { formatDayHeader, weekdayShort } from '../../lib/dates/format';
import { formatTime } from '../../lib/dates/displayFormat';
import { useIsOnline } from '../../lib/useIsOnline';
import { FAB_CLEARANCE } from '../../components/tabBarMetrics';
import { radius, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { Draggable, DropZone, useDragState, type DragPayload, type DropPoint } from '../dnd/dnd';
import { priorityColor } from '../tasks/priority';
import {
  HOUR_HEIGHT,
  MONTH_CELL_TASKS,
  clockLabel,
  minutesOfDue,
  placeTimed,
  tasksOfDay,
} from './calendarModel';

export const GUTTER_WIDTH = 44;

export interface CalendarHandlers {
  onDropSlot: (day: string, payload: DragPayload, point: DropPoint) => void;
  onDropDay: (day: string, payload: DragPayload) => void;
  /** Header / day number tap: add a task on that day. */
  onAddOnDay: (day: string) => void;
  /** Month cell tap: open that day in the 3 days view. */
  onOpenDay: (day: string) => void;
  readOnly: boolean;
}

/** A task as a calendar block / chip: tap = open, long press + drag = move (completed tasks and read-only do not move). */
export function CalendarChip({
  task,
  readOnly,
  showTime = false,
  compact = false,
  style,
}: {
  task: Task;
  readOnly: boolean;
  showTime?: boolean;
  compact?: boolean;
  style?: object;
}) {
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const online = useIsOnline();
  const minutes = minutesOfDue(task);
  return (
    <Draggable
      testID={`calendar-chip-${task.id}`}
      accessibilityLabel={task.content}
      enabled={online && !readOnly && task.completedAt === null}
      payload={(): DragPayload => ({ taskIds: [task.id], task })}
      onPress={() => router.push(`/task/${task.id}`)}
      style={[styles.chip, { borderLeftColor: priorityColor(task.priority, palette) }, compact && styles.chipCompact, style]}
    >
      <Text
        style={[type.meta, styles.chipText, task.completedAt && styles.done]}
        numberOfLines={compact ? 1 : 3}
      >
        {showTime && minutes !== null ? `${formatTime(clockLabel(minutes))} ` : ''}
        {task.content}
      </Text>
    </Draggable>
  );
}

/** Agenda: one block per day, every day shown (empty ones too); each block is a drop zone (schedule that day). */
export function AgendaList({ days, tasks, today, handlers }: { days: readonly string[]; tasks: readonly Task[]; today: string; handlers: CalendarHandlers }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { dragging } = useDragState();
  return (
    <ScrollView testID="calendar-agenda" scrollEnabled={!dragging} contentContainerStyle={styles.agenda}>
      {days.map((day) => {
        const { allDay, timed } = tasksOfDay(tasks, day);
        const list = [...allDay, ...timed];
        return (
          <DropZone
            key={day}
            id={`day:${day}`}
            testID={`calendar-day-${day}`}
            onDrop={(payload) => handlers.onDropDay(day, payload)}
            style={styles.agendaDay}
            overStyle={styles.over}
          >
            <Pressable onPress={() => handlers.onAddOnDay(day)} accessibilityRole="button" testID={`calendar-add-${day}`}>
              <Text style={[type.section, styles.agendaTitle]}>{formatDayHeader(day, today)}</Text>
            </Pressable>
            {list.length === 0 ? <Text style={styles.empty}>{t('calendar.empty')}</Text> : null}
            {list.map((task) => (
              <CalendarChip key={task.id} task={task} readOnly={handlers.readOnly} showTime />
            ))}
          </DropZone>
        );
      })}
    </ScrollView>
  );
}

/** Month: whole weeks of day cells, up to 3 names then "+N"; each cell is a drop zone. */
export function MonthGrid({ days, tasks, today, anchor, handlers }: { days: readonly string[]; tasks: readonly Task[]; today: string; anchor: string; handlers: CalendarHandlers }) {
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const { dragging } = useDragState();
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <ScrollView testID="calendar-month" scrollEnabled={!dragging}>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.weekRow}>
          {week.map((day) => {
            const { allDay, timed } = tasksOfDay(tasks, day);
            const list = [...allDay, ...timed];
            const outside = day.slice(0, 7) !== anchor.slice(0, 7);
            return (
              <DropZone
                key={day}
                id={`day:${day}`}
                testID={`calendar-day-${day}`}
                onDrop={(payload) => handlers.onDropDay(day, payload)}
                style={[styles.cell, outside && styles.cellOutside]}
                overStyle={styles.over}
              >
                <Pressable onPress={() => handlers.onOpenDay(day)} accessibilityRole="button" testID={`calendar-open-${day}`}>
                  <Text
                    style={[
                      type.caption,
                      styles.cellNumber,
                      day === today && { color: palette.acc, fontWeight: '700' },
                    ]}
                  >
                    {Number(day.slice(8, 10))}
                  </Text>
                </Pressable>
                {list.slice(0, MONTH_CELL_TASKS).map((task) => (
                  <CalendarChip key={task.id} task={task} readOnly={handlers.readOnly} compact />
                ))}
                {list.length > MONTH_CELL_TASKS ? (
                  <Text style={styles.more}>{t('calendar.more', { n: list.length - MONTH_CELL_TASKS })}</Text>
                ) : null}
              </DropZone>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

/** 3 days / week: header + "All day" row (drop = schedule the day) + a 24 h grid per day (drop = day + 30-minute slot). */
export function TimeGrid({ days, tasks, today, handlers }: { days: readonly string[]; tasks: readonly Task[]; today: string; handlers: CalendarHandlers }) {
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const { dragging } = useDragState();
  const [width, setWidth] = useState(0);
  const columnWidth = Math.max(0, (width - GUTTER_WIDTH) / days.length);
  const split = days.map((day) => tasksOfDay(tasks, day));
  return (
    <View style={styles.fill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} testID="calendar-grid">
      <View style={styles.headerRow}>
        <View style={{ width: GUTTER_WIDTH }} />
        {days.map((day) => (
          <Pressable
            key={day}
            onPress={() => handlers.onAddOnDay(day)}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.addOnDay', { date: formatDayHeader(day, today) })}
            testID={`calendar-add-${day}`}
            style={[styles.dayHead, { width: columnWidth }]}
          >
            <Text style={[type.caption, { color: day === today ? palette.acc : palette.ink2 }]}>{weekdayShort(day)}</Text>
            <Text style={[type.bodyStrong, { color: day === today ? palette.acc : palette.ink }]}>{Number(day.slice(8, 10))}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.headerRow}>
        <View style={[styles.gutterCell, { width: GUTTER_WIDTH }]}>
          <Text style={[type.caption, styles.gutterText]}>{t('calendar.allDay')}</Text>
        </View>
        {days.map((day, index) => (
          <DropZone
            key={day}
            id={`allday:${day}`}
            testID={`calendar-allday-${day}`}
            onDrop={(payload) => handlers.onDropDay(day, payload)}
            style={[styles.allDay, { width: columnWidth }]}
            overStyle={styles.over}
          >
            {split[index].allDay.map((task) => (
              <CalendarChip key={task.id} task={task} readOnly={handlers.readOnly} compact />
            ))}
          </DropZone>
        ))}
      </View>
      <ScrollView scrollEnabled={!dragging} testID="calendar-grid-scroll" contentContainerStyle={styles.gridBody}>
        <View style={styles.gridRow}>
          <View style={{ width: GUTTER_WIDTH }}>
            {Array.from({ length: 24 }, (_, hour) => (
              <View key={hour} style={styles.hourLabel}>
                <Text style={[type.caption, styles.gutterText]}>{formatTime(clockLabel(hour * 60))}</Text>
              </View>
            ))}
          </View>
          {days.map((day, index) => (
            <DropZone
              key={day}
              id={`slots:${day}`}
              testID={`calendar-slots-${day}`}
              onDrop={(payload, point) => handlers.onDropSlot(day, payload, point)}
              style={[styles.dayColumn, { width: columnWidth }]}
              overStyle={styles.over}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <View key={hour} style={styles.hourLine} />
              ))}
              {placeTimed(split[index].timed).map((placement) => (
                <CalendarChip
                  key={placement.task.id}
                  task={placement.task}
                  readOnly={handlers.readOnly}
                  showTime
                  style={{
                    position: 'absolute',
                    top: placement.top,
                    height: Math.max(placement.height - 2, 20),
                    left: (columnWidth * placement.lane) / placement.lanes,
                    width: columnWidth / placement.lanes - 2,
                  }}
                />
              ))}
            </DropZone>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1 },
    over: { backgroundColor: palette.soft },
    done: { textDecorationLine: 'line-through', color: palette.mute },
    empty: { ...type.meta, color: palette.mute, paddingVertical: 4 },
    agenda: { paddingHorizontal: 16, paddingBottom: FAB_CLEARANCE },
    agendaDay: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.line, gap: 6 },
    agendaTitle: { color: palette.ink },
    chip: {
      borderLeftWidth: 3,
      borderRadius: radius.chip,
      paddingHorizontal: 6,
      paddingVertical: 3,
      backgroundColor: palette.soft,
      overflow: 'hidden',
    },
    chipCompact: { paddingVertical: 1 },
    chipText: { color: palette.ink },
    weekRow: { flexDirection: 'row', minHeight: 96 },
    cell: { flex: 1, padding: 2, gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line },
    cellOutside: { opacity: 0.5 },
    cellNumber: { color: palette.ink2, textAlign: 'center' },
    more: { ...type.caption, color: palette.mute, textAlign: 'center' },
    headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.line },
    dayHead: { alignItems: 'center', paddingVertical: 4 },
    gutterCell: { justifyContent: 'center', paddingHorizontal: 2 },
    gutterText: { color: palette.mute },
    allDay: { minHeight: 32, padding: 2, gap: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.line },
    gridBody: { paddingBottom: FAB_CLEARANCE },
    gridRow: { flexDirection: 'row' },
    hourLabel: { height: HOUR_HEIGHT, paddingHorizontal: 2 },
    dayColumn: { height: 24 * HOUR_HEIGHT, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.line },
    hourLine: { height: HOUR_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  });
}
