import { memoryTokenStore } from '../../test/memoryTokenStore';
import { jsonResponse, mockFetch, problem } from '../../test/http';
import { REFRESH_PATH, createApiClient } from '../client';
import { COMMENT_MAX_LENGTH, UPLOAD_TIMEOUT_MS, commentsApi, toFormData } from '../comments';
import { avatarApi } from '../avatar';
import { notificationsApi, notificationsPath } from '../notifications';
import { tokenStore } from '../../lib/tokenStore';

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

function formFile() {
  return toFormData({ uri: 'file:///cache/a.txt', name: 'a.txt', type: 'text/plain' });
}

describe('apiFetch — multipart upload (M8b)', () => {
  it('sends the FormData as is, without a JSON Content-Type, with the Bearer token', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'a-1' }));
    const form = formFile();

    await api('/api/v1/attachments', { method: 'POST', formData: form });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(init?.body).toBe(form);
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer acc-1');
  });

  it('retries the same FormData after a token refresh', async () => {
    const { api, fetchMock } = setup();
    const form = formFile();
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith(REFRESH_PATH)) {
        return jsonResponse(200, { accessToken: 'acc-2', refreshToken: 'ref-2', accessTokenExpiresIn: 900 });
      }
      const headers = (init?.headers ?? {}) as Record<string, string>;
      return headers.Authorization === 'Bearer acc-2' ? jsonResponse(201, { id: 'a-1' }) : problem(401, 'Unauthorized');
    });

    await api('/api/v1/attachments', { method: 'POST', formData: form });

    const uploads = fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/attachments'));
    expect(uploads).toHaveLength(2);
    expect(uploads[1][1]?.body).toBe(form);
  });

  describe('timeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('a per-request timeout beats the client default', async () => {
      const { api, fetchMock } = setup(1000);
      fetchMock.mockImplementation(
        (_input, init) =>
          new Promise<Response>((resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
            setTimeout(() => resolve(jsonResponse(201, { id: 'a-1' })), 5000);
          }),
      );

      const pending = api('/api/v1/attachments', { method: 'POST', formData: formFile(), timeoutMs: 60_000 });
      await jest.advanceTimersByTimeAsync(5000);

      await expect(pending).resolves.toEqual({ id: 'a-1' });
    });
  });
});

describe('M8b endpoints', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('calls the comment endpoints with the right method, path and body', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async () => jsonResponse(200, []));
    const task = { kind: 'task', id: 't 1' } as const;
    const project = { kind: 'project', id: 'p-1' } as const;

    await commentsApi.list(task);
    await commentsApi.create(project, { id: 'c-1', content: 'Xin chào', mentionUserIds: ['u-1'] }, 'key-1');
    await commentsApi.remove('c-1');
    await commentsApi.mentionable(task);
    await commentsApi.addReaction('c-1', '👍');
    await commentsApi.removeReaction('c-1', '👍');
    await commentsApi.link('a-1');

    const calls = fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${String(input).replace(/^https?:\/\/[^/]+/, '')}`);
    expect(calls).toEqual([
      'GET /api/v1/tasks/t%201/comments',
      'POST /api/v1/projects/p-1/comments',
      'DELETE /api/v1/comments/c-1',
      'GET /api/v1/tasks/t%201/comments/mentionable',
      'POST /api/v1/comments/c-1/reactions',
      `DELETE /api/v1/comments/c-1/reactions?emoji=${encodeURIComponent('👍')}`,
      'GET /api/v1/attachments/a-1/link',
    ]);
    const create = fetchMock.mock.calls[1][1];
    expect(JSON.parse(String(create?.body))).toEqual({ id: 'c-1', content: 'Xin chào', mentionUserIds: ['u-1'] });
    expect((create?.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
    expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body))).toEqual({ emoji: '👍' });
  });

  it('uploads a comment file and an avatar as multipart', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async () => jsonResponse(200, {}));
    const file = { uri: 'file:///cache/a.png', name: 'a.png', type: 'image/png' };

    await commentsApi.upload(file);
    await avatarApi.upload(file);
    await avatarApi.remove();

    expect(fetchMock.mock.calls.map(([input, init]) => `${init?.method} ${String(input).replace(/^https?:\/\/[^/]+/, '')}`)).toEqual([
      'POST /api/v1/attachments',
      'POST /api/v1/me/avatar',
      'DELETE /api/v1/me/avatar',
    ]);
    expect(fetchMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
    expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(FormData);
    expect(UPLOAD_TIMEOUT_MS).toBeGreaterThan(60_000);
    expect(COMMENT_MAX_LENGTH).toBe(15_000);
  });

  it('calls the notification endpoints', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async () => jsonResponse(200, { items: [], nextCursor: null, count: 0 }));

    await notificationsApi.list(true, 'c-1');
    await notificationsApi.unreadCount();
    await notificationsApi.markRead('n 1');
    await notificationsApi.markAllRead();
    await notificationsApi.settings();
    await notificationsApi.updateSettings([{ scope: 'PROJECT', event: 'COMMENT_MENTION', enabled: false }]);

    expect(fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${String(input).replace(/^https?:\/\/[^/]+/, '')}`)).toEqual([
      'GET /api/v1/notifications?unread=true&cursor=c-1',
      'GET /api/v1/notifications/unread-count',
      'POST /api/v1/notifications/n%201/read',
      'POST /api/v1/notifications/read-all',
      'GET /api/v1/me/notification-settings',
      'PUT /api/v1/me/notification-settings',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[5][1]?.body))).toEqual({
      items: [{ scope: 'PROJECT', event: 'COMMENT_MENTION', enabled: false }],
    });
  });

  it('builds the notification list path with unread and cursor only when set', () => {
    expect(notificationsPath(false, null)).toBe('/api/v1/notifications');
    expect(notificationsPath(true, null)).toBe('/api/v1/notifications?unread=true');
    expect(notificationsPath(true, 'c 1')).toBe('/api/v1/notifications?unread=true&cursor=c%201');
  });
});
