import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { authResponse } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { deferred, type RouteHandler } from '../../../test/m3Routes';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { PasswordSection } from '../PasswordSection';

function servePassword(handler: RouteHandler) {
  const passwordBodies: unknown[] = [];
  serveSettings(mockFetch(), {
    routes: {
      'POST /api/v1/me/password': (request) => {
        passwordBodies.push(request.body);
        return handler(request);
      },
    },
  });
  return { passwordBodies };
}

async function fillAndSubmit(currentPassword: string, newPassword: string) {
  await fireEvent.changeText(await screen.findByTestId('password-current'), currentPassword);
  await fireEvent.changeText(screen.getByTestId('password-new'), newPassword);
  await fireEvent.press(screen.getByTestId('password-submit'));
}

describe('PasswordSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('checks both fields on the device first', async () => {
    const { passwordBodies } = servePassword(() => jsonResponse(200, authResponse('acc-2', 'ref-2')));
    await renderWithSettings(<PasswordSection />);

    await fillAndSubmit('', '1234567');

    expect(screen.getByTestId('password-current-error').props.children).toBe(vi.auth.validation.passwordRequired);
    expect(screen.getByTestId('password-new-error').props.children).toBe(vi.auth.validation.passwordLength);
    expect(passwordBodies).toEqual([]);
  });

  it('changes the password, keeps this device signed in with the new token pair and clears the fields', async () => {
    const { passwordBodies } = servePassword(() => jsonResponse(200, authResponse('acc-2', 'ref-2')));
    await renderWithSettings(<PasswordSection />);

    await fillAndSubmit('fixture-pass-1', 'fixture-new-pass-1');

    expect((await screen.findByTestId('password-success')).props.children).toBe(vi.settings.password.success);
    expect(passwordBodies).toEqual([{ currentPassword: 'fixture-pass-1', newPassword: 'fixture-new-pass-1' }]);
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-2');
    await expect(tokenStore.getRefreshToken()).resolves.toBe('ref-2');
    expect(screen.getByTestId('password-current').props.value).toBe('');
    expect(screen.getByTestId('password-new').props.value).toBe('');
  });

  it('wrong current password (400 with only a detail): error under the current-password field, tokens untouched', async () => {
    servePassword(() => problem(400, 'Bad Request', { detail: 'Mật khẩu hiện tại không đúng' }));
    await renderWithSettings(<PasswordSection />);

    await fillAndSubmit('fixture-wrong-1', 'fixture-new-pass-1');

    expect((await screen.findByTestId('password-current-error')).props.children).toBe(vi.settings.password.wrongCurrent);
    expect(screen.getByTestId('password-new').props.value).toBe('fixture-new-pass-1');
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
  });

  it('shows the server field messages when the 400 names the fields', async () => {
    servePassword(() =>
      problem(400, 'Bad Request', { errors: [{ field: 'newPassword', message: 'Mật khẩu phải từ 8 đến 72 ký tự' }] }),
    );
    await renderWithSettings(<PasswordSection />);

    await fillAndSubmit('fixture-pass-1', 'fixture-new-pass-1');

    expect((await screen.findByTestId('password-new-error')).props.children).toBe('Mật khẩu phải từ 8 đến 72 ký tự');
  });

  it('shows the shared "server unreachable" sentence on network errors', async () => {
    servePassword(() => {
      throw new TypeError('Network request failed');
    });
    await renderWithSettings(<PasswordSection />);

    await fillAndSubmit('fixture-pass-1', 'fixture-new-pass-1');

    await waitFor(() => expect(screen.getByTestId('password-error').props.children).toBe(vi.errors.network));
  });

  it('sends a single request when submit is pressed twice quickly', async () => {
    const answer = deferred<Response>();
    const { passwordBodies } = servePassword(() => answer.promise);
    await renderWithSettings(<PasswordSection />);
    await fireEvent.changeText(await screen.findByTestId('password-current'), 'fixture-pass-1');
    await fireEvent.changeText(screen.getByTestId('password-new'), 'fixture-new-pass-1');

    const button = screen.getByTestId('password-submit');
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
    });
    await act(async () => {
      answer.resolve(jsonResponse(200, authResponse('acc-2', 'ref-2')));
    });

    expect(await screen.findByTestId('password-success')).toBeTruthy();
    expect(passwordBodies).toHaveLength(1);
  });
});
