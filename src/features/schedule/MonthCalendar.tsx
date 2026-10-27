import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../../components/IconButton';
import { addDays, monthGrid, weekDays } from '../../lib/dates';
import { useDisplayPrefs } from '../../lib/dates/displayFormat';
import { formatDateKey, monthTitle, weekdayShort } from '../../lib/dates/format';
import { fonts, size, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

interface MonthCalendarProps {
  /** Any day of the month to show (yyyy-MM-dd). */
  month: string;
  selected: string | null;
  today: string;
  /** Days before it are muted and not selectable (Reschedule). */
  minDate?: string;
  startDay: number;
  onSelectDay: (dateKey: string) => void;
  onMonthChange: (monthKey: string) => void;
  testID: string;
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return date.toISOString().slice(0, 10);
}

/** M-Schedule month grid: 44px cells, selected day = 40px accent circle, past days muted (still selectable). */
export function MonthCalendar({ month, selected, today, minDate, startDay, onSelectDay, onMonthChange, testID }: MonthCalendarProps) {
  const styles = useThemedStyles(createMonthCalendarStyles);
  // Redraw when the user changes the date / time format (the formatting functions read the same store).
  useDisplayPrefs();
  const { t } = useTranslation();
  const [year, m] = month.split('-').map(Number);
  const weeks = monthGrid(year, m, startDay);
  // Header letters of a week starting on startDay (any week works: 2026-10-19 is a Monday).
  const header = weekDays(addDays('2026-10-19', (startDay + 6) % 7));
  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={type.bodyStrong}>{monthTitle(month)}</Text>
        <View style={styles.nav}>
          <IconButton
            icon="chevron-left"
            label={t('schedule.previousMonth')}
            onPress={() => onMonthChange(shiftMonth(month, -1))}
            testID={`${testID}-previous-month`}
          />
          <IconButton
            icon="chevron-right"
            label={t('schedule.nextMonth')}
            onPress={() => onMonthChange(shiftMonth(month, 1))}
            testID={`${testID}-next-month`}
          />
        </View>
      </View>
      <View style={styles.week}>
        {header.map((day) => (
          <Text key={day} style={styles.weekday}>
            {weekdayShort(day)}
          </Text>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((day, column) =>
            day ? (
              <Pressable
                key={day}
                testID={`${testID}-day-${day}`}
                accessibilityRole="button"
                accessibilityLabel={formatDateKey(day, true)}
                accessibilityState={{ selected: day === selected, disabled: minDate !== undefined && day < minDate }}
                disabled={minDate !== undefined && day < minDate}
                onPress={() => onSelectDay(day)}
                style={styles.cell}
              >
                <View style={[styles.day, day === selected && styles.daySelected]}>
                  <Text
                    style={[
                      styles.dayText,
                      (day < today || (minDate !== undefined && day < minDate)) && styles.past,
                      day === today && styles.today,
                      day === selected && styles.selectedText,
                    ]}
                  >
                    {Number(day.slice(8))}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <View key={`empty-${column}`} style={styles.cell} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function createMonthCalendarStyles(palette: Palette) {
  return StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    nav: { flexDirection: 'row' },
    week: { flexDirection: 'row' },
    weekday: { ...type.caption, fontFamily: fonts.semibold, flex: 1, textAlign: 'center', color: palette.mute },
    cell: { flex: 1, height: size.calendarCell, alignItems: 'center', justifyContent: 'center' },
    day: {
      width: size.calendarDay,
      height: size.calendarDay,
      borderRadius: size.calendarDay / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    daySelected: { backgroundColor: palette.acc },
    dayText: { ...type.body, color: palette.ink },
    past: { color: palette.mute },
    today: { fontFamily: fonts.bold, color: palette.acc },
    selectedText: { fontFamily: fonts.bold, color: palette.onacc },
  });
}
