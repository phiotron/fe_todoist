import i18n from '../../i18n';
import { tokenStore } from '../../lib/tokenStore';
import { memoryTokenStore } from '../../test/memoryTokenStore';
import { jsonResponse, mockFetch, problem, requestAt } from '../../test/http';
import { apiFetch, createApiClient } from '../client';

function client(language?: () => string | null | undefined) {
  return createApiClient({
    baseUrl: 'http://api.test',
    tokens: memoryTokenStore({ accessToken: 'acc-1', refreshToken: 'ref-1' }),
    onSessionExpired: jest.fn(),
    language,
  });
}

describe('apiFetch — Accept-Language', () => {
  afterEach(async () => {
    await i18n.changeLanguage('vi');
  });

  it('sends the configured language on authenticated and public requests', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const api = client(() => 'en');

    await api('/api/v1/me');
    await api('/api/v1/auth/login', { method: 'POST', body: {}, auth: false });

    expect(requestAt(fetchMock, 0).headers['Accept-Language']).toBe('en');
    expect(requestAt(fetchMock, 1).headers['Accept-Language']).toBe('en');
  });

  it('also sends it on the refresh call and on the retried request', async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(problem(401, 'Unauthorized'))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'acc-2', refreshToken: 'ref-2', accessTokenExpiresIn: 900 }))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await client(() => 'en')('/api/v1/me');

    expect([0, 1, 2].map((index) => requestAt(fetchMock, index).headers['Accept-Language'])).toEqual(['en', 'en', 'en']);
  });

  it('omits the header when no language is configured or it is empty', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await client()('/api/v1/me');
    await client(() => '')('/api/v1/me');

    expect(requestAt(fetchMock, 0).headers['Accept-Language']).toBeUndefined();
    expect(requestAt(fetchMock, 1).headers['Accept-Language']).toBeUndefined();
  });

  it('the app-wide apiFetch follows the current i18n language', async () => {
    await tokenStore.clear();
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await apiFetch('/api/v1/auth/login', { method: 'POST', body: {}, auth: false });
    await i18n.changeLanguage('en');
    await apiFetch('/api/v1/auth/login', { method: 'POST', body: {}, auth: false });

    expect(requestAt(fetchMock, 0).headers['Accept-Language']).toBe('vi');
    expect(requestAt(fetchMock, 1).headers['Accept-Language']).toBe('en');
  });
});
