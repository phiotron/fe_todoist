import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { OfflineBanner } from '../../components/OfflineBanner';
import { SnackbarProvider } from '../../components/Snackbar';
import { useSession } from '../../features/auth/session';
import { palette } from '../../theme';

export default function SignedInLayout() {
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
      <View style={styles.fill}>
        {/* M-Error: the offline banner sits on top of every screen and never blocks reading. */}
        <OfflineBanner />
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
        </Stack>
      </View>
    </SnackbarProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
