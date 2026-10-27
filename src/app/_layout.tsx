import '../i18n';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider } from '../features/auth/session';
import { persistOptions, queryClient } from '../lib/queryClient';

export default function RootLayout() {
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
