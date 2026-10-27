import { Stack } from 'expo-router';
import { useTheme } from '../../../theme';

/** Every settings page draws its own header (SettingsPage), so the navigator shows none. */
export default function SettingsLayout() {
  const { palette } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }} />;
}
