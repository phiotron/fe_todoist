import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, problem, requestAt } from '../../test/http';
import { identitiesApi } from '../identities';

describe('identitiesApi', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('linkGoogle posts a fresh ID token with the bearer token and resolves on 204', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(identitiesApi.linkGoogle({ idToken: 'gid-1' })).resolves.toBeUndefined();

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/me\/identities\/google$/);
    expect(request.method).toBe('POST');
    expect(request.body).toEqual({ idToken: 'gid-1' });
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('linkGoogle rejects a bad or expired linkToken with the 400, without refreshing', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(problem(400, 'Bad Request'));

    await expect(identitiesApi.linkGoogle({ linkToken: 'lt-1' })).rejects.toMatchObject({ status: 400 });

    expect(requestAt(fetchMock, 0).body).toEqual({ linkToken: 'lt-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('unlinkGoogle sends DELETE with the bearer token', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(identitiesApi.unlinkGoogle()).resolves.toBeUndefined();

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/me\/identities\/google$/);
    expect(request.method).toBe('DELETE');
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('unlinkGoogle rejects with the 409 password-required when the account has no password yet', async () => {
    mockFetch().mockResolvedValueOnce(problem(409, 'Conflict', { code: 'password-required', detail: 'Set a password first' }));

    await expect(identitiesApi.unlinkGoogle()).rejects.toMatchObject({ status: 409, code: 'password-required' });
  });
});
