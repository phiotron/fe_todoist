import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { authorizedAppsApi, type AuthorizedAppResponse } from '../authorizedApps';
import { notificationPrefsApi, type NotificationPrefsResponse } from '../notificationPrefs';
import { oauthApi } from '../oauth';
import { pushTokensApi } from '../pushTokens';
import { queryKeys } from '../queryKeys';

const PREFS: NotificationPrefsResponse = {
  reminderPush: false,
  reminderEmail: false,
  morningOverview: false,
  eveningReview: false,
  subscribedEmails: true,
};

describe('M13c API modules', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('notificationPrefsApi.get reads me/notification-prefs', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, PREFS));

    await expect(notificationPrefsApi.get()).resolves.toEqual(PREFS);

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('GET');
    expect(request.url).toMatch(/\/api\/v1\/me\/notification-prefs$/);
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('notificationPrefsApi.update PATCHes only the changed fields and returns the full prefs', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...PREFS, morningOverview: true }));

    await expect(notificationPrefsApi.update({ morningOverview: true })).resolves.toMatchObject({ morningOverview: true });

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('PATCH');
    expect(request.url).toMatch(/\/api\/v1\/me\/notification-prefs$/);
    expect(request.body).toEqual({ morningOverview: true });
  });

  it('authorizedAppsApi lists the apps and revokes one by client id (encoded)', async () => {
    const app: AuthorizedAppResponse = {
      clientId: 'cli/1',
      name: 'Sync tool',
      scopes: ['data:read'],
      authorizedAt: '2026-10-20T08:00:00Z',
      lastUsedAt: null,
    };
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [app])).mockResolvedValueOnce(jsonResponse(204));

    await expect(authorizedAppsApi.list()).resolves.toEqual([app]);
    await expect(authorizedAppsApi.revoke('cli/1')).resolves.toBeUndefined();

    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/me\/authorized-apps$/);
    expect(requestAt(fetchMock, 1).method).toBe('DELETE');
    expect(requestAt(fetchMock, 1).url).toMatch(/\/api\/v1\/me\/authorized-apps\/cli%2F1$/);
  });

  it('oauthApi.preview sends clientId, redirectUri and scope as query parameters', async () => {
    const fetchMock = mockFetch();
    const preview = { clientId: 'c1', appName: 'App', redirectUri: 'https://x.test/cb', scopes: ['data:read'] };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, preview));

    await expect(
      oauthApi.preview({ clientId: 'c1', redirectUri: 'https://x.test/cb?a=1', scope: 'data:read,task:add' }),
    ).resolves.toEqual(preview);

    const url = new URL(requestAt(fetchMock, 0).url);
    expect(url.pathname).toBe('/api/v1/oauth/authorize/preview');
    expect(url.searchParams.get('clientId')).toBe('c1');
    expect(url.searchParams.get('redirectUri')).toBe('https://x.test/cb?a=1');
    expect(url.searchParams.get('scope')).toBe('data:read,task:add');
  });

  it('oauthApi.authorize POSTs the consent and returns the redirect URL', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { redirectUrl: 'https://x.test/cb?code=abc&state=s' }));
    const body = {
      clientId: 'c1',
      redirectUri: 'https://x.test/cb',
      scope: 'data:read',
      state: 's',
      codeChallenge: 'a'.repeat(43),
      codeChallengeMethod: 'S256' as const,
    };

    await expect(oauthApi.authorize(body)).resolves.toEqual({ redirectUrl: 'https://x.test/cb?code=abc&state=s' });

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/api\/v1\/oauth\/authorize$/);
    expect(request.body).toEqual(body);
  });

  it('pushTokensApi registers, unregisters and sends a test push', async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(204))
      .mockResolvedValueOnce(jsonResponse(204))
      .mockResolvedValueOnce(jsonResponse(202, { devices: 2 }));

    await expect(pushTokensApi.register({ token: 'tok', platform: 'ANDROID' })).resolves.toBeUndefined();
    await expect(pushTokensApi.unregister({ token: 'tok' })).resolves.toBeUndefined();
    await expect(pushTokensApi.test()).resolves.toEqual({ devices: 2 });

    expect(requestAt(fetchMock, 0)).toMatchObject({ method: 'POST', body: { token: 'tok', platform: 'ANDROID' } });
    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/me\/push-tokens$/);
    expect(requestAt(fetchMock, 1)).toMatchObject({ method: 'POST', body: { token: 'tok' } });
    expect(requestAt(fetchMock, 1).url).toMatch(/\/api\/v1\/me\/push-tokens\/unregister$/);
    expect(requestAt(fetchMock, 2).method).toBe('POST');
    expect(requestAt(fetchMock, 2).url).toMatch(/\/api\/v1\/me\/push-tokens\/test$/);
  });

  it('query keys for the M13c screens', () => {
    expect(queryKeys.notificationPrefs.all).toEqual(['notificationPrefs']);
    expect(queryKeys.authorizedApps.all).toEqual(['authorizedApps']);
    expect(queryKeys.oauthPreview({ clientId: 'c', redirectUri: 'r', scope: 's' })).toEqual([
      'oauthPreview',
      { clientId: 'c', redirectUri: 'r', scope: 's' },
    ]);
  });
});
