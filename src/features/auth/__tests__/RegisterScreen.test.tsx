import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi.json';
import { tokenStore } from '../../../lib/tokenStore';
import { authResponse } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { RegisterScreen } from '../RegisterScreen';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

// RNTL 14: fireEvent is async and must be awaited.
async function fill(displayName: string, email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('register-displayName'), displayName);
  await fireEvent.changeText(screen.getByTestId('register-email'), email);
  await fireEvent.changeText(screen.getByTestId('register-password'), password);
}

async function fillAndSubmit(displayName: string, email: string, password: string) {
  await fill(displayName, email, password);
  await fireEvent.press(screen.getByTestId('register-submit'));
}

describe('RegisterScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.clear();
  });

  it('registers, stores the tokens and navigates home', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(201, authResponse()));
    await renderWithProviders(<RegisterScreen />);

    await fillAndSubmit('  An ', 'an@example.com', 'fixture-pass-1');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/register$/);
    expect(request.body).toEqual({ email: 'an@example.com', password: 'fixture-pass-1', displayName: 'An' });
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
  });

  it('shows "email already used" under the email field on 409', async () => {
    mockFetch().mockResolvedValueOnce(problem(409, 'Conflict'));
    await renderWithProviders(<RegisterScreen />);

    await fillAndSubmit('An', 'an@example.com', 'fixture-pass-1');

    await waitFor(() =>
      expect(screen.getByTestId('register-email-error').props.children).toBe(vi.auth.errors.emailTaken),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows server 400 field errors under the matching fields', async () => {
    mockFetch().mockResolvedValueOnce(
      problem(400, 'Bad Request', { errors: [{ field: 'displayName', message: 'server says too long' }] }),
    );
    await renderWithProviders(<RegisterScreen />);

    await fillAndSubmit('An', 'an@example.com', 'fixture-pass-1');

    await waitFor(() =>
      expect(screen.getByTestId('register-displayName-error').props.children).toBe('server says too long'),
    );
  });

  it('shows the real server 400 message for an over-long password under the password field', async () => {
    // Verbatim backend message (password > 72 bytes); the client must pass it through untouched.
    const serverMessage = 'Mật khẩu quá dài, hãy dùng mật khẩu ngắn hơn';
    mockFetch().mockResolvedValueOnce(
      problem(400, 'Bad Request', { errors: [{ field: 'password', message: serverMessage }] }),
    );
    await renderWithProviders(<RegisterScreen />);

    await fillAndSubmit('An', 'an@example.com', 'fixture-pass-1');

    await waitFor(() => expect(screen.getByTestId('register-password-error').props.children).toBe(serverMessage));
    expect(screen.queryByTestId('register-email-error')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('blocks a too-short password on the client', async () => {
    const fetchMock = mockFetch();
    await renderWithProviders(<RegisterScreen />);

    await fillAndSubmit('An', 'an@example.com', 'short');

    expect(await screen.findByText(vi.auth.validation.passwordLength)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends only one request when submit is pressed twice in a row', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(201, authResponse()));
    await renderWithProviders(<RegisterScreen />);
    await fill('An', 'an@example.com', 'fixture-pass-1');

    // Two presses inside one act(): React cannot re-render the button as disabled in between.
    const submit = screen.getByTestId('register-submit');
    const click = { currentTarget: submit, target: submit, nativeEvent: {}, stopPropagation: () => undefined };
    await act(async () => {
      submit.props.onClick(click);
      submit.props.onClick(click);
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(countRequests(fetchMock, '/auth/register')).toBe(1);
  });

  it('allows submitting again after a failure', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(problem(409, 'Conflict')).mockResolvedValueOnce(jsonResponse(201, authResponse()));
    await renderWithProviders(<RegisterScreen />);

    await fillAndSubmit('An', 'an@example.com', 'fixture-pass-1');
    await screen.findByTestId('register-email-error');
    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(countRequests(fetchMock, '/auth/register')).toBe(2);
  });

  it('exposes an accessible name and busy state on the submit button, and alert role on errors', async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    mockFetch().mockReturnValueOnce(new Promise<Response>((resolve) => (resolveFetch = resolve)));
    await renderWithProviders(<RegisterScreen />);
    expect(screen.getByTestId('register-submit').props.accessibilityLabel).toBe(vi.auth.register.submit);

    await fill('An', 'an@example.com', 'fixture-pass-1');
    // Do not await the press: the handler stays pending until the fetch resolves.
    const submit = screen.getByTestId('register-submit');
    const click = { currentTarget: submit, target: submit, nativeEvent: {}, stopPropagation: () => undefined };
    await act(async () => {
      submit.props.onClick(click);
    });
    await waitFor(() =>
      expect(screen.getByTestId('register-submit').props.accessibilityState).toMatchObject({
        busy: true,
        disabled: true,
      }),
    );
    expect(screen.getByTestId('register-submit').props.accessibilityLabel).toBe(vi.auth.register.submit);

    resolveFetch(problem(409, 'Conflict'));
    const fieldError = await screen.findByTestId('register-email-error');
    expect(fieldError.props.accessibilityRole).toBe('alert');
    expect(fieldError.props.accessibilityLiveRegion).toBe('polite');
    // The button is usable and no longer busy once the request failed.
    expect(screen.getByTestId('register-submit').props.accessibilityState).toMatchObject({
      busy: false,
      disabled: false,
    });
  });

  it('releases the submit lock after a client validation error so a corrected form can be sent', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(201, authResponse()));
    await renderWithProviders(<RegisterScreen />);

    await fillAndSubmit('An', 'an@example.com', 'short');
    expect(await screen.findByText(vi.auth.validation.passwordLength)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('register-password'), 'fixture-pass-1');
    await fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(countRequests(fetchMock, '/auth/register')).toBe(1);
  });
});
