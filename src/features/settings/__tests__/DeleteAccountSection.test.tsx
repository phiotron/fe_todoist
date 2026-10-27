import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../../api/errors';
import i18n, { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import type { RouteHandler } from '../../../test/m3Routes';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { DeleteAccountSection, describeDeleteError } from '../DeleteAccountSection';

function serveDelete(options: { twoFactor: boolean; remove?: RouteHandler }) {
  const fetchMock = mockFetch();
  serveSettings(fetchMock, {
    routes: {
      'GET /api/v1/me/2fa': () => jsonResponse(200, { enabled: options.twoFactor, recoveryCodesLeft: options.twoFactor ? 10 : 0 }),
      'DELETE /api/v1/me': options.remove ?? (() => jsonResponse(204)),
    },
  });
  return fetchMock;
}

async function openDialog(twoFactor: boolean) {
  await renderWithSettings(<DeleteAccountSection />);
  await fireEvent.press(await screen.findByTestId('delete-account-open'));
  if (twoFactor) await screen.findByTestId('delete-account-code');
}

describe('DeleteAccountSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('the dialog says it cannot be undone and asks for the password only when 2FA is off', async () => {
    serveDelete({ twoFactor: false });
    await openDialog(false);

    expect(screen.getByText(vi.settings.deleteAccount.confirmTitle)).toBeTruthy();
    expect(screen.getByText(vi.settings.deleteAccount.confirmMessage)).toBeTruthy();
    expect(screen.getByTestId('delete-account-password').props.secureTextEntry).toBe(true);
    expect(screen.queryByTestId('delete-account-code')).toBeNull();
  });

  it('with 2FA on it also asks for a code', async () => {
    serveDelete({ twoFactor: true });
    await openDialog(true);

    expect(screen.getByTestId('delete-account-code')).toBeTruthy();
  });

  it('checks the fields on the device first, without calling the server', async () => {
    const fetchMock = serveDelete({ twoFactor: true });
    await openDialog(true);

    await fireEvent.press(screen.getByTestId('delete-account-dialog-confirm'));
    expect((await screen.findByTestId('delete-account-dialog-error')).props.children).toBe(vi.auth.validation.passwordRequired);

    await fireEvent.changeText(screen.getByTestId('delete-account-password'), 'fixture-pass-1');
    await fireEvent.press(screen.getByTestId('delete-account-dialog-confirm'));
    expect((await screen.findByTestId('delete-account-dialog-error')).props.children).toBe(vi.settings.deleteAccount.codeRequired);

    expect(countRequests(fetchMock, '/api/v1/me')).toBe(0);
  });

  it('deletes the account with the password, then signs this device out without calling /auth/logout', async () => {
    const fetchMock = serveDelete({ twoFactor: false });
    await openDialog(false);

    await fireEvent.changeText(screen.getByTestId('delete-account-password'), 'fixture-pass-1');
    await fireEvent.press(screen.getByTestId('delete-account-dialog-confirm'));

    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBeNull());
    const deletes = fetchMock.mock.calls.map((_, index) => requestAt(fetchMock, index)).filter((r) => r.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].body).toEqual({ password: 'fixture-pass-1' });
    expect(countRequests(fetchMock, '/api/v1/auth/logout')).toBe(0);
  });

  it('with 2FA on the code is sent too', async () => {
    const fetchMock = serveDelete({ twoFactor: true });
    await openDialog(true);

    await fireEvent.changeText(screen.getByTestId('delete-account-password'), 'fixture-pass-1');
    await fireEvent.changeText(screen.getByTestId('delete-account-code'), ' 123456 ');
    await fireEvent.press(screen.getByTestId('delete-account-dialog-confirm'));

    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBeNull());
    const deletes = fetchMock.mock.calls.map((_, index) => requestAt(fetchMock, index)).filter((r) => r.method === 'DELETE');
    expect(deletes[0].body).toEqual({ password: 'fixture-pass-1', code: '123456' });
  });

  it('a wrong password or code (400) is explained in the dialog; nothing is lost and the user stays signed in', async () => {
    serveDelete({ twoFactor: false, remove: () => problem(400, 'Bad Request') });
    await openDialog(false);

    await fireEvent.changeText(screen.getByTestId('delete-account-password'), 'fixture-wrong-1');
    await fireEvent.press(screen.getByTestId('delete-account-dialog-confirm'));

    expect((await screen.findByTestId('delete-account-dialog-error')).props.children).toBe(
      vi.settings.deleteAccount.wrongCredentials,
    );
    expect(screen.getByTestId('delete-account-password').props.value).toBe('fixture-wrong-1');
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
  });

  it('an account without a password (409 password-required) is told to set one first', async () => {
    serveDelete({ twoFactor: false, remove: () => problem(409, 'Conflict', { code: 'password-required' }) });
    await openDialog(false);

    await fireEvent.changeText(screen.getByTestId('delete-account-password'), 'x-fixture-1');
    await fireEvent.press(screen.getByTestId('delete-account-dialog-confirm'));

    expect((await screen.findByTestId('delete-account-dialog-error')).props.children).toBe(
      vi.settings.deleteAccount.passwordRequired,
    );
  });

  it('Cancel closes the dialog without a request and forgets what was typed', async () => {
    const fetchMock = serveDelete({ twoFactor: false });
    await openDialog(false);
    await fireEvent.changeText(screen.getByTestId('delete-account-password'), 'fixture-pass-1');

    await fireEvent.press(screen.getByTestId('delete-account-dialog-cancel'));
    await fireEvent.press(screen.getByTestId('delete-account-open'));

    expect(screen.getByTestId('delete-account-password').props.value).toBe('');
    expect(countRequests(fetchMock, '/api/v1/me')).toBe(0);
  });
});

describe('describeDeleteError', () => {
  it('maps 409 password-required, 400, and falls back to the shared sentences', () => {
    expect(describeDeleteError(new ApiError({ status: 409, title: 'x', code: 'password-required' }))).toBe(
      i18n.t('settings.deleteAccount.passwordRequired'),
    );
    expect(describeDeleteError(new ApiError({ status: 400, title: 'x' }))).toBe(i18n.t('settings.deleteAccount.wrongCredentials'));
    expect(describeDeleteError(new TypeError('Network request failed'))).toBeTruthy();
  });
});
