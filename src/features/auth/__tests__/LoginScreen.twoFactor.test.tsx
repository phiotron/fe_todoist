import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { LoginScreen } from '../LoginScreen';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canDismiss: jest.fn(() => false), dismissAll: jest.fn() },
}));

async function submit() {
  await fireEvent.changeText(screen.getByTestId('login-email'), 'an@example.com');
  await fireEvent.changeText(screen.getByTestId('login-password'), 'fixture-pass-1');
  await fireEvent.press(screen.getByTestId('login-submit'));
}

describe('LoginScreen — two-factor (spec 12.1)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.clear();
  });

  it('401 two-factor-required opens the code screen: no error, no tokens, the button is usable again', async () => {
    mockFetch().mockResolvedValueOnce(
      problem(401, 'Unauthorized', { code: 'two-factor-required', twoFactorToken: 'challenge-1' }),
    );
    await renderWithProviders(<LoginScreen />);

    await submit();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/two-factor'));
    expect(screen.queryByText(vi.auth.errors.invalidCredentials)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    await waitFor(() => expect(screen.getByTestId('login-submit').props.accessibilityState).toMatchObject({ busy: false }));
  });

  it('a plain wrong password is still "wrong email or password"', async () => {
    mockFetch().mockResolvedValueOnce(problem(401, 'Unauthorized'));
    await renderWithProviders(<LoginScreen />);

    await submit();

    expect(await screen.findByText(vi.auth.errors.invalidCredentials)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
