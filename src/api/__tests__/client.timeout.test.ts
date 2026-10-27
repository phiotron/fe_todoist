import { memoryTokenStore } from '../../test/memoryTokenStore';
import { jsonResponse, mockFetch, type FetchMock } from '../../test/http';
import { DEFAULT_TIMEOUT_MS, createApiClient } from '../client';
import { NetworkError, TimeoutError } from '../errors';

function setup(timeoutMs?: number) {
  const fetchMock = mockFetch();
  const api = createApiClient({
    baseUrl: 'http://api.test',
    tokens: memoryTokenStore({ accessToken: 'acc-1', refreshToken: 'ref-1' }),
    onSessionExpired: jest.fn(),
    timeoutMs,
  });
  return { api, fetchMock };
}

/** fetch that never answers on its own, like a dead connection; it only rejects when aborted. */
function hang(fetchMock: FetchMock) {
  fetchMock.mockImplementation(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      }),
  );
}

describe('apiFetch — timeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('gives up after 15 seconds by default with a TimeoutError (a NetworkError)', async () => {
    const { api, fetchMock } = setup();
    hang(fetchMock);

    const pending = api('/api/v1/auth/register', { method: 'POST', body: {}, auth: false }).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    const error = await pending;
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toBeInstanceOf(NetworkError);
    expect(DEFAULT_TIMEOUT_MS).toBe(15_000);
  });

  it('passes an abort signal to fetch and clears the timer when the answer arrives in time', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await expect(api('/api/v1/me')).resolves.toEqual({ ok: true });

    expect(fetchMock.mock.calls[0][1]?.signal).toBeDefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses a custom timeout when configured', async () => {
    const { api, fetchMock } = setup(2_000);
    hang(fetchMock);

    const pending = api('/api/v1/me').catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toBeInstanceOf(TimeoutError);
  });

  it('a plain network failure is still a NetworkError, not a timeout', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = await api('/api/v1/me').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).not.toBeInstanceOf(TimeoutError);
  });
});
