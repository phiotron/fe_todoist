import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { routeApi, requestsTo } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { deferred } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    dismissTo: jest.fn(),
    dismissAll: jest.fn(),
    canDismiss: jest.fn(() => false),
  },
}));

const REQUEST_PATH = '/api/v1/auth/password-reset/request';
const sentText = (email: string) => vi.passwordReset.forgot.sent.replace('{{email}}', email);

async function submit(email: string) {
  await fireEvent.changeText(screen.getByTestId('forgot-email'), email);
  await fireEvent.press(screen.getByTestId('forgot-submit'));
}

describe('ForgotPasswordScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.clear();
  });

  it('checks the email on the device before calling the server', async () => {
    const fetchMock = mockFetch();
    await renderWithProviders(<ForgotPasswordScreen />);

    await submit('an@');

    expect(await screen.findByText(vi.auth.validation.emailInvalid)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the trimmed email without a bearer token and shows the same neutral "check your email" state', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    // Routed (not mockResolvedValueOnce): with a stored token the SessionProvider asks GET /me on mount, and that call
    // must not consume the one answer meant for the reset request.
    routeApi(fetchMock, {
      'GET /api/v1/me': () => jsonResponse(200, testUser),
      [`POST ${REQUEST_PATH}`]: () => jsonResponse(200),
    });
    await renderWithProviders(<ForgotPasswordScreen />);

    await submit('  an@example.com ');

    expect((await screen.findByTestId('forgot-sent')).props.children).toBe(sentText('an@example.com'));
    expect(screen.getByText(vi.passwordReset.forgot.sentTitle)).toBeTruthy();
    const requests = requestsTo(fetchMock, 'POST', REQUEST_PATH);
    expect(requests).toHaveLength(1);
    expect(requests[0].body).toEqual({ email: 'an@example.com' });
    expect(requests[0].headers.Authorization).toBeUndefined();
  });

  it('after sending, goes on to the reset screen, back to log in, or sends the email again', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async () => jsonResponse(200));
    await renderWithProviders(<ForgotPasswordScreen />);
    await submit('an@example.com');
    await screen.findByTestId('forgot-sent');

    await fireEvent.press(screen.getByTestId('forgot-have-code'));
    expect(router.push).toHaveBeenCalledWith('/reset-password');

    await fireEvent.press(screen.getByTestId('forgot-resend'));
    await waitFor(() => expect(countRequests(fetchMock, REQUEST_PATH)).toBe(2));
    expect(requestAt(fetchMock, 1).body).toEqual({ email: 'an@example.com' });

    await fireEvent.press(screen.getByTestId('forgot-back-login'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('mail service down (503): explains, keeps the email and allows trying again', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(problem(503, 'Service Unavailable')).mockResolvedValueOnce(jsonResponse(200));
    await renderWithProviders(<ForgotPasswordScreen />);

    await submit('an@example.com');

    expect((await screen.findByTestId('forgot-form-error')).props.children).toBe(vi.passwordReset.forgot.mailUnavailable);
    expect(screen.getByTestId('forgot-form-error').props.accessibilityRole).toBe('alert');
    expect(screen.getByTestId('forgot-email').props.value).toBe('an@example.com');

    await fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-sent')).toBeTruthy();
    expect(countRequests(fetchMock, REQUEST_PATH)).toBe(2);
  });

  it('shows the shared "server unreachable" sentence on network errors', async () => {
    mockFetch().mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderWithProviders(<ForgotPasswordScreen />);

    await submit('an@example.com');

    expect((await screen.findByTestId('forgot-form-error')).props.children).toBe(vi.errors.network);
  });

  it('sends a single request when submit is pressed twice quickly', async () => {
    const fetchMock = mockFetch();
    const answer = deferred<Response>();
    fetchMock.mockReturnValue(answer.promise);
    await renderWithProviders(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByTestId('forgot-email'), 'an@example.com');

    const button = screen.getByTestId('forgot-submit');
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
    });
    await act(async () => {
      answer.resolve(jsonResponse(200));
    });

    expect(await screen.findByTestId('forgot-sent')).toBeTruthy();
    expect(countRequests(fetchMock, REQUEST_PATH)).toBe(1);
  });

  it('the back button returns to log in', async () => {
    mockFetch();
    await renderWithProviders(<ForgotPasswordScreen />);

    await fireEvent.press(screen.getByTestId('forgot-back'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
