import { memoryTokenStore } from '../../test/memoryTokenStore';
import { jsonResponse, mockFetch, problem, requestAt, type FetchMock } from '../../test/http';
import { REFRESH_PATH, buildQuery, createApiClient } from '../client';

const BASE_URL = 'http://api.test';

function setup() {
  const tokens = memoryTokenStore({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  const fetchMock = mockFetch();
  const api = createApiClient({ baseUrl: BASE_URL, tokens, onSessionExpired: jest.fn() });
  return { api, tokens, fetchMock };
}

/** First call to any endpoint: 401; refresh rotates to acc-2/ref-2; then Bearer acc-2 is accepted. */
function expireOnceThenAccept(fetchMock: FetchMock) {
  fetchMock.mockImplementation(async (input, init) => {
    if (String(input).endsWith(REFRESH_PATH)) {
      return jsonResponse(200, { accessToken: 'acc-2', refreshToken: 'ref-2', accessTokenExpiresIn: 900 });
    }
    const headers = (init?.headers ?? {}) as Record<string, string>;
    return headers.Authorization === 'Bearer acc-2' ? jsonResponse(200, { ok: true }) : problem(401, 'Unauthorized');
  });
}

describe('apiFetch — request options', () => {
  it('sends the Idempotency-Key header when one is given, and none otherwise', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 't1' }));

    await api('/api/v1/tasks', { method: 'POST', body: { content: 'A' }, idempotencyKey: 'key-1' });
    await api('/api/v1/tasks/t1/close', { method: 'POST' });

    expect(requestAt(fetchMock, 0).headers['Idempotency-Key']).toBe('key-1');
    expect(requestAt(fetchMock, 1).headers['Idempotency-Key']).toBeUndefined();
  });

  it('keeps the same Idempotency-Key on the retry after a refresh', async () => {
    const { api, fetchMock } = setup();
    expireOnceThenAccept(fetchMock);

    await api('/api/v1/tasks', { method: 'POST', body: { content: 'A' }, idempotencyKey: 'key-1' });

    expect(requestAt(fetchMock, 0).headers['Idempotency-Key']).toBe('key-1');
    expect(requestAt(fetchMock, 2).headers['Idempotency-Key']).toBe('key-1');
  });

  it('builds the body with getBody right before every send, so the retry sees the rotated token', async () => {
    const { api, tokens, fetchMock } = setup();
    expireOnceThenAccept(fetchMock);

    await api('/api/v1/auth/logout', {
      method: 'POST',
      getBody: async () => ({ refreshToken: await tokens.getRefreshToken() }),
    });

    expect(requestAt(fetchMock, 0).body).toEqual({ refreshToken: 'ref-1' });
    expect(requestAt(fetchMock, 2).body).toEqual({ refreshToken: 'ref-2' });
    expect(requestAt(fetchMock, 2).headers['Content-Type']).toBe('application/json');
  });
});

describe('buildQuery', () => {
  it('skips undefined, null and empty values and encodes the rest', () => {
    expect(buildQuery({ view: 'today', cursor: undefined, projectId: null, q: '' })).toBe('?view=today');
    expect(buildQuery({ from: '2026-10-23', cursor: 'a b&c' })).toBe('?from=2026-10-23&cursor=a%20b%26c');
    expect(buildQuery({ archived: true, limit: 50 })).toBe('?archived=true&limit=50');
    expect(buildQuery({})).toBe('');
  });
});
