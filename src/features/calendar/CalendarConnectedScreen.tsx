import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { calendarKeys } from './useCalendar';

/**
 * taskly://calendar/connected[?error=<code>] (M13b): the browser finished the calendar consent. Refreshes the status and
 * returns to Settings > Calendar, which shows the result (or the error) once.
 */
export function CalendarConnectedScreen({ error }: { error?: string }) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void queryClient.invalidateQueries({ queryKey: calendarKeys.all }).finally(() => {
      router.replace({ pathname: '/settings/calendar', params: error ? { error } : { result: 'connected' } });
    });
  }, [queryClient, error]);

  return (
    <View testID="calendar-connected-working" style={styles.screen}>
      <ActivityIndicator color={palette.acc} />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg },
  });
}
