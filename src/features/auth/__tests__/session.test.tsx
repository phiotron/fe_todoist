import { act, renderHook, waitFor } from '@testing-library/react-native';
import { authApi } from '../../../api/auth';
import { queryPersister } from '../../../lib/queryClient';
import { tokenStore } from '../../../lib/tokenStore';
import { authResponse, testUser } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { meQueryKey, useSession } from '../session';

async function renderSession() {
  const queryClient = createTestQueryClient();
  const hook = await renderHook(() => useSession(), { wrapper: createWrapper(queryClient) });
  return { queryClient, ...hook };
}

describe('SessionProvider', () => {
  let removeClientSpy: jest.SpyInstance;

  beforeEach(async () => {
    await tokenStore.clear();
    removeClientSpy = jest.spyOn(queryPersister, 'removeClient');
  });

  afterEach(() => {
    removeClientSpy.mockRestore();
  });

  it('starts signed out when no token is stored', async () => {
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.expired).toBe(false);
  });

  it('starts signed in when an access token is stored (app reopened)', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
  });

  it('signIn stores tokens, caches the user and marks the session signed in', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse(200, authResponse()));
    const { result, queryClient } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.signIn({ email: testUser.email, password: 'fixture-pass-1' });
    });

    expect(result.current.status).toBe('signedIn');
    expect(queryClient.getQueryData(meQueryKey)).toEqual(testUser);
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
    await expect(tokenStore.getRefreshToken()).resolves.toBe('ref-1');
  });

  it('signOut revokes the refresh token on the server and clears local tokens and caches', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));
    const { result, queryClient } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    queryClient.setQueryData(meQueryKey, testUser);

    await act(async () => {
      await result.current.signOut();
    });

    const request = requestAt(fetchMock, 0);
    expect(request.url).toMatch(/\/api\/v1\/auth\/logout$/);
    expect(request.body).toEqual({ refreshToken: 'ref-1' });
    expect(result.current.status).toBe('signedOut');
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    expect(queryClient.getQueryData(meQueryKey)).toBeUndefined();
    expect(removeClientSpy).toHaveBeenCalledTimes(1);
  });

  it('signOut still clears local tokens when the server is unreachable', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    mockFetch().mockRejectedValueOnce(new TypeError('Network request failed'));
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('signedOut');
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
  });

  it.each([
    ['401', () => problem(401, 'Unauthorized')],
    ['500', () => problem(500, 'Internal Server Error')],
  ])('signOut clears tokens and caches even when logout fails with %s', async (_label, failure) => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    // 401 on logout triggers one refresh attempt; keep failing so every request rejects.
    mockFetch().mockResolvedValue(failure());
    const { result, queryClient } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    queryClient.setQueryData(meQueryKey, testUser);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.expired).toBe(false);
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    expect(queryClient.getQueryData(meQueryKey)).toBeUndefined();
    // For 401 the failed refresh also fires the session-expired listener, so removeClient may run twice.
    expect(removeClientSpy).toHaveBeenCalled();
  });

  it('signOut still signs out when removing the persisted cache fails', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    mockFetch().mockResolvedValueOnce(jsonResponse(204));
    removeClientSpy.mockRejectedValueOnce(new Error('storage failure'));
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('signedOut');
  });

  it('goes back to signed out with expired=true and wipes caches when the refresh token is rejected', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(problem(401, 'Unauthorized'));
    const { result, queryClient } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    queryClient.setQueryData(meQueryKey, testUser);

    await act(async () => {
      await expect(authApi.me()).rejects.toMatchObject({ status: 401 });
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.expired).toBe(true);
    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(1);
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    expect(queryClient.getQueryData(meQueryKey)).toBeUndefined();
    expect(removeClientSpy).toHaveBeenCalledTimes(1);
  });
});
