import { tokenStore } from '../../lib/tokenStore';
import { authResponse } from '../../test/fixtures';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { identitiesApi, linkedProvidersOf, socialAuthApi } from '../identities';

describe('social identities api (M13b)', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('signs in with Apple (idToken + optional displayName) without a Bearer header', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, authResponse()));

    await socialAuthApi.signIn('APPLE', { token: 'jwt', displayName: 'Lan' });
    await socialAuthApi.signIn('APPLE', { token: 'jwt2' });

    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/auth\/apple$/);
    expect(requestAt(fetchMock, 0).body).toEqual({ idToken: 'jwt', displayName: 'Lan' });
    expect(requestAt(fetchMock, 0).headers.Authorization).toBeUndefined();
    expect(requestAt(fetchMock, 1).body).toEqual({ idToken: 'jwt2' });
  });

  it('signs in with Facebook (accessToken)', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, authResponse()));

    await socialAuthApi.signIn('FACEBOOK', { token: 'fb' });

    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/auth\/facebook$/);
    expect(requestAt(fetchMock, 0).body).toEqual({ accessToken: 'fb' });
  });

  it('links with the right field per provider or with a linkToken, and unlinks', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(204));

    await identitiesApi.linkSocial('APPLE', { token: 'jwt' });
    await identitiesApi.linkSocial('FACEBOOK', { token: 'fb' });
    await identitiesApi.linkSocial('APPLE', { linkToken: 'lt' });
    await identitiesApi.unlinkSocial('FACEBOOK');

    expect(requestAt(fetchMock, 0)).toMatchObject({ method: 'POST', body: { idToken: 'jwt' } });
    expect(requestAt(fetchMock, 0).url).toMatch(/\/me\/identities\/apple$/);
    expect(requestAt(fetchMock, 1).body).toEqual({ accessToken: 'fb' });
    expect(requestAt(fetchMock, 1).url).toMatch(/\/me\/identities\/facebook$/);
    expect(requestAt(fetchMock, 2).body).toEqual({ linkToken: 'lt' });
    expect(requestAt(fetchMock, 3)).toMatchObject({ method: 'DELETE' });
    expect(requestAt(fetchMock, 3).url).toMatch(/\/me\/identities\/facebook$/);
    expect(requestAt(fetchMock, 0).headers.Authorization).toBe('Bearer acc-1');
  });

  it('reads the linked providers and ignores unknown ones', () => {
    expect(linkedProvidersOf({ linkedProviders: ['GOOGLE', 'APPLE', 'FACEBOOK', 'TWITTER'] })).toEqual([
      'GOOGLE',
      'APPLE',
      'FACEBOOK',
    ]);
    expect(linkedProvidersOf({})).toEqual([]);
  });
});
