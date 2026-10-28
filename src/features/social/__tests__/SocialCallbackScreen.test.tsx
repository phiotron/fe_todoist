import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { viTranslation as vi } from '../../../i18n';
import { setExternalBrowser } from '../../../lib/externalBrowser';
import type { SocialConfig } from '../../../lib/socialConfig';
import { tokenStore } from '../../../lib/tokenStore';
import { FakeExternalBrowser } from '../../../test/fakeExternalBrowser';
import { authResponse, testMe } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem, requestAt, type FetchMock } from '../../../test/http';
import { routeFetch, type RouteHandler } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { SocialCallbackScreen } from '../SocialCallbackScreen';
import { beginSocialFlow, forgetSocialFlow, type SocialPurpose } from '../socialFlow';
import type { SocialProvider } from '../../../api/identities';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));

const CONFIG: SocialConfig = {
  appleServiceId: 'svc',
  appleRedirectUri: 'https://api.example.com/apple',
  facebookAppId: '1',
  facebookRedirectUri: 'https://api.example.com/facebook',
};

function serve(routes: Record<string, RouteHandler>): FetchMock {
  const fetchMock = mockFetch();
  routeFetch(fetchMock, { 'GET /api/v1/me': () => jsonResponse(200, testMe()), ...routes });
  return fetchMock;
}

function requestTo(fetchMock: FetchMock, path: string) {
  const index = fetchMock.mock.calls.findIndex(([input]) => String(input).endsWith(path));
  expect(index).toBeGreaterThanOrEqual(0);
  return requestAt(fetchMock, index);
}

describe('SocialCallbackScreen', () => {
  let browser: FakeExternalBrowser;
  let alertSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    browser = new FakeExternalBrowser();
    setExternalBrowser(browser);
    forgetSocialFlow();
    await tokenStore.clear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    setExternalBrowser(null);
    forgetSocialFlow();
  });

  async function start(provider: SocialProvider, purpose: SocialPurpose) {
    await beginSocialFlow(provider, purpose, CONFIG);
    return browser.lastState();
  }

  it('Apple sign-in: sends the idToken and the name, then goes home', async () => {
    const state = await start('APPLE', 'signIn');
    const fetchMock = serve({ 'POST /api/v1/auth/apple': () => jsonResponse(200, authResponse()) });

    await renderWithProviders(
      <SocialCallbackScreen provider="APPLE" params={{ state, idToken: 'apple-jwt', name: 'Lan Nguyễn' }} />,
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(requestTo(fetchMock, '/api/v1/auth/apple').body).toEqual({ idToken: 'apple-jwt', displayName: 'Lan Nguyễn' });
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
  });

  it('Facebook sign-in sends the accessToken', async () => {
    const state = await start('FACEBOOK', 'signIn');
    const fetchMock = serve({ 'POST /api/v1/auth/facebook': () => jsonResponse(200, authResponse()) });

    await renderWithProviders(<SocialCallbackScreen provider="FACEBOOK" params={{ state, accessToken: 'fb-token' }} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(requestTo(fetchMock, '/api/v1/auth/facebook').body).toEqual({ accessToken: 'fb-token' });
  });

  it('409 link-required goes to the login screen and keeps the link in memory', async () => {
    const state = await start('APPLE', 'signIn');
    serve({
      'POST /api/v1/auth/apple': () => problem(409, 'Conflict', { code: 'link-required', linkToken: 'lt-1' }),
    });

    await renderWithProviders(<SocialCallbackScreen provider="APPLE" params={{ state, idToken: 'jwt' }} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
  });

  it('401 two-factor-required opens the code screen', async () => {
    const state = await start('FACEBOOK', 'signIn');
    serve({
      'POST /api/v1/auth/facebook': () =>
        problem(401, 'Unauthorized', { code: 'two-factor-required', twoFactorToken: 'tf-1' }),
    });

    await renderWithProviders(<SocialCallbackScreen provider="FACEBOOK" params={{ state, accessToken: 't' }} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/two-factor'));
  });

  it('shows a message and a way back when the server refuses the token (401)', async () => {
    const state = await start('APPLE', 'signIn');
    serve({ 'POST /api/v1/auth/apple': () => problem(401, 'Unauthorized') });

    await renderWithProviders(<SocialCallbackScreen provider="APPLE" params={{ state, idToken: 'bad' }} />);

    expect(await screen.findByText('Đăng nhập Apple không thành công, vui lòng thử lại')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('social-callback-back'));
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('link purpose: links with the token, refreshes the account and returns to Account', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const state = await start('APPLE', 'link');
    const fetchMock = serve({ 'POST /api/v1/me/identities/apple': () => jsonResponse(204) });

    await renderWithProviders(<SocialCallbackScreen provider="APPLE" params={{ state, idToken: 'jwt' }} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/settings/account'));
    const post = requestTo(fetchMock, '/me/identities/apple');
    expect(post.body).toEqual({ idToken: 'jwt' });
    expect(post.headers.Authorization).toBe('Bearer acc-1');
    expect(alertSpy).toHaveBeenCalledWith('Đã liên kết Apple', 'Từ lần sau bạn có thể đăng nhập bằng Apple.');
  });

  it('link purpose: a conflict (409) is explained and offers the way back to Account', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const state = await start('FACEBOOK', 'link');
    serve({ 'POST /api/v1/me/identities/facebook': () => problem(409, 'Conflict') });

    await renderWithProviders(<SocialCallbackScreen provider="FACEBOOK" params={{ state, accessToken: 't' }} />);

    expect(await screen.findByText(vi.social.errors.linkConflict.replaceAll('{{provider}}', 'Facebook'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('social-callback-back'));
    expect(router.replace).toHaveBeenCalledWith('/settings/account');
  });

  it('cancelled at the provider changes nothing and sends nothing', async () => {
    const state = await start('APPLE', 'link');
    const fetchMock = serve({});

    await renderWithProviders(<SocialCallbackScreen provider="APPLE" params={{ state, error: 'cancelled' }} />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/settings/account'));
    expect(fetchMock.mock.calls.filter(([input]) => !String(input).endsWith('/api/v1/me'))).toEqual([]);
  });

  it('sends nothing when the state is not one this app generated (restart, forged link)', async () => {
    const fetchMock = serve({});

    await renderWithProviders(<SocialCallbackScreen provider="APPLE" params={{ state: 'forged', idToken: 'jwt' }} />);

    expect(await screen.findByText(vi.social.errors.stateMismatch.replaceAll('{{provider}}', 'Apple'))).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([input]) => /auth\/apple|identities/.test(String(input)))).toEqual([]);
    await fireEvent.press(screen.getByTestId('social-callback-back'));
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('shows the provider error as a failure', async () => {
    const state = await start('FACEBOOK', 'signIn');
    serve({});

    await renderWithProviders(<SocialCallbackScreen provider="FACEBOOK" params={{ state, error: 'failed' }} />);

    expect(await screen.findByText('Đăng nhập Facebook không thành công, vui lòng thử lại')).toBeTruthy();
  });
});
