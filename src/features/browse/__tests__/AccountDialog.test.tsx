import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { useSession } from '../../auth/session';
import { AccountDialog } from '../AccountDialog';

/** Mirrors the (app) guard: once signed out the app shows the login route. */
function Guarded() {
  const { status } = useSession();
  return status === 'signedOut' ? <Text testID="login-route">login</Text> : <AccountDialog visible onClose={jest.fn()} />;
}

function answerMeAndLogout() {
  const fetchMock = mockFetch();
  fetchMock.mockImplementation(async (input) =>
    String(input).endsWith('/api/v1/me') ? jsonResponse(200, testUser) : jsonResponse(204),
  );
  return fetchMock;
}

describe('AccountDialog', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows who is signed in', async () => {
    answerMeAndLogout();
    await renderWithProviders(<AccountDialog visible onClose={jest.fn()} />);
    expect(await screen.findByTestId('account-name')).toHaveTextContent(testUser.displayName);
    expect(screen.getByTestId('account-email')).toHaveTextContent(testUser.email);
  });

  it('signs out: revokes on the server and clears the stored tokens', async () => {
    const fetchMock = answerMeAndLogout();
    await renderWithProviders(<AccountDialog visible onClose={jest.fn()} />);
    await screen.findByTestId('account-name');

    await fireEvent.press(screen.getByTestId('account-sign-out'));

    await waitFor(() => expect(countRequests(fetchMock, '/api/v1/auth/logout')).toBe(1));
    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBeNull());
  });

  it('still ends up signed out without crashing when clearing tokens fails', async () => {
    answerMeAndLogout();
    jest.spyOn(tokenStore, 'clear').mockRejectedValue(new Error('SecureStore failure'));
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      await renderWithProviders(<Guarded />);
      await screen.findByTestId('account-name');

      await fireEvent.press(screen.getByTestId('account-sign-out'));

      expect(await screen.findByTestId('login-route')).toBeOnTheScreen();
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
    let releaseLogout: () => void = () => undefined;
    const logoutGate = new Promise<void>((resolve) => {
      releaseLogout = resolve;
    });
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/api/v1/me')) return jsonResponse(200, testUser);
      await logoutGate;
      return jsonResponse(204);
    });
    await renderWithProviders(<AccountDialog visible onClose={jest.fn()} />);
    await screen.findByTestId('account-name');

    const button = screen.getByTestId('account-sign-out');
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
      releaseLogout();
    });

    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBeNull());
    expect(countRequests(fetchMock, '/api/v1/auth/logout')).toBe(1);
  });
});
