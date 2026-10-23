import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import vi from '../../../i18n/locales/vi.json';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, requestAt } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { useSession } from '../../auth/session';
import { HomeScreen } from '../HomeScreen';

const greeting = vi.home.greeting.replace('{{name}}', testUser.displayName);

/** Mirrors what the (app) guard does: once signed out the home screen is replaced by the login route. */
function GuardedHome() {
  const { status } = useSession();
  return status === 'signedOut' ? <Text testID="login-route">login</Text> : <HomeScreen />;
}

describe('HomeScreen', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('greets the signed-in user by display name from GET /me', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, testUser));
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(greeting)).toBeTruthy();
    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/me$/);
  });

  it('shows the network error when GET /me cannot reach the server', async () => {
    mockFetch().mockRejectedValue(new TypeError('Network request failed'));
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(vi.errors.network)).toBeTruthy();
  });

  it('signs out: calls logout and clears the stored tokens', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/api/v1/me') ? jsonResponse(200, testUser) : jsonResponse(204),
    );
    await renderWithProviders(<HomeScreen />);
    await screen.findByText(greeting);

    await fireEvent.press(screen.getByTestId('home-sign-out'));

    await waitFor(() => expect(countRequests(fetchMock, '/api/v1/auth/logout')).toBe(1));
    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBeNull());
  });

  it('does not crash when signOut rejects (token clear fails) and still ends up signed out', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/api/v1/me') ? jsonResponse(200, testUser) : jsonResponse(204),
    );
    jest.spyOn(tokenStore, 'clear').mockRejectedValue(new Error('SecureStore failure'));
    // Any unhandled rejection raised by the press handler would surface here.
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      await renderWithProviders(<GuardedHome />);
      await screen.findByText(greeting);

      await fireEvent.press(screen.getByTestId('home-sign-out'));

      expect(await screen.findByTestId('login-route')).toBeTruthy();
      // Let any pending rejection reach the process-level handler.
      await act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
      });
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('ignores a second press while signing out', async () => {
    const fetchMock = mockFetch();
    let releaseLogout: () => void = () => {};
    const logoutGate = new Promise<void>((resolve) => {
      releaseLogout = resolve;
    });
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/api/v1/me')) return jsonResponse(200, testUser);
      await logoutGate;
      return jsonResponse(204);
    });
    await renderWithProviders(<HomeScreen />);
    await screen.findByText(greeting);

    // Two presses land before React re-renders, so only the synchronous guard can stop the second one.
    const button = screen.getByTestId('home-sign-out');
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
      releaseLogout();
    });

    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBeNull());
    expect(countRequests(fetchMock, '/api/v1/auth/logout')).toBe(1);
  });
});
