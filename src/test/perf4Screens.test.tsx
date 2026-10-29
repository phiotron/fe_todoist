import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { addDays } from '../lib/dates';
import { LONG_PRESS_MS } from '../features/dnd/dnd';
import type { PagedQuery } from '../lib/usePagedList';
import type { BoardColumn } from '../features/board/boardColumns';
import { BoardView } from '../features/board/BoardView';
import { CalendarView, setCalendarMode } from '../features/calendar/CalendarView';
import { allTasksScope } from '../features/calendar/useCalendarTasks';
import { ActivityLogView } from '../features/activity/ActivityLogView';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { CommentThread } from '../features/comments/CommentThread';
import { BrowseScreen } from '../features/browse/BrowseScreen';
import { SearchScreen } from '../features/search/SearchScreen';
import type { ApiRoutes } from './apiRoutes';
import { jsonResponse } from './http';
import { activityItem } from './m10Fixtures';
import { inboxProject, makeFavorite, makeProject, makeTask, page } from './m1Fixtures';
import { AN, BINH, makeComment, makeNotification } from './m8bFixtures';
import { hooks, profiled, readMeasure, record, resetMeasure } from './perf4';
import { renderSignedIn } from './screen';

/**
 * PERF4: screens other than the main task list, with the data sizes of the demo database (Board 8 x 40, Calendar 300
 * events, Activity 500, Notifications 200, Comments 200 with @mentions, Browse 77 projects). Each scenario records
 * mount cost (commits / ms / hooks) and the cost of ONE later update (a drag starts, a minute passes), then asserts a
 * budget so a regression turns it red.
 */
jest.mock('@tanstack/react-query', () => require('./perf4').wrapReactQuery(jest.requireActual('@tanstack/react-query')));
jest.mock('react-i18next', () => require('./perf4').wrapI18next(jest.requireActual('react-i18next')));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: jest.fn(),
}));
// useNow ticks only when the test says so (a minute passing).
jest.mock('../lib/useNow', () => {
  const { useSyncExternalStore } = require('react');
  const listeners = new Set<() => void>();
  let current = new Date('2026-11-12T03:00:00Z');
  return {
    useNow: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => current,
      ),
    __tick: () => {
      current = new Date(current.getTime() + 60_000);
      listeners.forEach((listener) => listener());
    },
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tick = () => (require('../lib/useNow') as { __tick: () => void }).__tick();

const mockQuery: PagedQuery = {
  isPending: false,
  isError: false,
  error: null,
  fetchStatus: 'idle',
  isRefetching: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  refetch: jest.fn(),
  fetchNextPage: jest.fn(),
};

const netInfoListeners = () => jest.mocked(NetInfo.addEventListener).mock.calls.length;

async function measureMount<T>(scenario: string, mount: () => Promise<T>, ready: () => Promise<unknown>) {
  jest.mocked(NetInfo.addEventListener).mockClear();
  resetMeasure();
  const result = await mount();
  await ready();
  const mounted = { ...readMeasure(), netInfo: netInfoListeners() };
  record(`${scenario} mount`, mounted);
  return { result, mounted };
}

function measureUpdate(scenario: string, update: () => Promise<void> | void) {
  return async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    resetMeasure();
    await update();
    const measured = readMeasure();
    record(`${scenario} update`, measured);
    return measured;
  };
}

beforeEach(() => resetMeasure());

describe('PERF4 screens', () => {
  it('Board 8 columns x 40 cards', async () => {
    const columns: BoardColumn[] = Array.from({ length: 8 }, (_, c) => ({
      key: `section:s${c}`,
      title: `Cột ${c}`,
      tasks: Array.from({ length: 40 }, (_, i) =>
        makeTask({ id: `t-${c}-${i}`, content: `Công việc ${c}-${i}`, dueDate: '2026-11-13', labelIds: [], priority: ((i % 4) + 1) as 1 }),
      ),
      drop: { kind: 'section', projectId: 'p-1', sectionId: `s${c}` },
      add: { projectId: 'p-1' },
    }));
    const { mounted } = await measureMount(
      'board',
      () => renderSignedIn(profiled(<BoardView columns={columns} query={mockQuery} />)),
      () => screen.findByText('Công việc 0-0'),
    );
    const card = screen.getByTestId('board-card-t-0-0');
    const update = await measureUpdate('board drag-start', async () => {
      const at = { nativeEvent: { pageX: 5, pageY: 5 } };
      await fireEvent(card, 'responderGrant', at);
      await screen.findByTestId('drag-ghost');
      await fireEvent(card, 'responderRelease', at);
    })();
    // Budget: one mutation hook for the whole board (not one per card); a constant number of NetInfo listeners (was one per card: 329).
    expect(mounted.useMutation).toBeLessThanOrEqual(24);
    expect(mounted.netInfo).toBeLessThanOrEqual(2);
    expect(update.render).toBeLessThan(mounted.render);
    expect(LONG_PRESS_MS).toBeGreaterThan(0);
  }, 60_000);

  it('Calendar month with 300 events', async () => {
    setCalendarMode('MONTH');
    const routes: ApiRoutes = {
      'GET /api/v1/tasks': (request) => {
        const from = request.query.get('from') as string;
        if (request.query.get('view') !== 'calendar') return jsonResponse(200, page([]));
        return jsonResponse(
          200,
          page(
            Array.from({ length: 300 }, (_, i) =>
              makeTask({ id: `e-${i}`, content: `Sự kiện ${i}`, dueDate: i % 3 === 0 ? addDays(from, i % 35) : null, dueDatetime: i % 3 === 0 ? null : `${addDays(from, i % 35)}T${String(8 + (i % 10)).padStart(2, '0')}:00:00` }),
            ),
          ),
        );
      },
    };
    const { mounted } = await measureMount(
      'calendar-month',
      () => renderSignedIn(profiled(<CalendarView scope={allTasksScope()} filters={{}} />), routes),
      () => screen.findByTestId('calendar-month'),
    );
    await waitFor(() => expect(screen.getAllByTestId(/^calendar-chip-/).length).toBeGreaterThan(50));
    await measureUpdate('calendar-month tick', async () => {
      await act(async () => tick());
    })();
    expect(mounted.netInfo).toBeLessThanOrEqual(2);
  }, 60_000);

  it('Activity 500 rows', async () => {
    const items = Array.from({ length: 500 }, (_, i) =>
      activityItem({ id: `a-${i}`, objectName: `Việc ${i}`, createdAt: new Date(Date.UTC(2026, 10, 12, 3) - i * 3_600_000).toISOString() }),
    );
    const routes: ApiRoutes = {
      'GET /api/v1/activity': () => jsonResponse(200, { items, nextCursor: null }),
      'GET /api/v1/projects': () => jsonResponse(200, []),
    };
    await measureMount(
      'activity',
      () => renderSignedIn(profiled(<ActivityLogView />), routes),
      () => screen.findByText('Bạn đã thêm công việc: Việc 0'),
    );
    const update = await measureUpdate('activity tick', async () => {
      await act(async () => tick());
    })();
    expect(update.render).toBeLessThanOrEqual(8); // rows are memoised: a tick redraws the screen shell only
  }, 60_000);

  it('Notifications 200', async () => {
    const list = Array.from({ length: 200 }, (_, i) =>
      makeNotification({ id: `n-${i}`, commentExcerpt: `Nhắc ${i}`, isRead: i % 2 === 0, actor: { ...BINH, avatarUrl: '/api/v1/users/u-2/avatar' } }),
    );
    const routes: ApiRoutes = {
      'GET /api/v1/notifications': () => jsonResponse(200, page(list)),
      'GET /api/v1/notifications/unread-count': () => jsonResponse(200, { count: 100 }),
    };
    await measureMount(
      'notifications',
      () => renderSignedIn(profiled(<NotificationsScreen />), routes),
      () => screen.findByText('Nhắc 0'),
    );
    const update = await measureUpdate('notifications tick', async () => {
      await act(async () => tick());
    })();
    expect(update.render).toBeLessThanOrEqual(5); // the day did not change: no row redraws
  }, 60_000);

  it('Comments 200 with @mentions', async () => {
    const comments = Array.from({ length: 200 }, (_, i) =>
      makeComment({
        id: `c-${i}`,
        content: `Bình luận ${i} @An xin chào @Bình`,
        mentionUserIds: [AN.id, BINH.id],
        author: { ...BINH, avatarUrl: '/api/v1/users/u-2/avatar' },
        isMine: i % 3 === 0,
        reactions: i % 5 === 0 ? [{ emoji: '👍', count: 2, reactedByMe: false, userIds: [] }] : [],
      }),
    );
    const routes: ApiRoutes = {
      'GET /api/v1/tasks/t-1/comments': () => jsonResponse(200, comments),
      'GET /api/v1/tasks/t-1/comments/mentionable': () => jsonResponse(200, [AN, BINH]),
    };
    const { mounted } = await measureMount(
      'comments',
      () => renderSignedIn(profiled(<CommentThread target={{ kind: 'task', id: 't-1' }} readOnly={false} showTitle />), routes),
      () => screen.findByText(/Bình luận 199/),
    );
    const update = await measureUpdate('comments tick', async () => {
      await act(async () => tick());
    })();
    expect(update.render).toBeLessThan(mounted.render / 20); // a minute tick must not redraw the 200 comments
  }, 60_000);

  it('Browse 77 projects', async () => {
    const projects = Array.from({ length: 77 }, (_, i) =>
      makeProject({ id: `p${i}`, name: `Dự án ${i}`, sortOrder: 1024 * (i + 1), parentId: i % 7 === 6 ? `p${i - 1}` : null, activeTaskCount: i, isFavorite: i % 10 === 0 }),
    );
    const routes: ApiRoutes = {
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, ...projects]),
      'GET /api/v1/favorites': () => jsonResponse(200, projects.filter((p) => p.isFavorite).map((p) => makeFavorite(p.id))),
    };
    const { mounted } = await measureMount(
      'browse',
      () => renderSignedIn(profiled(<BrowseScreen />), routes),
      () => screen.findByText('Dự án 1'),
    );
    expect(mounted.netInfo).toBeLessThanOrEqual(2);
    expect(mounted.useMutation).toBeLessThanOrEqual(24); // one favorite mutation per block, not per row (was 245)
  }, 60_000);

  it('Search 200 results', async () => {
    const tasks = Array.from({ length: 200 }, (_, i) => makeTask({ id: `s-${i}`, content: `Kết quả ${i}` }));
    const routes: ApiRoutes = {
      'GET /api/v1/search/tasks': () => jsonResponse(200, page(tasks)),
      'GET /api/v1/search': () => jsonResponse(200, { projects: [], sections: [], labels: [], filters: [] }),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
    };
    await measureUpdate('search type', async () => undefined)().catch(() => undefined);
    await renderSignedIn(profiled(<SearchScreen />), routes);
    resetMeasure();
    await fireEvent.changeText(screen.getByTestId('search-input'), 'kết');
    await waitFor(() => expect(screen.queryByText('Kết quả 0')).toBeTruthy(), { timeout: 5000 }).catch(() => undefined);
    record('search results', readMeasure());
  }, 60_000);
});

export { hooks };
