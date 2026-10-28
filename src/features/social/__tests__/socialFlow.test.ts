import { setExternalBrowser } from '../../../lib/externalBrowser';
import type { SocialConfig } from '../../../lib/socialConfig';
import { FakeExternalBrowser } from '../../../test/fakeExternalBrowser';
import { authorizationUrl, beginSocialFlow, forgetSocialFlow, providerFromRoute, takeSocialResult } from '../socialFlow';

const CONFIG: SocialConfig = {
  appleServiceId: 'test.taskly.service',
  appleRedirectUri: 'https://api.example.com/api/v1/auth/apple/callback',
  facebookAppId: '123456',
  facebookRedirectUri: 'https://api.example.com/api/v1/auth/facebook/callback',
};

describe('authorizationUrl', () => {
  it('builds the Apple web flow url (form_post, name + email scopes, state)', () => {
    const url = new URL(authorizationUrl('APPLE', CONFIG, 'st-1') ?? '');

    expect(url.origin + url.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code id_token',
      response_mode: 'form_post',
      client_id: 'test.taskly.service',
      redirect_uri: CONFIG.appleRedirectUri,
      scope: 'name email',
      state: 'st-1',
    });
  });

  it('builds the Facebook login dialog url', () => {
    const url = new URL(authorizationUrl('FACEBOOK', CONFIG, 'st-2') ?? '');

    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v19.0/dialog/oauth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: '123456',
      redirect_uri: CONFIG.facebookRedirectUri,
      state: 'st-2',
      response_type: 'code',
      scope: 'email',
    });
  });

  it('returns null while the build has no ids', () => {
    const empty: SocialConfig = { appleServiceId: null, appleRedirectUri: null, facebookAppId: null, facebookRedirectUri: null };
    expect(authorizationUrl('APPLE', empty, 's')).toBeNull();
    expect(authorizationUrl('FACEBOOK', empty, 's')).toBeNull();
    expect(authorizationUrl('APPLE', { ...CONFIG, appleRedirectUri: null }, 's')).toBeNull();
  });
});

describe('beginSocialFlow / takeSocialResult', () => {
  let browser: FakeExternalBrowser;

  beforeEach(() => {
    browser = new FakeExternalBrowser();
    setExternalBrowser(browser);
    forgetSocialFlow();
  });

  afterEach(() => {
    setExternalBrowser(null);
    forgetSocialFlow();
  });

  it('opens the page and accepts the matching deep link once', async () => {
    await expect(beginSocialFlow('APPLE', 'signIn', CONFIG)).resolves.toBe('opened');
    const state = browser.lastState();

    const result = takeSocialResult('APPLE', { state, idToken: 'apple-jwt', name: ' Lan Nguyễn ' });

    expect(result).toEqual({ type: 'success', provider: 'APPLE', purpose: 'signIn', token: 'apple-jwt', name: 'Lan Nguyễn' });
    // Single use: the same link again is refused.
    expect(takeSocialResult('APPLE', { state, idToken: 'apple-jwt' })).toEqual({ type: 'error', reason: 'stateMismatch' });
  });

  it('Facebook hands over an accessToken and remembers the purpose', async () => {
    await beginSocialFlow('FACEBOOK', 'link', CONFIG);

    expect(takeSocialResult('FACEBOOK', { state: browser.lastState(), accessToken: 'fb-token' })).toEqual({
      type: 'success',
      provider: 'FACEBOOK',
      purpose: 'link',
      token: 'fb-token',
      name: null,
    });
  });

  it('refuses a wrong, missing or foreign state and a link nobody asked for', async () => {
    expect(takeSocialResult('APPLE', { state: 'x', idToken: 'jwt' })).toEqual({ type: 'error', reason: 'stateMismatch' });

    await beginSocialFlow('APPLE', 'signIn', CONFIG);
    expect(takeSocialResult('APPLE', { state: 'forged', idToken: 'jwt' })).toEqual({ type: 'error', reason: 'stateMismatch' });

    await beginSocialFlow('APPLE', 'signIn', CONFIG);
    expect(takeSocialResult('APPLE', { idToken: 'jwt' })).toEqual({ type: 'error', reason: 'stateMismatch' });

    await beginSocialFlow('APPLE', 'signIn', CONFIG);
    expect(takeSocialResult('FACEBOOK', { state: browser.lastState(), accessToken: 't' })).toEqual({
      type: 'error',
      reason: 'stateMismatch',
    });
  });

  it('maps a cancelled / failed provider answer and a missing token', async () => {
    await beginSocialFlow('APPLE', 'link', CONFIG);
    expect(takeSocialResult('APPLE', { state: browser.lastState(), error: 'cancelled' })).toEqual({
      type: 'cancelled',
      purpose: 'link',
    });

    await beginSocialFlow('APPLE', 'signIn', CONFIG);
    expect(takeSocialResult('APPLE', { state: browser.lastState(), error: 'failed' })).toEqual({ type: 'error', reason: 'failed' });

    await beginSocialFlow('FACEBOOK', 'signIn', CONFIG);
    expect(takeSocialResult('FACEBOOK', { state: browser.lastState() })).toEqual({ type: 'error', reason: 'failed' });
  });

  it('opens nothing without configuration and reports a browser that cannot open', async () => {
    const empty: SocialConfig = { appleServiceId: null, appleRedirectUri: null, facebookAppId: null, facebookRedirectUri: null };
    await expect(beginSocialFlow('APPLE', 'signIn', empty)).resolves.toBe('notConfigured');
    expect(browser.opened).toEqual([]);

    browser.failNext();
    await expect(beginSocialFlow('FACEBOOK', 'signIn', CONFIG)).resolves.toBe('failed');
    expect(takeSocialResult('FACEBOOK', { state: 'any', accessToken: 't' })).toEqual({ type: 'error', reason: 'stateMismatch' });
  });

  it('a new flow replaces the pending one', async () => {
    await beginSocialFlow('APPLE', 'signIn', CONFIG);
    const first = browser.lastState();
    await beginSocialFlow('APPLE', 'signIn', CONFIG);

    expect(takeSocialResult('APPLE', { state: first, idToken: 'jwt' })).toEqual({ type: 'error', reason: 'stateMismatch' });
  });
});

describe('providerFromRoute', () => {
  it('maps the route segment', () => {
    expect(providerFromRoute('apple')).toBe('APPLE');
    expect(providerFromRoute('facebook')).toBe('FACEBOOK');
    expect(providerFromRoute('google')).toBeNull();
    expect(providerFromRoute(undefined)).toBeNull();
  });
});
