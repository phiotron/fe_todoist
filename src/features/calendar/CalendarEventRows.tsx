import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { CalendarEventResponse } from '../../api/calendar';
import { formatTime, useDisplayPrefs } from '../../lib/dates/displayFormat';
import { gutter, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

/** "09:00 – 10:30" / "All day" (the end time is left out for an event that ends on another day). */
function timeLabel(event: CalendarEventResponse, allDay: string): string {
  if (event.allDay || !event.startDatetime) return allDay;
  const start = formatTime(event.startDatetime.slice(11, 16));
  if (!event.endDatetime) return start;
  return `${start} – ${formatTime(event.endDatetime.slice(11, 16))}`;
}

/**
 * Read-only calendar events of one day (M13b), drawn inside Today and Upcoming above / under the tasks. No press, swipe or
 * selection: they belong to the external calendar. `title` is an optional small heading ("Calendar events").
 */
export function CalendarEventRows({
  events,
  testID,
  showTitle = false,
}: {
  events: readonly CalendarEventResponse[];
  testID: string;
  showTitle?: boolean;
}) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  // Redraw when the user changes the 12 / 24-hour format.
  useDisplayPrefs();
  if (events.length === 0) return null;
  return (
    <View testID={testID} style={styles.block}>
      {showTitle ? <Text style={styles.title}>{t('calendar.events.title')}</Text> : null}
      {events.map((event) => (
        <View key={event.id} testID={`calendar-event-${event.id}`} style={styles.row} accessibilityRole="text">
          <Feather name="calendar" size={size.iconSmall} color={palette.acc} />
          <View style={styles.texts}>
            <Text style={styles.name} numberOfLines={1}>
              {event.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {timeLabel(event, t('calendar.events.allDay'))}
              {event.location ? ` · ${event.location}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    block: { paddingHorizontal: gutter, paddingVertical: 4 },
    title: { ...type.meta, color: palette.mute, marginBottom: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 6,
      borderRadius: 12,
      backgroundColor: palette.p2s,
    },
    texts: { flex: 1 },
    name: { ...type.body, color: palette.ink },
    meta: { ...type.meta, color: palette.mute },
  });
}
