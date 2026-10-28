import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { OfflineBanner } from '../../components/OfflineBanner';
import { SnackbarProvider } from '../../components/Snackbar';
import { TopBannerProvider } from '../../components/useTopInset';
import { useSession } from '../../features/auth/session';
import { ReminderHost } from '../../features/reminders/ReminderHost';
import { TimeZoneBanner } from '../../features/settings/TimeZoneBanner';
import { useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

export default function SignedInLayout() {
  const styles = useThemedStyles(createSignedInLayoutStyles);
  const { palette } = useTheme();
  const { status } = useSession();
  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.acc} />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/login" />;
  return (
    <SnackbarProvider>
      <TopBannerProvider>
        <View style={styles.fill}>
          {/* M-Error: the offline banner sits on top of every screen and never blocks reading. */}
          <OfflineBanner />
          {/* Spec 5.2: the device time zone differs from the account one. */}
          <TimeZoneBanner />
          {/* M4: schedules the local reminders and handles the notification buttons; renders nothing. */}
          <ReminderHost />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="project/[id]" />
            <Stack.Screen name="label/[id]" />
            <Stack.Screen name="filter/[id]" />
            <Stack.Screen name="projects/archived" />
            <Stack.Screen name="completed" />
            <Stack.Screen name="task/[id]" />
            <Stack.Screen name="quick-add" options={{ presentation: 'transparentModal', animation: 'fade' }} />
            <Stack.Screen name="project-form" options={{ presentation: 'modal' }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
        </View>
      </TopBannerProvider>
    </SnackbarProvider>
  );
}

function createSignedInLayoutStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });
}
