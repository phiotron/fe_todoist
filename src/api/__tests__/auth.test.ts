import { tokenStore } from '../../lib/tokenStore';
import { authResponse, testUser } from '../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../test/http';
import { authApi } from '../auth';
import { addSessionExpiredListener } from '../client';
import { ApiError } from '../errors';

describe('authApi', () => {
  beforeEach(async () => {
    await tokenStore.clear();
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

  it('logout posts the refresh token with the bearer token and resolves on 204', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(authApi.logout('ref-1')).resolves.toBeUndefined();

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/logout$/);
    expect(request.body).toEqual({ refreshToken: 'ref-1' });
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('notifies session-expired listeners when the refresh token is rejected', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    mockFetch().mockResolvedValue(problem(401, 'Unauthorized'));
    const listener = jest.fn();
    const removed = jest.fn();
    const unsubscribe = addSessionExpiredListener(listener);
    addSessionExpiredListener(removed)();

    await expect(authApi.me()).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    unsubscribe();
  });

  it.each([
    ['login', () => authApi.login({ email: 'an@example.com', password: 'fixture-pass-1' })],
    ['register', () => authApi.register({ email: 'an@example.com', password: 'fixture-pass-1', displayName: 'An' })],
  ])('%s 401 is a plain ApiError: no refresh, no session expiry, tokens untouched', async (_name, call) => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(problem(401, 'Bad credentials'));
    const listener = jest.fn();
    const unsubscribe = addSessionExpiredListener(listener);

    await expect(call()).rejects.toMatchObject({ status: 401, title: 'Bad credentials' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(0);
    expect(requestAt(fetchMock, 0).headers.Authorization).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
    unsubscribe();
  });
});
