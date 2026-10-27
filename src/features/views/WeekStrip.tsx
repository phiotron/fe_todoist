import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDateKey, weekdayShort } from '../../lib/dates/format';
import { fonts, gutter, size, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

interface WeekStripProps {
  /** The 7 days shown (yyyy-MM-dd). */
  days: readonly string[];
  today: string;
  selected: string;
  onSelectDay: (day: string) => void;
  /** Horizontal swipe: +1 = next week, -1 = previous week. */
  onShiftWeek: (delta: 1 | -1) => void;
  testID?: string;
}

/**
 * M-Upcoming strip: weekday letters over day numbers; today = accent circle, past days muted (disabled), the selected
 * day gets an accent ring. Swipe left / right changes the week.
 */
export function WeekStrip({ days, today, selected, onSelectDay, onShiftWeek, testID = 'week-strip' }: WeekStripProps) {
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
        const isToday = day === today;
        const isSelected = day === selected;
        return (
          <Pressable
            key={day}
            testID={`week-day-${day}`}
            accessibilityRole="button"
            accessibilityLabel={`${weekdayShort(day)} ${formatDateKey(day, false)}`}
            accessibilityState={{ selected: isSelected, disabled: past }}
            disabled={past}
            onPress={() => onSelectDay(day)}
            style={styles.cell}
          >
            <Text style={styles.weekday}>{weekdayShort(day)}</Text>
            <View style={[styles.day, isToday && styles.today, isSelected && !isToday && styles.selected]}>
              <Text style={[styles.dayText, past && styles.past, isToday && styles.todayText]}>{Number(day.slice(8))}</Text>
            </View>
          </Pressable>
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
