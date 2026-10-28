import { useLocalSearchParams } from 'expo-router';
import { CalendarConnectedScreen } from '../../features/calendar/CalendarConnectedScreen';

/** taskly://calendar/connected — the calendar consent in the browser ends here (M13b). */
export default function CalendarConnectedRoute() {
  const { error } = useLocalSearchParams<{ error?: string }>();
  return <CalendarConnectedScreen error={typeof error === 'string' ? error : undefined} />;
}
