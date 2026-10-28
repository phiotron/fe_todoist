import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { viTranslation as vi } from '../../../i18n';
import { setGoogleSignInPlatform, type GoogleSignInResult } from '../../../lib/googleSignIn';
import { tokenStore } from '../../../lib/tokenStore';
import { FakeGoogleSignInPlatform } from '../../../test/fakeGoogleSignInPlatform';
import { authResponse } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt, type FetchMock } from '../../../test/http';
import { routeFetch, type RouteHandler } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { LoginScreen } from '../LoginScreen';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: jest.fn(() => true),
    canDismiss: jest.fn(() => true),
  },
}));

const GOOGLE = 'POST /api/v1/auth/google';
const LOGIN = 'POST /api/v1/auth/login';
const IDENTITY = 'POST /api/v1/me/identities/google';
const IDENTITY_PATH = '/api/v1/me/identities/google';
const SUCCESS: GoogleSignInResult = { type: 'success', idToken: 'gid-1', email: 'an@example.com' };
const LINK_REQUIRED = { code: 'link-required', linkToken: 'lt-1' };
const TWO_FACTOR_REQUIRED = { code: 'two-factor-required', twoFactorToken: 'tf-1' };

function serve(routes: Record<string, RouteHandler>): FetchMock {
  const fetchMock = mockFetch();
  routeFetch(fetchMock, routes);
  return fetchMock;
}

/** The first request sent to `path`. */
function requestTo(fetchMock: FetchMock, path: string) {
  const index = fetchMock.mock.calls.findIndex(([input]) => String(input).endsWith(path));
  expect(index).toBeGreaterThanOrEqual(0);
  return requestAt(fetchMock, index);
}

describe('LoginScreen — Google', () => {
  let alertSpy: jest.SpyInstance;
  let google: FakeGoogleSignInPlatform;

  beforeEach(async () => {
    google = new FakeGoogleSignInPlatform();
    setGoogleSignInPlatform(google);
    await tokenStore.clear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    setGoogleSignInPlatform(null);
  });

  async function pressGoogle() {
    await fireEvent.press(screen.getByTestId('login-google'));
  }

  async function submitPassword(password: string) {
    await fireEvent.changeText(screen.getByTestId('login-password'), password);
    await fireEvent.press(screen.getByTestId('login-submit'));
  }

  it('signs in with Google and goes home', async () => {
    google.queue(SUCCESS);
    serve({ [GOOGLE]: () => jsonResponse(200, authResponse()) });
    await renderWithProviders(<LoginScreen />);
    expect(screen.getByText(vi.google.or)).toBeTruthy();
    expect(screen.getByText(vi.google.continue)).toBeTruthy();

    await pressGoogle();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('cancelling Google changes nothing', async () => {
    google.queue({ type: 'cancelled' });
    const fetchMock = mockFetch();
    await renderWithProviders(<LoginScreen />);

    await pressGoogle();

    await waitFor(() => expect(screen.getByTestId('login-google').props.accessibilityState.busy).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('login-google-link-notice')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('a Google account with 2FA goes to the two-factor screen', async () => {
    google.queue(SUCCESS);
    serve({ [GOOGLE]: () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED) });
    await renderWithProviders(<LoginScreen />);

    await pressGoogle();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/two-factor'));
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId('login-google-error')).toBeNull();
    expect(screen.queryByTestId('login-google-link-notice')).toBeNull();
  });

  it('on link-required asks for the password, prefills the email, then links and reports success', async () => {
    google.queue(SUCCESS);
    const fetchMock = serve({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => jsonResponse(200, authResponse('acc-2', 'ref-2')),
      [IDENTITY]: () => jsonResponse(204),
    });
    await renderWithProviders(<LoginScreen />);

    await pressGoogle();

    expect(await screen.findByText(vi.google.linkRequired)).toBeTruthy();
    expect(screen.getByTestId('login-email').props.value).toBe('an@example.com');
    expect(router.replace).not.toHaveBeenCalled();

    await submitPassword('fixture-pass-1');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(requestTo(fetchMock, '/api/v1/auth/login').method).toBe('POST');
    const link = requestTo(fetchMock, IDENTITY_PATH);
    expect(link.body).toEqual({ linkToken: 'lt-1' });
    expect(link.headers.Authorization).toBe('Bearer acc-2');
    expect(alertSpy).toHaveBeenCalledWith(vi.google.linkedTitle, vi.google.linkedMessage);
  });

  it('stays signed in and explains when linking fails after the password sign-in', async () => {
    google.queue(SUCCESS);
    serve({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => jsonResponse(200, authResponse('acc-2', 'ref-2')),
      [IDENTITY]: () => problem(400, 'Bad Request'),
    });
    await renderWithProviders(<LoginScreen />);

    await pressGoogle();
    await screen.findByText(vi.google.linkRequired);
    await submitPassword('fixture-pass-1');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(alertSpy).toHaveBeenCalledWith(vi.google.linkFailedTitle, vi.google.errors.linkRejected);
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-2');
  });

  it('a wrong password keeps the pending link so the user can retry', async () => {
    google.queue(SUCCESS);
    const fetchMock = serve({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => problem(401, 'Unauthorized'),
    });
    await renderWithProviders(<LoginScreen />);

    await pressGoogle();
    await screen.findByText(vi.google.linkRequired);
    await submitPassword('fixture-wrong-1');

    expect(await screen.findByText(vi.auth.errors.invalidCredentials)).toBeTruthy();
    expect(screen.getByText(vi.google.linkRequired)).toBeTruthy();
    expect(countRequests(fetchMock, IDENTITY_PATH)).toBe(0);
  });

  it('a password sign-in that needs 2FA goes to the code screen and does not link yet', async () => {
    google.queue(SUCCESS);
    const fetchMock = serve({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => problem(401, 'Unauthorized', TWO_FACTOR_REQUIRED),
    });
    await renderWithProviders(<LoginScreen />);

    await pressGoogle();
    await screen.findByText(vi.google.linkRequired);
    await submitPassword('fixture-pass-1');

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/two-factor'));
    // Linking waits for the code (the two-factor screen): no request, no dialog, the notice is still there.
    expect(countRequests(fetchMock, IDENTITY_PATH)).toBe(0);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText(vi.google.linkRequired)).toBeTruthy();
  });

  it('"Don\'t link" drops the pending link: a later password sign-in does not link', async () => {
    google.queue(SUCCESS);
    const fetchMock = serve({
      [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED),
      [LOGIN]: () => jsonResponse(200, authResponse()),
    });
    await renderWithProviders(<LoginScreen />);

    await pressGoogle();
    await screen.findByText(vi.google.linkRequired);
    await fireEvent.press(screen.getByTestId('login-google-link-cancel'));
    expect(screen.queryByTestId('login-google-link-notice')).toBeNull();

    await submitPassword('fixture-pass-1');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(countRequests(fetchMock, IDENTITY_PATH)).toBe(0);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('the link-required notice quotes the "Forgot your password?" link that sits on the same screen', async () => {
    google.queue(SUCCESS);
    serve({ [GOOGLE]: () => problem(409, 'Conflict', LINK_REQUIRED) });
    await renderWithProviders(<LoginScreen />);

    await pressGoogle();

    const notice = await screen.findByText(vi.google.linkRequired);
    expect(notice.props.children).toContain(vi.auth.login.forgotPassword);
    expect(screen.getByTestId('login-go-forgot')).toBeTruthy();
    expect(screen.getByText(vi.auth.login.forgotPassword)).toBeTruthy();
  });

  it('disables the password submit while Google is open', async () => {
    google.hold();
    await renderWithProviders(<LoginScreen />);

    // Do not await the handler: Google never answers in this test (same technique as LoginScreen.test.tsx).
    const button = screen.getByTestId('login-google');
    const click = { currentTarget: button, target: button, nativeEvent: {}, stopPropagation: () => undefined };
    await act(async () => {
      button.props.onClick(click);
    });

    await waitFor(() =>
      expect(screen.getByTestId('login-submit').props.accessibilityState).toMatchObject({ disabled: true }),
    );
  });
});
