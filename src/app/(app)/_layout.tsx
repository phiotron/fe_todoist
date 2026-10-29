import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { OfflineBanner } from '../../components/OfflineBanner';
import { SnackbarProvider } from '../../components/Snackbar';
import { TopBannerProvider } from '../../components/useTopInset';
import { useSession } from '../../features/auth/session';
import { purgeLegacyQueryCache } from '../../lib/queryClient';
import { useAfterInteractions } from '../../lib/useAfterInteractions';
import { PushTokenHost } from '../../features/push/PushTokenHost';
import { GoalCelebrationHost } from '../../features/productivity/GoalCelebrationHost';
import { ReminderHost } from '../../features/reminders/ReminderHost';
import { SyncHost } from '../../features/sync/SyncHost';
import { SyncStatusPill } from '../../features/sync/SyncStatusPill';
import { ShareIntentHandler } from '../../features/share/ShareIntentHandler';
import { TimeZoneBanner } from '../../features/settings/TimeZoneBanner';
import { WidgetSnapshotWriter } from '../../features/widgets/WidgetSnapshotWriter';
import { useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

export default function SignedInLayout() {
  const styles = useThemedStyles(createSignedInLayoutStyles);
  const { palette } = useTheme();
  const { status } = useSession();
  // PERF3: the hosts that only serve the background wait until the first screen is drawn (see useAfterInteractions).
  const settled = useAfterInteractions();
  // Frees the disk of the unbudgeted cache an older version wrote (a 2+ MB row); one cheap remove, once the app is settled.
  useEffect(() => {
    if (settled) void purgeLegacyQueryCache();
  }, [settled]);
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
          <ReminderHost settled={settled} />
          {/* M9: offline queue + sync engine (renders nothing) and the "syncing" pill. */}
          <SyncHost />
          <SyncStatusPill />
          {/* M12: text shared into Taskly from another app opens Quick Add. */}
          <ShareIntentHandler />
          {settled ? (
            <>
              {/* M13c: registers this device's push token with the server; renders nothing. */}
              <PushTokenHost />
              {/* M10: congratulates when a daily / weekly goal is reached; renders nothing. */}
              <GoalCelebrationHost />
              {/* M12: the picture the home-screen widgets draw (Today's tasks). */}
              <WidgetSnapshotWriter />
            </>
          ) : null}
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="project/[id]" />
            <Stack.Screen name="label/[id]" />
            <Stack.Screen name="filter/[id]" />
            <Stack.Screen name="projects/archived" />
            <Stack.Screen name="completed" />
            <Stack.Screen name="templates/index" />
            <Stack.Screen name="templates/[id]" />
            <Stack.Screen name="productivity" />
            <Stack.Screen name="karma-levels" />
            <Stack.Screen name="activity" />
            <Stack.Screen name="project-insights" />
            <Stack.Screen name="task/[id]" />
            <Stack.Screen name="project-comments/[id]" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="review" />
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
