import { memoryTokenStore } from '../../test/memoryTokenStore';
import { countRequests, jsonResponse, mockFetch, problem, requestAt, type FetchMock } from '../../test/http';
import { REFRESH_PATH, createApiClient } from '../client';
import { ApiError, NetworkError } from '../errors';

const BASE_URL = 'http://api.test';

function setup(tokens = memoryTokenStore({ accessToken: 'acc-1', refreshToken: 'ref-1' })) {
  const fetchMock = mockFetch();
  const onSessionExpired = jest.fn();
  const api = createApiClient({ baseUrl: BASE_URL, tokens, onSessionExpired });
  return { api, fetchMock, tokens, onSessionExpired };
}

const rotated = () =>
  jsonResponse(200, {
    accessToken: 'acc-2',
    refreshToken: 'ref-2',
    accessTokenExpiresIn: 900,
    user: { id: 'u1', email: 'an@example.com', displayName: 'An', locale: 'vi', timeZone: 'Asia/Ho_Chi_Minh' },
  });

/** Refresh endpoint answers with `refresh()`; other endpoints accept only `Bearer <acceptedToken>`. */
function routeFetch(fetchMock: FetchMock, refresh: () => Response | Error, acceptedToken = 'acc-2') {
  fetchMock.mockImplementation(async (input, init) => {
    if (String(input).endsWith(REFRESH_PATH)) {
      const outcome = refresh();
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }
    const headers = (init?.headers ?? {}) as Record<string, string>;
    return headers.Authorization === `Bearer ${acceptedToken}`
      ? jsonResponse(200, { ok: true })
      : problem(401, 'Unauthorized');
  });
}

describe('apiFetch — 401 & refresh', () => {
  it('refreshes once, stores the new pair and retries with the new access token', async () => {
    const { api, fetchMock, tokens, onSessionExpired } = setup();
    routeFetch(fetchMock, rotated);

    await expect(api('/api/v1/me')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(countRequests(fetchMock, REFRESH_PATH)).toBe(1);
    const refreshRequest = requestAt(fetchMock, 1);
    expect(refreshRequest.method).toBe('POST');
    expect(refreshRequest.body).toEqual({ refreshToken: 'ref-1' });
    expect(refreshRequest.headers.Authorization).toBeUndefined();
    expect(requestAt(fetchMock, 2).headers.Authorization).toBe('Bearer acc-2');
    await expect(tokens.getAccessToken()).resolves.toBe('acc-2');
    await expect(tokens.getRefreshToken()).resolves.toBe('ref-2');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('shares one refresh between concurrent 401 responses', async () => {
    const { api, fetchMock } = setup();
    routeFetch(fetchMock, rotated);

    const results = await Promise.all([api('/api/v1/a'), api('/api/v1/b'), api('/api/v1/c')]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(countRequests(fetchMock, REFRESH_PATH)).toBe(1);
  });

  it('clears tokens and reports session expiry when the refresh token is rejected', async () => {
    const { api, fetchMock, tokens, onSessionExpired } = setup();
    routeFetch(fetchMock, () => problem(401, 'Unauthorized'));

    const error = await api('/api/v1/me').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
    expect(countRequests(fetchMock, REFRESH_PATH)).toBe(1);
    await expect(tokens.getAccessToken()).resolves.toBeNull();
    await expect(tokens.getRefreshToken()).resolves.toBeNull();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('expires the session without calling refresh when no refresh token is stored', async () => {
    const { api, fetchMock, onSessionExpired } = setup(memoryTokenStore({ accessToken: 'acc-1' }));
    routeFetch(fetchMock, rotated);

    await expect(api('/api/v1/me')).rejects.toMatchObject({ status: 401 });

    expect(countRequests(fetchMock, REFRESH_PATH)).toBe(0);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('never refreshes for auth:false requests (wrong password on login)', async () => {
    const { api, fetchMock, tokens, onSessionExpired } = setup();
    fetchMock.mockResolvedValueOnce(problem(401, 'Unauthorized', { detail: 'Bad credentials' }));

    await expect(
      api('/api/v1/auth/login', { method: 'POST', body: {}, auth: false }),
    ).rejects.toMatchObject({ status: 401, title: 'Unauthorized' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(tokens.getAccessToken()).resolves.toBe('acc-1');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('expires the session when the retried request is still 401', async () => {
    const { api, fetchMock, onSessionExpired } = setup();
    routeFetch(fetchMock, rotated, 'never-accepted');

    await expect(api('/api/v1/me')).rejects.toMatchObject({ status: 401 });

    expect(countRequests(fetchMock, REFRESH_PATH)).toBe(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('keeps tokens and throws NetworkError when refresh cannot reach the server', async () => {
    const { api, fetchMock, tokens, onSessionExpired } = setup();
    routeFetch(fetchMock, () => new TypeError('Network request failed'));

    await expect(api('/api/v1/me')).rejects.toBeInstanceOf(NetworkError);

    await expect(tokens.getRefreshToken()).resolves.toBe('ref-1');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('keeps tokens and throws the server error when refresh fails with 5xx', async () => {
    const { api, fetchMock, tokens, onSessionExpired } = setup();
    routeFetch(fetchMock, () => problem(503, 'Service Unavailable'));

    await expect(api('/api/v1/me')).rejects.toMatchObject({ status: 503 });

    await expect(tokens.getRefreshToken()).resolves.toBe('ref-1');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('keeps tokens and throws ApiError when the refresh response lacks a token pair', async () => {
    const { api, fetchMock, tokens, onSessionExpired } = setup();
    routeFetch(fetchMock, () => jsonResponse(200, { unexpected: true }));

    await expect(api('/api/v1/me')).rejects.toMatchObject({ status: 200, title: 'Invalid response body' });

    await expect(tokens.getRefreshToken()).resolves.toBe('ref-1');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});
