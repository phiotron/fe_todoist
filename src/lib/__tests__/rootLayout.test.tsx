import { render, screen } from '@testing-library/react-native';
import RootLayout from '../../app/_layout';
import { getGoogleSignInPlatform, unavailableGoogleSignInPlatform } from '../googleSignIn';
import { expoReminderPlatform } from '../../features/reminders/notifications';
import { getReminderPlatform } from '../../features/reminders/platform';

jest.mock('expo-router', () => ({
  Stack: () => require('react').createElement(require('react-native').Text, null, 'stack'),
  // The navigation theme is built from the active palette; the mocks only pass the children through.
  DarkTheme: { dark: true, colors: {}, fonts: {} },
  DefaultTheme: { dark: false, colors: {}, fonts: {} },
  ThemeProvider: ({ children }: { children?: unknown }) => children,
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../../features/auth/session', () => ({
  SessionProvider: ({ children }: { children?: unknown }) => children,
  useSession: () => ({ status: 'signedOut' }),
}));

// The namespace import is an interop copy; spy on the module object that the layout itself receives.
const Figtree = jest.requireMock<{ useFonts: () => unknown }>('@expo-google-fonts/figtree');

describe('RootLayout font loading', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders nothing (splash stays up) until the Figtree fonts are loaded', async () => {
    jest.spyOn(Figtree, 'useFonts').mockReturnValue([false, null]);
    await render(<RootLayout />);
    expect(screen.queryByText('stack')).toBeNull();
  });

  it('renders the stack once the fonts are loaded and the cached settings are read', async () => {
    jest.spyOn(Figtree, 'useFonts').mockReturnValue([true, null]);
    await render(<RootLayout />);
    // SettingsProvider shows nothing until the device cache (theme, language) is read: a few ms.
    expect(await screen.findByText('stack')).toBeOnTheScreen();
  });

  it('does not block the app when the fonts fail to load (system font is used)', async () => {
    jest.spyOn(Figtree, 'useFonts').mockReturnValue([false, new Error('font')]);
    await render(<RootLayout />);
    expect(await screen.findByText('stack')).toBeOnTheScreen();
  });
});

describe('RootLayout startup', () => {
  it('installs the native Google Sign-In adapter once, when the layout module loads', () => {
    expect(getGoogleSignInPlatform()).not.toBe(unavailableGoogleSignInPlatform);
  });

  it('installs the expo-notifications reminder platform when the app module loads', () => {
    expect(getReminderPlatform()).toBe(expoReminderPlatform);
  });
});
