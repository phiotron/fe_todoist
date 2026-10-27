import { render, screen } from '@testing-library/react-native';
import RootLayout from '../../app/_layout';

jest.mock('expo-router', () => ({
  Stack: () => require('react').createElement(require('react-native').Text, null, 'stack'),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../../features/auth/session', () => ({
  SessionProvider: ({ children }: { children?: unknown }) => children,
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

  it('renders the stack once the fonts are loaded', async () => {
    jest.spyOn(Figtree, 'useFonts').mockReturnValue([true, null]);
    await render(<RootLayout />);
    expect(screen.getByText('stack')).toBeOnTheScreen();
  });

  it('does not block the app when the fonts fail to load (system font is used)', async () => {
    jest.spyOn(Figtree, 'useFonts').mockReturnValue([false, new Error('font')]);
    await render(<RootLayout />);
    expect(screen.getByText('stack')).toBeOnTheScreen();
  });
});
