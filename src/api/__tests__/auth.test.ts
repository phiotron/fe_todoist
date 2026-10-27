import { tokenStore } from '../../lib/tokenStore';
import { authResponse, testUser } from '../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../test/http';
import { authApi } from '../auth';
import { addSessionExpiredListener } from '../client';
import { ApiError } from '../errors';

describe('authApi', () => {
  // Every subscription goes through subscribe() so afterEach removes it even when a test fails.
  const unsubscribers: Array<() => void> = [];
  const subscribe = (listener: () => void) => {
    const unsubscribe = addSessionExpiredListener(listener);
    unsubscribers.push(unsubscribe);
    return unsubscribe;
  };

  beforeEach(async () => {
    await tokenStore.clear();
  });

  afterEach(() => {
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  });

  it('login posts credentials without a bearer token, even when one is stored', async () => {
    await tokenStore.setTokens({ accessToken: 'old', refreshToken: 'old-ref' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, authResponse()));

    await expect(authApi.login({ email: 'an@example.com', password: 'fixture-pass-1' })).resolves.toEqual(
      authResponse(),
    );

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(request.method).toBe('POST');
    expect(request.body).toEqual({ email: 'an@example.com', password: 'fixture-pass-1' });
    expect(request.headers.Authorization).toBeUndefined();
  });

  it('register posts email, password and displayName', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(201, authResponse()));

    await authApi.register({ email: 'an@example.com', password: 'fixture-pass-1', displayName: 'An' });

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/register$/);
    expect(request.body).toEqual({ email: 'an@example.com', password: 'fixture-pass-1', displayName: 'An' });
    expect(request.headers.Authorization).toBeUndefined();
  });

  it('me sends the stored access token', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, testUser));

    await expect(authApi.me()).resolves.toEqual(testUser);

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/me$/);
    expect(request.method).toBe('GET');
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('logout reads the stored refresh token and posts it with the bearer token', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(authApi.logout()).resolves.toBeUndefined();

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/logout$/);
    expect(request.body).toEqual({ refreshToken: 'ref-1' });
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('logout after an expired access token revokes the ROTATED refresh token, not the old one', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/api/v1/auth/refresh')) {
        return jsonResponse(200, { accessToken: 'acc-2', refreshToken: 'ref-2', accessTokenExpiresIn: 900 });
      }
      const headers = (init?.headers ?? {}) as Record<string, string>;
      return headers.Authorization === 'Bearer acc-2' ? jsonResponse(204) : problem(401, 'Unauthorized');
    });

    await authApi.logout();

    const logoutBodies = fetchMock.mock.calls
      .map((_, index) => requestAt(fetchMock, index))
      .filter((request) => request.url.endsWith('/api/v1/auth/logout'))
      .map((request) => request.body);
    expect(logoutBodies).toEqual([{ refreshToken: 'ref-1' }, { refreshToken: 'ref-2' }]);
  });

  it('notifies session-expired listeners when the refresh token is rejected', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    mockFetch().mockResolvedValue(problem(401, 'Unauthorized'));
    const listener = jest.fn();
    const removed = jest.fn();
    subscribe(listener);
    subscribe(removed)();

    await expect(authApi.me()).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
  });

  it.each([
    ['login', () => authApi.login({ email: 'an@example.com', password: 'fixture-pass-1' })],
    ['register', () => authApi.register({ email: 'an@example.com', password: 'fixture-pass-1', displayName: 'An' })],
  ])('%s 401 is a plain ApiError: no refresh, no session expiry, tokens untouched', async (_name, call) => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(problem(401, 'Bad credentials'));
    const listener = jest.fn();
    subscribe(listener);

    await expect(call()).rejects.toMatchObject({ status: 401, title: 'Bad credentials' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(0);
    expect(requestAt(fetchMock, 0).headers.Authorization).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
  });

  it('isolates session-expired listeners: a throwing one blocks neither the others nor the 401', async () => {
    mockFetch().mockResolvedValue(problem(401, 'Unauthorized'));
    const bad = jest.fn(() => {
      throw new Error('listener bug');
    });
    const good = jest.fn();
    subscribe(bad);
    subscribe(good);

    const error = await authApi.me().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });
});
