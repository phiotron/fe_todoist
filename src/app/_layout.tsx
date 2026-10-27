import '../i18n';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider } from '../features/auth/session';
import { persistOptions, queryClient } from '../lib/queryClient';

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
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
      >
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
