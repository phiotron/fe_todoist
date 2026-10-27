import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, problem, requestAt } from '../../test/http';
import {
  REMINDER_FETCH_LIMIT,
  fetchTaskState,
  fetchUpcomingReminders,
  remindersApi,
  toCreateRequest,
} from '../reminders';

describe('remindersApi', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('GETs /api/v1/tasks/reminders?limit=50 with the bearer token', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    await remindersApi.upcoming();

    const request = requestAt(fetchMock, 0);
    expect(REMINDER_FETCH_LIMIT).toBe(50);
    expect(request.method).toBe('GET');
    expect(request.url).toMatch(/\/api\/v1\/tasks\/reminders\?limit=50$/);
    expect(request.headers.Authorization).toBe('Bearer acc-1');
  });

  it('maps occurrences for the planner', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse(200, [
        { key: 'auto:t-1', taskId: 't-1', reminderId: null, kind: 'AUTO', fireAt: '2026-10-23T11:30:00', content: 'Họp nhóm' },
      ]),
    );

    expect(await fetchUpcomingReminders()).toEqual([
      { key: 'auto:t-1', taskId: 't-1', kind: 'AUTO', fireAt: '2026-10-23T11:30:00', content: 'Họp nhóm' },
    ]);
  });

  it('lists the reminders of a task', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    await remindersApi.list('t-1');

    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/tasks\/t-1\/reminders$/);
  });

  it('creates a reminder with an Idempotency-Key', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { id: 'r-1', taskId: 't-1', type: 'RELATIVE', at: null, minuteOffset: 30, createdAt: '2026-10-23T03:00:00Z' }),
    );

    await remindersApi.create('t-1', { type: 'RELATIVE', minuteOffset: 30 }, 'key-1');

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('POST');
    expect(request.url).toMatch(/\/api\/v1\/tasks\/t-1\/reminders$/);
    expect(request.body).toEqual({ type: 'RELATIVE', minuteOffset: 30 });
    expect(request.headers['Idempotency-Key']).toBe('key-1');
  });

  it('deletes a reminder', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await remindersApi.remove('t-1', 'r-1');

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('DELETE');
    expect(request.url).toMatch(/\/api\/v1\/tasks\/t-1\/reminders\/r-1$/);
  });

  it('tells whether a snoozed task still needs its reminder', async () => {
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: 't-1', completedAt: null }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 't-1', completedAt: '2026-10-23T03:00:00Z' }))
      .mockResolvedValueOnce(problem(404, 'Not Found'))
      .mockResolvedValueOnce(problem(500, 'Internal Server Error'));

    expect(await fetchTaskState('t-1')).toBe('open');
    expect(await fetchTaskState('t-1')).toBe('gone');
    expect(await fetchTaskState('t-1')).toBe('gone');
    await expect(fetchTaskState('t-1')).rejects.toBeDefined();
  });

  it('turns a draft into the POST body', () => {
    expect(toCreateRequest({ type: 'ABSOLUTE', at: '2026-10-24T09:00' })).toEqual({ type: 'ABSOLUTE', at: '2026-10-24T09:00' });
    expect(toCreateRequest({ type: 'RELATIVE', minuteOffset: 0 })).toEqual({ type: 'RELATIVE', minuteOffset: 0 });
  });
});
