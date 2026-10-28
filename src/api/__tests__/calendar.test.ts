import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { calendarApi } from '../calendar';

describe('calendar api (M13b)', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('calls the status / connect / update / sync / disconnect endpoints', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await calendarApi.status();
    await calendarApi.connect('OUTLOOK');
    await calendarApi.update({ syncTasks: true });
    await calendarApi.sync();
    fetchMock.mockResolvedValue(jsonResponse(204));
    await calendarApi.disconnect();

    expect(requestAt(fetchMock, 0)).toMatchObject({ method: 'GET' });
    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/me\/calendar$/);
    expect(requestAt(fetchMock, 1)).toMatchObject({ method: 'POST', body: { provider: 'OUTLOOK' } });
    expect(requestAt(fetchMock, 1).url).toMatch(/\/api\/v1\/me\/calendar\/connect$/);
    expect(requestAt(fetchMock, 2)).toMatchObject({ method: 'PATCH', body: { syncTasks: true } });
    expect(requestAt(fetchMock, 3)).toMatchObject({ method: 'POST' });
    expect(requestAt(fetchMock, 3).url).toMatch(/\/me\/calendar\/sync$/);
    expect(requestAt(fetchMock, 4)).toMatchObject({ method: 'DELETE' });
    expect(requestAt(fetchMock, 0).headers.Authorization).toBe('Bearer acc-1');
  });

  it('asks for events by day range and for feeds with an optional project', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await calendarApi.events('2026-11-02', '2026-11-30');
    await calendarApi.feed();
    await calendarApi.feed('p-1');
    await calendarApi.resetFeed();

    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/calendar\/events\?from=2026-11-02&to=2026-11-30$/);
    expect(requestAt(fetchMock, 1)).toMatchObject({ method: 'POST', body: {} });
    expect(requestAt(fetchMock, 1).url).toMatch(/\/me\/calendar-feeds$/);
    expect(requestAt(fetchMock, 2).body).toEqual({ projectId: 'p-1' });
    expect(requestAt(fetchMock, 3).url).toMatch(/\/me\/calendar-feeds\/reset$/);
  });
});
