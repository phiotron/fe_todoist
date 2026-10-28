import '../i18n';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider } from '../features/auth/session';
import { installReminderPlatform } from '../features/reminders/notifications';
import { SettingsProvider } from '../features/settings/SettingsProvider';
import { SettingsThemeProvider } from '../features/settings/SettingsThemeProvider';
import { installNativeGoogleSignIn } from '../lib/googleSignInAdapter';
import { persistOptions, queryClient } from '../lib/queryClient';
import { useTheme } from '../theme';

// Once per app start: the real Google Sign-In behind the GoogleSignInPlatform port (tests install a fake instead).
installNativeGoogleSignIn();
// Startup, once, before any screen renders: reminders talk to the OS only through the ReminderPlatform port.
installReminderPlatform();

/**
 * Status bar icons and every header / tab / sheet background of the navigators follow the active theme (the navigation
 * theme is built from the design tokens). TODO(Task 10): once expo-system-ui is installed, also call
 * SystemUI.setBackgroundColorAsync(palette.bg) here so the root window colour follows the theme.
 */
function ThemedStack() {
  const { scheme, palette } = useTheme();
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.acc,
        background: palette.bg,
        card: palette.bg,
        text: palette.ink,
        border: palette.line,
        notification: palette.acc,
      },
    };
  }, [scheme, palette]);
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  // The keys become the fontFamily names used by src/theme/typography.ts.
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  // expo-router keeps the splash screen up while the root layout renders nothing. Bundled fonts load in a few hundred
  // ms; on error the system font is used instead of blocking the app.
  if (!fontsLoaded && !fontError) return null;
  return (
    // Swipe actions, drag-to-reorder and the bottom sheets all need the gesture-handler root.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SessionProvider>
          {/* Renders nothing until the cached theme and language are read (a few ms on start). */}
          <SettingsProvider>
            <SettingsThemeProvider>
              <ThemedStack />
            </SettingsThemeProvider>
          </SettingsProvider>
        </SessionProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
