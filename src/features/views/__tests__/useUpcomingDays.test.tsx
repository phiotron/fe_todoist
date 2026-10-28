import { renderHook, waitFor } from '@testing-library/react-native';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, mockFetch } from '../../../test/http';
import { routeApi } from '../../../test/apiRoutes';
import { makeTask, page } from '../../../test/m1Fixtures';
import { testUser } from '../../../test/fixtures';
import { tokenStore } from '../../../lib/tokenStore';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useUpcomingDays } from '../useUpcomingDays';

describe('useUpcomingDays', () => {
  it('keys the query by today: after midnight the window restarts from the new day and is refetched', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    // The new day's answer is held back by hand: "the request was sent" and "the answer arrived" are two separate
    // moments, and the test must not depend on how fast the machine gets from one to the other.
    let releaseNewDay!: () => void;
    const newDayGate = new Promise<void>((resolve) => {
      releaseNewDay = resolve;
    });
    routeApi(fetchMock, {
      'GET /api/v1/me': () => jsonResponse(200, testUser),
      'GET /api/v1/tasks': async (request) => {
        if (request.query.get('from') === '2026-10-24') await newDayGate;
        return jsonResponse(200, page([makeTask({ id: 'a', dueDate: '2026-10-24' })]));
      },
    });
    const { result, rerender } = await renderHook(({ today }: { today: string }) => useUpcomingDays(today), {
      initialProps: { today: '2026-10-23' },
      wrapper: createWrapper(createTestQueryClient()),
    });
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.loadedThrough).toBe('2026-11-05');

    await rerender({ today: '2026-10-24' });

    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks').map((r) => r.query.get('from'))).toEqual([
        '2026-10-23',
        '2026-10-24',
      ]),
    );
    // Sent but not answered yet: nothing of the old day's window is shown for the new day.
    expect(result.current.tasks).toEqual([]);
    expect(result.current.loadedThrough).toBe('2026-10-23');

    releaseNewDay();
    await waitFor(() => expect(result.current.loadedThrough).toBe('2026-11-06'));
    expect(result.current.tasks).toHaveLength(1);
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks')).toHaveLength(2);
  });
});
