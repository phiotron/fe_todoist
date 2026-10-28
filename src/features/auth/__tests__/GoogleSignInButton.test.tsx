import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { setGoogleSignInPlatform, type GoogleSignInResult } from '../../../lib/googleSignIn';
import { tokenStore } from '../../../lib/tokenStore';
import { FakeGoogleSignInPlatform } from '../../../test/fakeGoogleSignInPlatform';
import { authResponse } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { GoogleSignInButton } from '../GoogleSignInButton';

const SUCCESS: GoogleSignInResult = { type: 'success', idToken: 'gid-1', email: 'an@example.com' };

/** Starts a press without waiting for the async handler (same technique as LoginScreen.test.tsx in M0). */
async function startPress(testID: string) {
  const button = screen.getByTestId(testID);
  const click = { currentTarget: button, target: button, nativeEvent: {}, stopPropagation: () => undefined };
  await act(async () => {
    button.props.onClick(click);
  });
}

async function renderButton(props: { disabled?: boolean } = {}) {
  const onSignedIn = jest.fn();
  const onLinkRequired = jest.fn();
  const onTwoFactorRequired = jest.fn();
  const onBusyChange = jest.fn();
  await renderWithProviders(
    <GoogleSignInButton
      testID="google"
      disabled={props.disabled}
      onSignedIn={onSignedIn}
      onLinkRequired={onLinkRequired}
      onTwoFactorRequired={onTwoFactorRequired}
      onBusyChange={onBusyChange}
    />,
  );
  return { onSignedIn, onLinkRequired, onTwoFactorRequired, onBusyChange };
}

describe('GoogleSignInButton', () => {
  let google: FakeGoogleSignInPlatform;

  beforeEach(async () => {
    google = new FakeGoogleSignInPlatform();
    setGoogleSignInPlatform(google);
    await tokenStore.clear();
  });

  afterEach(() => setGoogleSignInPlatform(null));

  it('shows "Continue with Google" with an accessible name', async () => {
    await renderButton();
    expect(screen.getByText(vi.google.continue)).toBeTruthy();
    expect(screen.getByTestId('google').props.accessibilityLabel).toBe(vi.google.continue);
  });

  it('signs in a new or already linked Google account and calls onSignedIn', async () => {
    google.queue(SUCCESS);
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, authResponse('acc-g', 'ref-g')));
    const { onSignedIn, onLinkRequired, onTwoFactorRequired } = await renderButton();

    await fireEvent.press(screen.getByTestId('google'));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(onLinkRequired).not.toHaveBeenCalled();
    expect(onTwoFactorRequired).not.toHaveBeenCalled();
    expect(requestAt(fetchMock, 0).body).toEqual({ idToken: 'gid-1' });
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-g');
  });

  it('does nothing when the user cancels: no request, no message, no callback', async () => {
    google.queue({ type: 'cancelled' });
    const fetchMock = mockFetch();
    const { onSignedIn, onLinkRequired, onBusyChange } = await renderButton();

    await fireEvent.press(screen.getByTestId('google'));

    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('google-error')).toBeNull();
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(onLinkRequired).not.toHaveBeenCalled();
  });

  it('calls onLinkRequired on 409 link-required and stores no tokens', async () => {
    google.queue(SUCCESS);
    mockFetch().mockResolvedValueOnce(problem(409, 'Conflict', { code: 'link-required', linkToken: 'lt-1' }));
    const { onSignedIn, onLinkRequired } = await renderButton();

    await fireEvent.press(screen.getByTestId('google'));

    await waitFor(() => expect(onLinkRequired).toHaveBeenCalledTimes(1));
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.queryByTestId('google-error')).toBeNull();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
  });

  it('calls onTwoFactorRequired on 401 two-factor-required, without an error message', async () => {
    google.queue(SUCCESS);
    mockFetch().mockResolvedValueOnce(
      problem(401, 'Unauthorized', { code: 'two-factor-required', twoFactorToken: 'tf-1' }),
    );
    const { onSignedIn, onTwoFactorRequired } = await renderButton();

    await fireEvent.press(screen.getByTestId('google'));

    await waitFor(() => expect(onTwoFactorRequired).toHaveBeenCalledTimes(1));
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.queryByTestId('google-error')).toBeNull();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
  });

  it.each([
    ['403', () => problem(403, 'Forbidden'), vi.google.errors.emailNotVerified],
    ['401', () => problem(401, 'Unauthorized'), vi.google.errors.failed],
    ['429', () => problem(429, 'Too Many Requests'), vi.errors.tooManyRequests],
  ])('shows the right message on %s', async (_label, failure, message) => {
    google.queue(SUCCESS);
    mockFetch().mockResolvedValueOnce(failure());
    const { onSignedIn } = await renderButton();

    await fireEvent.press(screen.getByTestId('google'));

    const error = await screen.findByTestId('google-error');
    expect(error.props.children).toBe(message);
    expect(error.props.accessibilityRole).toBe('alert');
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it.each([
    ['notConfigured', vi.google.errors.notConfigured],
    ['playServices', vi.google.errors.playServices],
  ] as const)('shows the %s failure without calling the backend', async (reason, message) => {
    google.queue({ type: 'error', reason });
    const fetchMock = mockFetch();
    await renderButton();

    await fireEvent.press(screen.getByTestId('google'));

    expect((await screen.findByTestId('google-error')).props.children).toBe(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says "not configured" while no native adapter is installed (the default platform)', async () => {
    setGoogleSignInPlatform(null);
    const fetchMock = mockFetch();
    await renderButton();

    await fireEvent.press(screen.getByTestId('google'));

    expect((await screen.findByTestId('google-error')).props.children).toBe(vi.google.errors.notConfigured);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the server as unreachable on network errors', async () => {
    google.queue(SUCCESS);
    mockFetch().mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderButton();

    await fireEvent.press(screen.getByTestId('google'));

    expect((await screen.findByTestId('google-error')).props.children).toBe(vi.errors.network);
  });

  it('is busy and disabled while Google is open, then usable again after a failure', async () => {
    const answer = google.hold();
    const { onBusyChange } = await renderButton();

    // Do not await the press: the handler stays pending until the Google promise resolves.
    await startPress('google');
    await waitFor(() =>
      expect(screen.getByTestId('google').props.accessibilityState).toMatchObject({ busy: true, disabled: true }),
    );
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    await fireEvent.press(screen.getByTestId('google'));
    expect(google.signInCalls).toBe(1);

    await act(async () => answer({ type: 'error', reason: 'failed' }));
    await screen.findByTestId('google-error');
    expect(screen.getByTestId('google').props.accessibilityState).toMatchObject({ busy: false, disabled: false });
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('cannot be pressed while the parent form is submitting', async () => {
    await renderButton({ disabled: true });

    await fireEvent.press(screen.getByTestId('google'));

    expect(google.signInCalls).toBe(0);
  });
});
