import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi.json';
import { tokenStore } from '../../../lib/tokenStore';
import { authApi } from '../../../api/auth';
import { authResponse } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { LoginScreen } from '../LoginScreen';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

// RNTL 14: fireEvent is async and must be awaited.
async function fillAndSubmit(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('login-email'), email);
  await fireEvent.changeText(screen.getByTestId('login-password'), password);
  await fireEvent.press(screen.getByTestId('login-submit'));
}

describe('LoginScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.clear();
  });

  it('logs in, stores the tokens and navigates home', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, authResponse()));
    await renderWithProviders(<LoginScreen />);
    expect(screen.getAllByText(vi.auth.login.title).length).toBeGreaterThan(0);

    await fillAndSubmit('  an@example.com ', 'fixture-pass-1');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(request.body).toEqual({ email: 'an@example.com', password: 'fixture-pass-1' });
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
    await expect(tokenStore.getRefreshToken()).resolves.toBe('ref-1');
  });

  it('shows "wrong email or password" on 401 and stays on the screen', async () => {
    mockFetch().mockResolvedValueOnce(problem(401, 'Unauthorized', { detail: 'Bad credentials' }));
    await renderWithProviders(<LoginScreen />);

    await fillAndSubmit('an@example.com', 'wrong-pass');

    expect(await screen.findByText(vi.auth.errors.invalidCredentials)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
  });

  it('validates on the client before calling the API', async () => {
    const fetchMock = mockFetch();
    await renderWithProviders(<LoginScreen />);

    await fillAndSubmit('an@', '');

    expect(await screen.findByText(vi.auth.validation.emailInvalid)).toBeTruthy();
    expect(screen.getByText(vi.auth.validation.passwordRequired)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tells the user the server is unreachable on network errors', async () => {
    mockFetch().mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderWithProviders(<LoginScreen />);

    await fillAndSubmit('an@example.com', 'fixture-pass-1');

    expect(await screen.findByText(vi.errors.network)).toBeTruthy();
  });

  it('sends only one request when submit is pressed twice in a row', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, authResponse()));
    await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-email'), 'an@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'fixture-pass-1');

    // Two presses inside one act(): React cannot re-render the button as disabled in between.
    const submit = screen.getByTestId('login-submit');
    const click = { currentTarget: submit, target: submit, nativeEvent: {}, stopPropagation: () => undefined };
    await act(async () => {
      submit.props.onClick(click);
      submit.props.onClick(click);
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(countRequests(fetchMock, '/auth/login')).toBe(1);
  });

  it('allows submitting again after a failure', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(problem(401, 'Unauthorized')).mockResolvedValueOnce(jsonResponse(200, authResponse()));
    await renderWithProviders(<LoginScreen />);

    await fillAndSubmit('an@example.com', 'wrong-pass');
    await screen.findByText(vi.auth.errors.invalidCredentials);
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(countRequests(fetchMock, '/auth/login')).toBe(2);
  });

  it('exposes an accessible name and busy state on the submit button, and alert role on errors', async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    mockFetch().mockReturnValueOnce(new Promise<Response>((resolve) => (resolveFetch = resolve)));
    await renderWithProviders(<LoginScreen />);
    expect(screen.getByTestId('login-submit').props.accessibilityLabel).toBe(vi.auth.login.submit);

    await fireEvent.changeText(screen.getByTestId('login-email'), 'an@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'wrong-pass');
    // Do not await the press: the handler stays pending until the fetch resolves.
    const submit = screen.getByTestId('login-submit');
    const click = { currentTarget: submit, target: submit, nativeEvent: {}, stopPropagation: () => undefined };
    await act(async () => {
      submit.props.onClick(click);
    });
    await waitFor(() =>
      expect(screen.getByTestId('login-submit').props.accessibilityState).toMatchObject({
        busy: true,
        disabled: true,
      }),
    );
    expect(screen.getByTestId('login-submit').props.accessibilityLabel).toBe(vi.auth.login.submit);

    resolveFetch(problem(401, 'Unauthorized'));
    const formError = await screen.findByTestId('login-form-error');
    expect(formError.props.accessibilityRole).toBe('alert');
    expect(formError.props.accessibilityLiveRegion).toBe('polite');
    // The button is usable and no longer busy once the request failed.
    expect(screen.getByTestId('login-submit').props.accessibilityState).toMatchObject({
      busy: false,
      disabled: false,
    });
  });

  it('shows the session-expired notice as an alert after the refresh token is rejected', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    mockFetch().mockResolvedValue(problem(401, 'Unauthorized'));
    await renderWithProviders(<LoginScreen />);
    expect(screen.queryByTestId('login-expired-notice')).toBeNull();

    // A Bearer request gets 401, the refresh gets 401 too: the client fires the session-expired event.
    await act(async () => {
      await expect(authApi.me()).rejects.toMatchObject({ status: 401 });
    });

    const notice = await screen.findByTestId('login-expired-notice');
    expect(notice.props.children).toBe(vi.auth.errors.sessionExpired);
    expect(notice.props.accessibilityRole).toBe('alert');
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
  });

  it('releases the submit lock after a client validation error so a corrected form can be sent', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, authResponse()));
    await renderWithProviders(<LoginScreen />);

    await fillAndSubmit('an@example.com', '');
    expect(await screen.findByText(vi.auth.validation.passwordRequired)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('login-password'), 'fixture-pass-1');
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(countRequests(fetchMock, '/auth/login')).toBe(1);
  });
});
