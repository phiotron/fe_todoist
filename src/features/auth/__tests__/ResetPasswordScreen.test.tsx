import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { ResetPasswordScreen } from '../ResetPasswordScreen';

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

async function fillAndSubmit(code: string, newPassword: string) {
  await fireEvent.changeText(screen.getByTestId('reset-code'), code);
  await fireEvent.changeText(screen.getByTestId('reset-newPassword'), newPassword);
  await fireEvent.press(screen.getByTestId('reset-submit'));
}

describe('ResetPasswordScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.clear();
  });

  it('checks the code and the new password on the device first', async () => {
    const fetchMock = mockFetch();
    await renderWithProviders(<ResetPasswordScreen />);

    await fillAndSubmit('   ', '1234567');

    expect(await screen.findByText(vi.passwordReset.reset.codeRequired)).toBeTruthy();
    expect(screen.getByText(vi.auth.validation.passwordLength)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pre-fills the code when opened from the link in the email', async () => {
    await renderWithProviders(<ResetPasswordScreen initialCode="abc123" />);

    expect(screen.getByTestId('reset-code').props.value).toBe('abc123');
  });

  it('resets with the trimmed code, does not sign in, then leads back to sign in', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));
    await renderWithProviders(<ResetPasswordScreen />);

    await fillAndSubmit('  abc123  ', 'fixture-new-pass-1');

    expect((await screen.findByTestId('reset-success')).props.children).toBe(vi.passwordReset.reset.success);
    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/password-reset\/confirm$/);
    expect(request.body).toEqual({ token: 'abc123', newPassword: 'fixture-new-pass-1' });
    expect(request.headers.Authorization).toBeUndefined();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();

    await fireEvent.press(screen.getByTestId('reset-go-login'));
    expect(router.dismissTo).toHaveBeenCalledWith('/login');
  });

  it('wrong code (404): error under the code field, inputs kept', async () => {
    mockFetch().mockResolvedValueOnce(problem(404, 'Not Found'));
    await renderWithProviders(<ResetPasswordScreen />);

    await fillAndSubmit('wrong-code', 'fixture-new-pass-1');

    expect((await screen.findByTestId('reset-code-error')).props.children).toBe(vi.passwordReset.reset.codeInvalid);
    expect(screen.getByTestId('reset-code').props.value).toBe('wrong-code');
    expect(screen.queryByTestId('reset-request-new')).toBeNull();
  });

  it('expired or used code (410): explains and offers to request a new code', async () => {
    mockFetch().mockResolvedValueOnce(problem(410, 'Gone'));
    await renderWithProviders(<ResetPasswordScreen />);

    await fillAndSubmit('old-code', 'fixture-new-pass-1');

    expect((await screen.findByTestId('reset-form-error')).props.children).toBe(vi.passwordReset.reset.codeExpired);
    await fireEvent.press(screen.getByTestId('reset-request-new'));
    expect(router.dismissTo).toHaveBeenCalledWith('/forgot-password');
  });

  it('shows 400 field errors under the matching inputs (server "token" = code field)', async () => {
    mockFetch().mockResolvedValueOnce(
      problem(400, 'Bad Request', {
        errors: [
          { field: 'token', message: 'Mã sai định dạng' },
          { field: 'newPassword', message: 'Mật khẩu quá dài' },
        ],
      }),
    );
    await renderWithProviders(<ResetPasswordScreen />);

    await fillAndSubmit('abc', 'fixture-new-pass-1');

    expect((await screen.findByTestId('reset-code-error')).props.children).toBe('Mã sai định dạng');
    expect(screen.getByTestId('reset-newPassword-error').props.children).toBe('Mật khẩu quá dài');
  });

  it('shows the shared "server unreachable" sentence on network errors', async () => {
    mockFetch().mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderWithProviders(<ResetPasswordScreen />);

    await fillAndSubmit('abc123', 'fixture-new-pass-1');

    expect((await screen.findByTestId('reset-form-error')).props.children).toBe(vi.errors.network);
  });
});
