import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../../../api/auth';
import { apiFetch } from '../../../api/client';
import { queryPersister } from '../../../lib/queryClient';
import { tokenStore } from '../../../lib/tokenStore';
import { deferred } from '../../../test/deferred';
import { authResponse, testUser } from '../../../test/fixtures';
import { countRequests, jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { meQueryKey, useMe, useSession } from '../session';

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

  it('falls back to signed out when SecureStore cannot be read at startup', async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('keystore unavailable'));
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.expired).toBe(false);
  });

  it('signIn drops the previous user cache (memory and persisted) before caching the new user', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse(200, authResponse('acc-2', 'ref-2')));
    const { result, queryClient } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    queryClient.setQueryData(['tasks'], [{ id: 'previous-user-task' }]);

    await act(async () => {
      await result.current.signIn({ email: testUser.email, password: 'fixture-pass-1' });
    });

    expect(queryClient.getQueryData(['tasks'])).toBeUndefined();
    expect(queryClient.getQueryData(meQueryKey)).toEqual(testUser);
    expect(removeClientSpy).toHaveBeenCalledTimes(1);
  });

  it('signIn rejects and stays signed out without storing tokens when the server answers 401', async () => {
    mockFetch().mockResolvedValue(problem(401, 'Unauthorized'));
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await expect(
        result.current.signIn({ email: testUser.email, password: 'fixture-wrong-1' }),
      ).rejects.toMatchObject({ status: 401 });
    });

    expect(result.current.status).toBe('signedOut');
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('signUp calls the register endpoint, stores tokens and clears a previous expired flag', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(problem(401, 'Unauthorized'));
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    await act(async () => {
      await expect(authApi.me()).rejects.toMatchObject({ status: 401 });
    });
    expect(result.current.expired).toBe(true);
    expect(result.current.status).toBe('signedOut');

    fetchMock.mockResolvedValueOnce(jsonResponse(200, authResponse('acc-2', 'ref-2')));
    await act(async () => {
      await result.current.signUp({
        email: testUser.email,
        password: 'fixture-pass-1',
        displayName: testUser.displayName,
      });
    });

    const registerCall = fetchMock.mock.calls.length - 1;
    expect(requestAt(fetchMock, registerCall).url).toMatch(/\/api\/v1\/auth\/register$/);
    expect(result.current.status).toBe('signedIn');
    expect(result.current.expired).toBe(false);
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-2');
    await expect(tokenStore.getRefreshToken()).resolves.toBe('ref-2');
  });

  it('signOut still ends signed out with caches cleared when clearing local tokens throws', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    mockFetch().mockResolvedValueOnce(jsonResponse(204));
    const clearSpy = jest.spyOn(tokenStore, 'clear').mockRejectedValueOnce(new Error('keystore failure'));
    try {
      const { result, queryClient } = await renderSession();
      await waitFor(() => expect(result.current.status).toBe('signedIn'));
      queryClient.setQueryData(meQueryKey, testUser);

      await act(async () => {
        await expect(result.current.signOut()).rejects.toThrow('keystore failure');
      });

      expect(result.current.status).toBe('signedOut');
      expect(queryClient.getQueryData(meQueryKey)).toBeUndefined();
      expect(removeClientSpy).toHaveBeenCalled();
    } finally {
      clearSpy.mockRestore();
    }
  });
  it('starts a new API session epoch before storing the tokens of a sign-in', async () => {
    const order: string[] = [];
    const resetSpy = jest.spyOn(apiFetch, 'resetSession').mockImplementation(async () => {
      order.push('reset');
    });
    const realSet = tokenStore.setTokens;
    const setSpy = jest.spyOn(tokenStore, 'setTokens').mockImplementation(async (pair) => {
      order.push('setTokens');
      await realSet(pair);
    });
    try {
      mockFetch().mockResolvedValueOnce(jsonResponse(200, authResponse()));
      const { result } = await renderSession();
      await waitFor(() => expect(result.current.status).toBe('signedOut'));

      await act(async () => {
        await result.current.signIn({ email: testUser.email, password: 'fixture-pass-1' });
      });

      expect(order).toEqual(['reset', 'setTokens']);
    } finally {
      resetSpy.mockRestore();
      setSpy.mockRestore();
    }
  });

  it('closes the API session epoch before clearing tokens on sign-out', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const order: string[] = [];
    const resetSpy = jest.spyOn(apiFetch, 'resetSession').mockImplementation(async () => {
      order.push('reset');
    });
    const realClear = tokenStore.clear;
    const clearSpy = jest.spyOn(tokenStore, 'clear').mockImplementation(async () => {
      order.push('clear');
      await realClear();
    });
    try {
      mockFetch().mockResolvedValueOnce(jsonResponse(204));
      const { result } = await renderSession();
      await waitFor(() => expect(result.current.status).toBe('signedIn'));

      await act(async () => {
        await result.current.signOut();
      });

      expect(order).toEqual(['reset', 'clear']);
      expect(result.current.status).toBe('signedOut');
    } finally {
      resetSpy.mockRestore();
      clearSpy.mockRestore();
    }
  });

  it('a slow startup token read never overrides a sign-in that finished first', async () => {
    const startupRead = deferred<string | null>();
    jest.mocked(SecureStore.getItemAsync).mockImplementationOnce(() => startupRead.promise);
    mockFetch().mockResolvedValueOnce(jsonResponse(200, authResponse()));
    const { result } = await renderSession();

    await act(async () => {
      await result.current.signIn({ email: testUser.email, password: 'fixture-pass-1' });
    });
    expect(result.current.status).toBe('signedIn');

    await act(async () => {
      startupRead.resolve(null);
    });
    expect(result.current.status).toBe('signedIn');
  });
});

describe('useMe', () => {
  beforeEach(async () => {
    await tokenStore.clear();
  });

  async function renderMe() {
    const queryClient = createTestQueryClient();
    const hook = await renderHook(() => ({ session: useSession(), me: useMe() }), {
      wrapper: createWrapper(queryClient),
    });
    return { queryClient, ...hook };
  }

  it('does not call /me while signed out', async () => {
    const fetchMock = mockFetch();
    const { result } = await renderMe();
    await waitFor(() => expect(result.current.session.status).toBe('signedOut'));

    expect(result.current.me.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs out once with expired=true when /me gets 401 and the refresh is rejected (no refetch loop)', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(problem(401, 'Unauthorized'));
    const { result } = await renderMe();

    await waitFor(() => expect(result.current.session.status).toBe('signedOut'));
    expect(result.current.session.expired).toBe(true);
    // Give any (unwanted) refetch a chance to happen before counting.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(countRequests(fetchMock, '/api/v1/me')).toBe(1);
    expect(countRequests(fetchMock, '/api/v1/auth/refresh')).toBe(1);
    expect(result.current.me.fetchStatus).toBe('idle');
  });
});
