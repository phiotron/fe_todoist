import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task } from '../../api/models';
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { DropZone } from '../dnd/dnd';
import { formatDateKey, weekdayShort } from '../../lib/dates/format';
import { fonts, gutter, size, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

interface WeekStripProps {
  /** The 7 days shown (yyyy-MM-dd). */
  days: readonly string[];
  today: string;
  /** Days after it are disabled (Upcoming jump limit). */
  maxDate?: string;
  selected: string;
  onSelectDay: (day: string) => void;
  /** Horizontal swipe: +1 = next week, -1 = previous week. */
  onShiftWeek: (delta: 1 | -1) => void;
  /** M7: press and hold a day to add a task on it. */
  onLongPressDay?: (day: string) => void;
  /** DND (Upcoming list): a task dropped on a day (not a locked one); needs an enclosing DragProvider. */
  onDropDay?: (day: string, task: Task) => void;
  testID?: string;
}

/**
 * M-Upcoming strip: weekday letters over day numbers; today = accent circle, past days muted (disabled), the selected
 * day gets an accent ring. Swipe left / right changes the week.
 */
export function WeekStrip({
  days,
  today,
  maxDate,
  selected,
  onSelectDay,
  onShiftWeek,
  onLongPressDay,
  onDropDay,
  testID = 'week-strip',
}: WeekStripProps) {
  const styles = useThemedStyles(createWeekStripStyles);
  // Redraw when the user changes the date / time format (the formatting functions read the same store).
  useDisplayPrefs();
  const { t } = useTranslation();
  const latest = useRef(onShiftWeek);
  latest.current = onShiftWeek;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx <= -40) latest.current(1);
          else if (gesture.dx >= 40) latest.current(-1);
        },
      }),
    [],
  );
  return (
    <View testID={testID} style={styles.strip} {...pan.panHandlers}>
      {days.map((day) => {
        const past = day < today;
        const locked = past || (maxDate !== undefined && day > maxDate);
        const isToday = day === today;
        const isSelected = day === selected;
        const cell = (
          <Pressable
            key={day}
            testID={`week-day-${day}`}
            accessibilityRole="button"
            accessibilityLabel={`${weekdayShort(day)} ${formatDateKey(day, false)}`}
            accessibilityState={{ selected: isSelected, disabled: locked }}
            disabled={locked}
            onPress={() => onSelectDay(day)}
            onLongPress={onLongPressDay ? () => onLongPressDay(day) : undefined}
            style={styles.cell}
          >
            <Text style={styles.weekday}>{weekdayShort(day)}</Text>
            <View style={[styles.day, isToday && styles.today, isSelected && !isToday && styles.selected]}>
              <Text style={[styles.dayText, locked && styles.past, isToday && styles.todayText]}>{Number(day.slice(8))}</Text>
            </View>
          </Pressable>
        );
        if (!onDropDay || locked) return cell;
        return (
          <DropZone
            key={day}
            id={`week:${day}`}
            testID={`drop-week-${day}`}
            onDrop={(payload) => onDropDay(day, payload.task)}
            style={styles.dropCell}
            overStyle={styles.dropOver}
          >
            {cell}
          </DropZone>
        );
      })}
      <Text style={styles.hidden}>{t('views.upcoming.week')}</Text>
    </View>
  );
}

function createWeekStripStyles(palette: Palette) {
  return StyleSheet.create({
    strip: {
      flexDirection: 'row',
      paddingHorizontal: gutter - 8,
      paddingTop: 4,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
      backgroundColor: palette.bg,
    },
    cell: { flex: 1, alignItems: 'center', minHeight: size.touch },
    /** DND: a day cell inside its drop zone, and the zone under a dragged task. */
    dropCell: { flex: 1, borderRadius: size.weekDay / 2 },
    dropOver: { backgroundColor: palette.soft },
    weekday: { ...type.caption, color: palette.mute },
    day: {
      marginTop: 6,
      width: size.weekDay,
      height: size.weekDay,
      borderRadius: size.weekDay / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    today: { backgroundColor: palette.acc, borderColor: palette.acc },
    selected: { borderColor: palette.acc },
    dayText: { ...type.body, color: palette.ink },
    past: { color: palette.mute },
    todayText: { fontFamily: fonts.bold, color: palette.onacc },
    hidden: { position: 'absolute', width: 0, height: 0, opacity: 0 },
  });
}
