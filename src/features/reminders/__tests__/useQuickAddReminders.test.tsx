import '../../../i18n';
import { act, renderHook } from '@testing-library/react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { requestsTo, routeApi } from '../../../test/apiRoutes';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { onReminderSyncRequested } from '../syncSignal';
import { useQuickAddReminders } from '../useQuickAddReminders';

const ABSOLUTE = { type: 'ABSOLUTE', at: '2040-01-15T09:00' } as const;
const RELATIVE = { type: 'RELATIVE', minuteOffset: 30 } as const;
const PATH = '/api/v1/tasks/t-9/reminders';
const created = (body: object) =>
  jsonResponse(201, { id: 'r-x', taskId: 't-9', at: null, minuteOffset: null, createdAt: '2026-10-23T03:00:00Z', ...body });

function setup(hasTime = true) {
  return renderHook(({ timed }: { timed: boolean }) => useQuickAddReminders(timed), { initialProps: { timed: hasTime } });
}

describe('useQuickAddReminders', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('adds each draft once and removes by id', async () => {
    const { result } = await setup();

    await act(async () => {
      result.current.add(ABSOLUTE);
      result.current.add(RELATIVE);
      result.current.add({ ...RELATIVE });
    });
    expect(result.current.drafts).toEqual([ABSOLUTE, RELATIVE]);

    await act(async () => {
      result.current.remove('RELATIVE:30');
    });
    expect(result.current.drafts).toEqual([ABSOLUTE]);
  });

  it('drops relative drafts while the due date has no time', async () => {
    const view = await setup(true);
    await act(async () => {
      view.result.current.add(ABSOLUTE);
      view.result.current.add(RELATIVE);
    });

    await view.rerender({ timed: false });

    expect(view.result.current.drafts).toEqual([ABSOLUTE]);
  });

  it('creates every draft for the new task, then clears them and asks for a sync', async () => {
    const fetchMock = mockFetch();
    routeApi(fetchMock, { [`POST ${PATH}`]: (request) => created(request.body as object) });
    const synced = jest.fn();
    const unsubscribe = onReminderSyncRequested(synced);
    try {
      const { result } = await setup();
      await act(async () => {
        result.current.add(ABSOLUTE);
        result.current.add(RELATIVE);
      });

      await act(async () => {
        await result.current.attach('t-9');
      });

      const posts = requestsTo(fetchMock, 'POST', PATH);
      expect(posts.map((post) => post.body)).toEqual([ABSOLUTE, RELATIVE]);
      expect(new Set(posts.map((post) => post.headers['Idempotency-Key'])).size).toBe(2);
      expect(result.current.drafts).toEqual([]);
      expect(result.current.error).toBeUndefined();
      expect(synced).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('reports reminders that could not be created; the task stays created', async () => {
    const fetchMock = mockFetch();
    let calls = 0;
    routeApi(fetchMock, {
      [`POST ${PATH}`]: (request) => ((calls += 1) === 1 ? created(request.body as object) : problem(400, 'Bad Request')),
    });
    const { result } = await setup();
    await act(async () => {
      result.current.add(ABSOLUTE);
      result.current.add(RELATIVE);
    });

    await act(async () => {
      await result.current.attach('t-9');
    });

    expect(result.current.error).toBe('Đã thêm công việc nhưng không thêm được 1 nhắc nhở');
    expect(result.current.drafts).toEqual([]);
  });
});
