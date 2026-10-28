// Shared Jest mocks for native modules that do not exist in the Node test environment.

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  },
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'vi', languageTag: 'vi-VN' }],
}));

// --- M1 native libraries -------------------------------------------------------------------------
// Gesture-handler / reanimated / draggable-flatlist need native code; components that use them are
// rendered as plain views. Swipe and drag behaviour is reached in tests through the same callbacks
// (props such as onDragEnd are found by fireEvent, which walks composite components).

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: View };
});

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  // onSwipeableOpen goes on the host view so tests can fire 'swipeableOpen' with 'left' | 'right'.
  function MockSwipeable({
    children,
    testID,
    onSwipeableOpen,
  }: {
    children?: unknown;
    testID?: string;
    onSwipeableOpen?: (direction: string) => void;
  }) {
    return React.createElement(View, { testID, onSwipeableOpen }, children);
  }
  return { __esModule: true, default: MockSwipeable, SwipeDirection: { LEFT: 'left', RIGHT: 'right' } };
});

jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  function MockDraggableFlatList(props: Record<string, unknown>) {
    const { renderItem, onDragEnd, ...rest } = props as {
      renderItem: (params: Record<string, unknown>) => unknown;
      onDragEnd?: unknown;
    };
    void onDragEnd;
    return React.createElement(FlatList, {
      ...rest,
      renderItem: ({ item, index }: { item: unknown; index: number }) =>
        renderItem({ item, getIndex: () => index, drag: () => undefined, isActive: false }),
    });
  }
  return {
    __esModule: true,
    default: MockDraggableFlatList,
    ScaleDecorator: ({ children }: { children?: unknown }) => children,
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function MockIcon({ name, testID }: { name: string; testID?: string }) {
    return React.createElement(Text, { testID }, name);
  }
  // The app uses Feather (same stroke style as the design icons); Ionicons kept for any leftover use.
  return { Feather: MockIcon, Ionicons: MockIcon };
});

// Fonts are bundled .ttf assets loaded at runtime: report them as loaded.
jest.mock('@expo-google-fonts/figtree', () => ({
  useFonts: () => [true, null],
  Figtree_400Regular: 1,
  Figtree_500Medium: 2,
  Figtree_600SemiBold: 3,
  Figtree_700Bold: 4,
}));

// Headers, the tab bar and the offline banner read the insets; tests render without a SafeAreaProvider.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => require('node:crypto').randomUUID()),
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

// Google Sign-In v16 is native-only. Each test can override these with jest.mocked(...).mockResolvedValueOnce(...).
jest.mock('@react-native-google-signin/google-signin', () => {
  const statusCodes = {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
    NULL_PRESENTER: 'NULL_PRESENTER',
  };
  return {
    statusCodes,
    GoogleSignin: {
      configure: jest.fn(),
      hasPlayServices: jest.fn(async () => true),
      signIn: jest.fn(async () => ({
        type: 'success',
        data: {
          idToken: 'google-id-token',
          serverAuthCode: null,
          scopes: [],
          user: { id: 'g-1', email: 'an@example.com', name: 'An', photo: null, familyName: null, givenName: 'An' },
        },
      })),
      signOut: jest.fn(async () => null),
    },
    isSuccessResponse: (response: { type: string }) => response.type === 'success',
    isCancelledResponse: (response: { type: string }) => response.type === 'cancelled',
    isErrorWithCode: (error: unknown) =>
      error instanceof Error && typeof (error as Error & { code?: unknown }).code === 'string',
  };
});

// --- M4 expo-notifications --------------------------------------------------------------------------
// In-memory fake of the parts the app uses. Tests reset it with resetNotificationsMock() (src/test/notifications.ts).
jest.mock('expo-notifications', () => {
  const scheduled = new Map<string, { identifier: string; content: Record<string, unknown>; trigger: unknown }>();
  const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
  return {
    __esModule: true,
    SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
    AndroidImportance: { DEFAULT: 5, HIGH: 6, MAX: 7 },
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    setNotificationCategoryAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => granted),
    requestPermissionsAsync: jest.fn(async () => granted),
    getExactAlarmPermissionsAsync: jest.fn(async () => granted),
    requestExactAlarmPermissionsAsync: jest.fn(async () => granted),
    scheduleNotificationAsync: jest.fn(
      async (request: { identifier?: string; content: Record<string, unknown>; trigger: unknown }) => {
        const identifier = request.identifier ?? `notification-${scheduled.size + 1}`;
        scheduled.set(identifier, { identifier, content: request.content, trigger: request.trigger });
        return identifier;
      },
    ),
    cancelScheduledNotificationAsync: jest.fn(async (identifier: string) => {
      scheduled.delete(identifier);
    }),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => {
      scheduled.clear();
    }),
    getAllScheduledNotificationsAsync: jest.fn(async () => [...scheduled.values()]),
    dismissNotificationAsync: jest.fn(async () => undefined),
    getLastNotificationResponse: jest.fn(() => null),
    clearLastNotificationResponse: jest.fn(),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  };
});

// --- M12 expo-location / expo-task-manager -----------------------------------------------------------
// Native-only: location reminders are tested through the GeofencePlatform port; these keep imports working.
jest.mock('expo-location', () => ({
  __esModule: true,
  GeofencingEventType: { Enter: 1, Exit: 2 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true, status: 'undetermined' })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true, status: 'undetermined' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 10.7769, longitude: 106.7009 } })),
  startGeofencingAsync: jest.fn(async () => undefined),
  stopGeofencingAsync: jest.fn(async () => undefined),
  hasStartedGeofencingAsync: jest.fn(async () => false),
}));

jest.mock('expo-task-manager', () => ({
  __esModule: true,
  defineTask: jest.fn(),
}));

// --- M12 react-native-android-widget ------------------------------------------------------------------
// Native-only. The widget views are plain element trees (inspected without rendering); the update call is a spy.
jest.mock('react-native-android-widget', () => ({
  __esModule: true,
  FlexWidget: () => null,
  TextWidget: () => null,
  registerWidgetTaskHandler: jest.fn(),
  requestWidgetUpdate: jest.fn(async () => undefined),
}));