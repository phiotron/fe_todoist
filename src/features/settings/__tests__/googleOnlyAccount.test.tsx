import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { MeResponse } from '../../../api/auth';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { testMe } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, requestAt } from '../../../test/http';
import { routeFetch, type RouteHandler } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { DisableTwoFactor } from '../../two-factor/DisableTwoFactor';
import { DeleteAccountSection } from '../DeleteAccountSection';
import { PasswordSection } from '../PasswordSection';

const GOOGLE_ONLY = testMe({ hasPassword: false, linkedProviders: ['GOOGLE'] });
const WITH_PASSWORD = testMe();
const DISABLE_PATH = '/api/v1/me/2fa/disable';

/** GET me and GET me/2fa answer from `me`; `routes` adds the requests of the component under test. */
function serve(me: MeResponse, routes: Record<string, RouteHandler> = {}) {
  const fetchMock = mockFetch();
  routeFetch(fetchMock, {
    'GET /api/v1/me': () => jsonResponse(200, me),
    'GET /api/v1/me/2fa': () => jsonResponse(200, { enabled: true, recoveryCodesLeft: 10 }),
    ...routes,
  });
  return fetchMock;
}

describe('Google-only account (no password) in Settings > Account', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('delete account: explains how to set a password instead of asking for one, and disables the button', async () => {
    serve(GOOGLE_ONLY);
    await renderWithProviders(<DeleteAccountSection />);

    expect((await screen.findByTestId('delete-account-need-password')).props.children).toBe(
      vi.google.account.deleteNeedsPassword,
    );
    expect(screen.getByTestId('delete-account-open').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('delete account: an account with a password sees no hint and can open the dialog', async () => {
    serve(WITH_PASSWORD);
    await renderWithProviders(<DeleteAccountSection />);

    expect(await screen.findByTestId('delete-account-open')).toBeTruthy();
    expect(screen.queryByTestId('delete-account-need-password')).toBeNull();
    expect(screen.getByTestId('delete-account-open').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('change password: shows how to set a password instead of the form', async () => {
    serve(GOOGLE_ONLY);
    await renderWithProviders(<PasswordSection />);

    expect((await screen.findByTestId('password-need-reset')).props.children).toBe(vi.google.account.passwordNeedsReset);
    expect(screen.queryByTestId('password-current')).toBeNull();
    expect(screen.queryByTestId('password-submit')).toBeNull();
  });

  it('change password: an account with a password still sees the form', async () => {
    serve(WITH_PASSWORD);
    await renderWithProviders(<PasswordSection />);

    expect(await screen.findByTestId('password-current')).toBeTruthy();
    expect(screen.queryByTestId('password-need-reset')).toBeNull();
  });

  it('disable 2FA: asks only for the code and sends no password', async () => {
    const fetchMock = serve(GOOGLE_ONLY, { [`POST ${DISABLE_PATH}`]: () => jsonResponse(204) });
    const onDisabled = jest.fn();
    await renderWithProviders(<DisableTwoFactor onDisabled={onDisabled} />);

    await fireEvent.press(await screen.findByTestId('two-factor-disable-open'));
    // Until GET me answers the account is assumed to have a password: wait for the field to go away.
    await waitFor(() => expect(screen.queryByTestId('two-factor-disable-password')).toBeNull());
    await fireEvent.changeText(screen.getByTestId('two-factor-disable-code'), '123456');
    await fireEvent.press(screen.getByTestId('two-factor-disable-dialog-confirm'));

    await waitFor(() => expect(onDisabled).toHaveBeenCalledTimes(1));
    const index = fetchMock.mock.calls.findIndex(
      ([input, init]) => String(input).endsWith(DISABLE_PATH) && init?.method === 'POST',
    );
    expect(index).toBeGreaterThanOrEqual(0);
    expect(requestAt(fetchMock, index).body).toEqual({ code: '123456' });
  });

  it('disable 2FA: an account with a password still has to type it', async () => {
    const fetchMock = serve(WITH_PASSWORD, { [`POST ${DISABLE_PATH}`]: () => jsonResponse(204) });
    await renderWithProviders(<DisableTwoFactor onDisabled={jest.fn()} />);

    await fireEvent.press(await screen.findByTestId('two-factor-disable-open'));
    await fireEvent.changeText(screen.getByTestId('two-factor-disable-code'), '123456');
    await fireEvent.press(screen.getByTestId('two-factor-disable-dialog-confirm'));

    expect((await screen.findByTestId('two-factor-disable-dialog-error')).props.children).toBe(
      vi.auth.validation.passwordRequired,
    );
    expect(countRequests(fetchMock, DISABLE_PATH)).toBe(0);
  });
});
