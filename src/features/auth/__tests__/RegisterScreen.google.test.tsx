import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { viTranslation as vi } from '../../../i18n';
import { setGoogleSignInPlatform } from '../../../lib/googleSignIn';
import { tokenStore } from '../../../lib/tokenStore';
import { FakeGoogleSignInPlatform } from '../../../test/fakeGoogleSignInPlatform';
import { authResponse } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { RegisterScreen } from '../RegisterScreen';

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

const SUCCESS = { type: 'success', idToken: 'gid-1', email: 'an@example.com' } as const;

describe('RegisterScreen — Google', () => {
  let google: FakeGoogleSignInPlatform;

  beforeEach(async () => {
    google = new FakeGoogleSignInPlatform();
    setGoogleSignInPlatform(google);
    await tokenStore.clear();
  });

  afterEach(() => setGoogleSignInPlatform(null));

  it('creates the account with Google and goes home', async () => {
    google.queue(SUCCESS);
    mockFetch().mockResolvedValueOnce(jsonResponse(201, authResponse()));
    await renderWithProviders(<RegisterScreen />);
    expect(screen.getByText(vi.google.continue)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('register-google'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('goes back to the login screen when the email already has a password account', async () => {
    google.queue(SUCCESS);
    mockFetch().mockResolvedValueOnce(problem(409, 'Conflict', { code: 'link-required', linkToken: 'lt-1' }));
    await renderWithProviders(<RegisterScreen />);

    await fireEvent.press(screen.getByTestId('register-google'));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
  });

  it('opens the two-factor screen when the linked Google account has 2FA on', async () => {
    google.queue(SUCCESS);
    mockFetch().mockResolvedValueOnce(
      problem(401, 'Unauthorized', { code: 'two-factor-required', twoFactorToken: 'tf-1' }),
    );
    await renderWithProviders(<RegisterScreen />);

    await fireEvent.press(screen.getByTestId('register-google'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/two-factor'));
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('cancelling Google changes nothing', async () => {
    google.queue({ type: 'cancelled' });
    const fetchMock = mockFetch();
    await renderWithProviders(<RegisterScreen />);

    await fireEvent.press(screen.getByTestId('register-google'));

    await waitFor(() => expect(screen.getByTestId('register-google').props.accessibilityState.busy).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
