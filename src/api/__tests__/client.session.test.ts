import { deferred, flushAsync } from '../../test/deferred';
import { jsonResponse, mockFetch, problem, type FetchMock } from '../../test/http';
import { memoryTokenStore } from '../../test/memoryTokenStore';
import type { TokenStore } from '../../lib/tokenStore';
import { REFRESH_PATH, SESSION_CHANGED, createApiClient } from '../client';

const BASE_URL = 'http://api.test';

function setup(tokens: TokenStore = memoryTokenStore({ accessToken: 'acc-1', refreshToken: 'ref-1' })) {
  const fetchMock = mockFetch();
  const onSessionExpired = jest.fn();
  const api = createApiClient({ baseUrl: BASE_URL, tokens, onSessionExpired });
  return { api, tokens, fetchMock, onSessionExpired };
}

const pair = (n: number) =>
  jsonResponse(200, { accessToken: `acc-${n}`, refreshToken: `ref-${n}`, accessTokenExpiresIn: 900 });

async function waitForCalls(fetchMock: FetchMock, count: number) {
  for (let i = 0; i < 50 && fetchMock.mock.calls.length < count; i += 1) await flushAsync(1);
  expect(fetchMock.mock.calls.length).toBe(count);
}

describe('apiFetch — session epoch', () => {
  it('drops a refresh result that arrives after the session was reset: signed-out tokens never come back', async () => {
    const { api, tokens, fetchMock, onSessionExpired } = setup();
    const refreshGate = deferred<Response>();
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith(REFRESH_PATH) ? refreshGate.promise : problem(401, 'Unauthorized'),
    );

    const pending = api('/api/v1/me').catch((error: unknown) => error);
    await waitForCalls(fetchMock, 2); // the request and its refresh are in flight
    await api.resetSession(); // what signOut does…
    await tokens.clear(); // …before clearing the tokens
    refreshGate.resolve(pair(2));

    await expect(pending).resolves.toMatchObject({ status: 401, title: SESSION_CHANGED });
    await expect(tokens.getAccessToken()).resolves.toBeNull();
    await expect(tokens.getRefreshToken()).resolves.toBeNull();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('never resends an old-session request with the new session token', async () => {
    const { api, tokens, fetchMock, onSessionExpired } = setup();
    const firstGate = deferred<Response>();
    fetchMock.mockImplementationOnce(() => firstGate.promise);

    const pending = api('/api/v1/tasks', { method: 'POST', body: { content: 'A' } }).catch((e: unknown) => e);
    await waitForCalls(fetchMock, 1);
    await api.resetSession(); // user B signs in
    await tokens.setTokens({ accessToken: 'acc-B', refreshToken: 'ref-B' });
    firstGate.resolve(problem(401, 'Unauthorized'));

    await expect(pending).resolves.toMatchObject({ status: 401, title: SESSION_CHANGED });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(tokens.getAccessToken()).resolves.toBe('acc-B');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('never clears the new session tokens when the old session refresh is rejected', async () => {
    const { api, tokens, fetchMock, onSessionExpired } = setup();
    const refreshGate = deferred<Response>();
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith(REFRESH_PATH) ? refreshGate.promise : problem(401, 'Unauthorized'),
    );

    const pending = api('/api/v1/me').catch((error: unknown) => error);
    await waitForCalls(fetchMock, 2);
    await api.resetSession();
    await tokens.setTokens({ accessToken: 'acc-B', refreshToken: 'ref-B' });
    refreshGate.resolve(problem(401, 'Unauthorized'));

    await expect(pending).resolves.toMatchObject({ title: SESSION_CHANGED });
    await expect(tokens.getAccessToken()).resolves.toBe('acc-B');
    await expect(tokens.getRefreshToken()).resolves.toBe('ref-B');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('resetSession waits for a token write already in progress', async () => {
    const base = memoryTokenStore({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const writeGate = deferred<void>();
    const setTokens = jest.fn(async (next: { accessToken: string; refreshToken: string }) => {
      await writeGate.promise;
      await base.setTokens(next);
    });
    const { api, fetchMock } = setup({ ...base, setTokens });
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith(REFRESH_PATH)) return pair(2);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      return headers.Authorization === 'Bearer acc-2' ? jsonResponse(200, { ok: true }) : problem(401, 'Unauthorized');
    });

    const pending = api('/api/v1/me').catch((error: unknown) => error);
    await waitForCalls(fetchMock, 2);
    await flushAsync();
    expect(setTokens).toHaveBeenCalledTimes(1);

    let resetDone = false;
    const resetting = api.resetSession().then(() => {
      resetDone = true;
    });
    await flushAsync();
    expect(resetDone).toBe(false);

    writeGate.resolve();
    await resetting;
    expect(resetDone).toBe(true);
    await expect(pending).resolves.toMatchObject({ title: SESSION_CHANGED });
  });

  it('treats a 429 on refresh as a temporary failure: the session and tokens are kept (review C4)', async () => {
    const { api, tokens, fetchMock, onSessionExpired } = setup();
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith(REFRESH_PATH) ? problem(429, 'Too Many Requests') : problem(401, 'Unauthorized'),
    );

    await expect(api('/api/v1/me')).rejects.toMatchObject({ status: 429 });

    expect(onSessionExpired).not.toHaveBeenCalled();
    await expect(tokens.getAccessToken()).resolves.toBe('acc-1');
    await expect(tokens.getRefreshToken()).resolves.toBe('ref-1');
  });

  it('a request started after resetSession refreshes on its own and succeeds', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith(REFRESH_PATH)) return pair(2);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      return headers.Authorization === 'Bearer acc-2' ? jsonResponse(200, { ok: true }) : problem(401, 'Unauthorized');
    });

    await api.resetSession();
    await expect(api('/api/v1/me')).resolves.toEqual({ ok: true });
  });
});
