import { tokenStore } from '../../lib/tokenStore';
import { authResponse, testUser } from '../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../test/http';
import { accountApi } from '../account';
import { passwordResetApi } from '../passwordReset';

describe('accountApi', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('updateProfile PATCHes /me with the display name', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...testUser, displayName: 'Bình' }));

    await expect(accountApi.updateProfile({ displayName: 'Bình' })).resolves.toMatchObject({ displayName: 'Bình' });

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('PATCH');
    expect(request.url).toMatch(/\/api\/v1\/me$/);
    expect(request.body).toEqual({ displayName: 'Bình' });
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('changePassword POSTs both passwords to /me/password and returns the new token pair', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, authResponse('acc-2', 'ref-2')));

    await expect(
      accountApi.changePassword({ currentPassword: 'fixture-pass-1', newPassword: 'fixture-new-pass-1' }),
    ).resolves.toMatchObject({ accessToken: 'acc-2', refreshToken: 'ref-2' });

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/api\/v1\/me\/password$/);
    expect(request.body).toEqual({ currentPassword: 'fixture-pass-1', newPassword: 'fixture-new-pass-1' });
  });

  it('a wrong current password (400) is a plain ApiError: no refresh, tokens untouched', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(problem(400, 'Bad Request'));

    await expect(
      accountApi.changePassword({ currentPassword: 'fixture-wrong-1', newPassword: 'fixture-new-pass-1' }),
    ).rejects.toMatchObject({ status: 400 });

    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(0);
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
  });

  it('logoutAll POSTs /me/logout-all with the bearer token', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(accountApi.logoutAll()).resolves.toBeUndefined();

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/api\/v1\/me\/logout-all$/);
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('deleteAccount sends DELETE /me with the password and the optional code', async () => {
    const fetchMock = mockFetch();
    // A fresh Response per call: a body can be read only once.
    fetchMock.mockImplementation(async () => jsonResponse(204));

    await accountApi.deleteAccount({ password: 'fixture-pass-1' });
    await accountApi.deleteAccount({ password: 'fixture-pass-1', code: '123456' });

    expect(requestAt(fetchMock, 0).method).toBe('DELETE');
    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/me$/);
    expect(requestAt(fetchMock, 0).body).toEqual({ password: 'fixture-pass-1' });
    expect(requestAt(fetchMock, 1).body).toEqual({ password: 'fixture-pass-1', code: '123456' });
  });
});

describe('passwordResetApi', () => {
  beforeEach(async () => {
    // A stored session must never be attached to the public reset endpoints.
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('request posts the email without a bearer token', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await passwordResetApi.request({ email: 'an@example.com' });

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/api\/v1\/auth\/password-reset\/request$/);
    expect(request.body).toEqual({ email: 'an@example.com' });
    expect(request.headers.Authorization).toBeUndefined();
  });

  it('confirm posts the token and the new password without a bearer token', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(passwordResetApi.confirm({ token: 'abc123', newPassword: 'fixture-new-pass-1' })).resolves.toBeUndefined();

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/password-reset\/confirm$/);
    expect(request.body).toEqual({ token: 'abc123', newPassword: 'fixture-new-pass-1' });
    expect(request.headers.Authorization).toBeUndefined();
  });

  it.each([404, 410, 503])('passes %s through as ApiError without refreshing', async (status) => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(problem(status, 'x'));

    await expect(passwordResetApi.confirm({ token: 't', newPassword: 'fixture-new-pass-1' })).rejects.toMatchObject({
      status,
    });
    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(0);
  });
});
