import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { MeResponse } from '../../../api/auth';
import { viTranslation as vi } from '../../../i18n';
import { setExternalBrowser } from '../../../lib/externalBrowser';
import { tokenStore } from '../../../lib/tokenStore';
import { FakeExternalBrowser } from '../../../test/fakeExternalBrowser';
import { testMe } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { routeFetch } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { forgetSocialFlow } from '../../social/socialFlow';
import { SocialLinkSection } from '../SocialLinkSection';

jest.mock('../../../lib/socialConfig', () => ({
  SOCIAL_CONFIG: {
    appleServiceId: 'svc.taskly',
    appleRedirectUri: 'https://api.example.com/apple',
    facebookAppId: null,
    facebookRedirectUri: null,
  },
}));

/** testMe with M13b providers; the generated type still lists GOOGLE only until types.gen.ts is rebuilt. */
function meWith(providers: string[], overrides: Partial<MeResponse> = {}): MeResponse {
  return testMe({ linkedProviders: providers as unknown as MeResponse['linkedProviders'], ...overrides });
}

function serve(me: () => MeResponse, extra: Parameters<typeof routeFetch>[1] = {}) {
  const fetchMock = mockFetch();
  routeFetch(fetchMock, { 'GET /api/v1/me': () => jsonResponse(200, me()), ...extra });
  return fetchMock;
}

describe('SocialLinkSection', () => {
  let browser: FakeExternalBrowser;

  beforeEach(async () => {
    browser = new FakeExternalBrowser();
    setExternalBrowser(browser);
    forgetSocialFlow();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  afterEach(() => {
    setExternalBrowser(null);
    forgetSocialFlow();
  });

  it('shows "not linked" and opens the Apple page when linking', async () => {
    serve(() => meWith([]));
    await renderWithProviders(<SocialLinkSection provider="APPLE" />);
    expect(await screen.findByText(vi.social.settings.notLinked)).toBeTruthy();
    expect(screen.getByTestId('settings-section-apple')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('settings-apple-link'));

    await waitFor(() => expect(browser.opened).toHaveLength(1));
    expect(new URL(browser.opened[0]).host).toBe('appleid.apple.com');
    expect((await screen.findByTestId('settings-apple-message')).props.children).toBe(vi.social.settings.opening);
  });

  it('says "not configured" for Facebook when the build has no app id', async () => {
    serve(() => meWith([]));
    await renderWithProviders(<SocialLinkSection provider="FACEBOOK" />);
    await screen.findByText(vi.social.settings.notLinked);

    await fireEvent.press(screen.getByTestId('settings-facebook-link'));

    expect((await screen.findByTestId('settings-facebook-message')).props.children).toBe(
      'Bản ứng dụng này chưa được cấu hình đăng nhập Facebook',
    );
    expect(browser.opened).toEqual([]);
  });

  it('unlinks when the account has a password and refreshes the status', async () => {
    let me = meWith(['APPLE']);
    const fetchMock = serve(() => me, {
      'DELETE /api/v1/me/identities/apple': () => {
        me = meWith([]);
        return jsonResponse(204);
      },
    });
    await renderWithProviders(<SocialLinkSection provider="APPLE" />);
    await screen.findByText('Đã liên kết với Apple');

    await fireEvent.press(screen.getByTestId('settings-apple-unlink'));

    expect(await screen.findByText(vi.social.settings.notLinked)).toBeTruthy();
    expect(screen.getByTestId('settings-apple-message').props.children).toBe('Đã bỏ liên kết Apple');
    const index = fetchMock.mock.calls.findIndex(([input]) => String(input).endsWith('/me/identities/apple'));
    expect(requestAt(fetchMock, index).method).toBe('DELETE');
  });

  it('points at "Forgot your password?" and disables unlinking when there is no password', async () => {
    const fetchMock = serve(() => meWith(['FACEBOOK'], { hasPassword: false }));
    await renderWithProviders(<SocialLinkSection provider="FACEBOOK" />);
    await screen.findByText('Đã liên kết với Facebook');

    expect(screen.getByTestId('settings-facebook-need-password')).toBeTruthy();
    expect(screen.getByTestId('settings-facebook-unlink').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('settings-facebook-unlink'));
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/me/identities/facebook'))).toBe(false);
  });

  it('shows "set a password first" when the server refuses the unlink with 409 password-required', async () => {
    serve(() => meWith(['APPLE']), {
      'DELETE /api/v1/me/identities/apple': () => problem(409, 'Conflict', { code: 'password-required' }),
    });
    await renderWithProviders(<SocialLinkSection provider="APPLE" />);
    await screen.findByText('Đã liên kết với Apple');

    await fireEvent.press(screen.getByTestId('settings-apple-unlink'));

    expect((await screen.findByTestId('settings-apple-message')).props.children).toContain('Quên mật khẩu?');
  });

  it('treats 404 (already unlinked elsewhere) as unlinked', async () => {
    let me = meWith(['APPLE']);
    serve(() => me, {
      'DELETE /api/v1/me/identities/apple': () => {
        me = meWith([]);
        return problem(404, 'Not Found');
      },
    });
    await renderWithProviders(<SocialLinkSection provider="APPLE" />);
    await screen.findByText('Đã liên kết với Apple');

    await fireEvent.press(screen.getByTestId('settings-apple-unlink'));

    expect(await screen.findByText(vi.social.settings.notLinked)).toBeTruthy();
  });
});
