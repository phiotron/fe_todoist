import { useLocalSearchParams } from 'expo-router';
import { CalendarSettingsScreen } from '../../../features/calendar/CalendarSettingsScreen';

export default function CalendarSettingsRoute() {
  const { result, error } = useLocalSearchParams<{ result?: string; error?: string }>();
  return (
    <CalendarSettingsScreen
      result={typeof result === 'string' ? result : undefined}
      error={typeof error === 'string' ? error : undefined}
    />
  );
}
