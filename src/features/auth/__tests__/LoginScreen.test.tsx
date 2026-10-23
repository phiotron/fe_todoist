import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi.json';
import { tokenStore } from '../../../lib/tokenStore';
import { authResponse } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
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
});
