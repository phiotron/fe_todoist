import { QueryClient } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import SignedInLayout from '../../app/(app)/_layout';
import { routeApi, type ApiRoutes } from '../../test/apiRoutes';
import { testSettings, testUser } from '../../test/fixtures';
import { jsonResponse, mockFetch } from '../../test/http';
import { productivity } from '../../test/m10Fixtures';
import { makeTask, page } from '../../test/m1Fixtures';
import { renderWithSettings } from '../../test/renderSettings';
import { queryClient as appClient } from '../queryClient';
import { tokenStore } from '../tokenStore';
import { resetAfterInteractionsForTests } from '../useAfterInteractions';

/**
 * PERF3: the requests of a cold start (token stored, nothing cached, Today as the first screen) with the REAL query
 * client defaults. Measured before the change: 10 requests, ALL of them started at once, the widget list (a second
 * GET tasks?view=today beside the Today list) and productivity among them. Now what only serves the background
 * (widget picture, goal toast, push token, geofences, first reminder re-plan) waits for the first screen.
 */
jest.mock('expo-router', () => {
  const Stack = Object.assign(
    () => require('react').createElement(require('../../features/views/TodayScreen').TodayScreen),
    { Screen: () => null },
  );
  const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
  return { Stack, Redirect: () => null, router, useRouter: () => router, usePathname: () => '/' };
});

/** Max GETs allowed BEFORE the first screen has settled (measured before: 10 = 9 GET + 1 POST /sync, all at once). */
const MAX_REQUESTS_BEFORE_SETTLED = 8;
/** Max in total once everything has started. */
const MAX_REQUESTS_TOTAL = 9;

const pathOf = (url: unknown) => String(url).replace(/^https?:\/\/[^/]+/, '');

async function tick(ms = 150) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe('cold start requests', () => {
  let release: (() => void) | null = null;

  beforeEach(() => {
    resetAfterInteractionsForTests();
    release = null;
    globalThis.requestIdleCallback = ((task: () => void) => {
      release = task;
      return 1;
    }) as never;
    globalThis.cancelIdleCallback = (() => undefined) as never;
  });
  afterEach(() => jest.restoreAllMocks());

  it('background hosts wait for the first screen; the total stays under the threshold', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    const routes: ApiRoutes = {
      'GET /api/v1/me': () => jsonResponse(200, testUser),
      'GET /api/v1/me/settings': () => jsonResponse(200, testSettings),
      'GET /api/v1/productivity': () => jsonResponse(200, productivity()),
      'POST /api/v1/sync': () => jsonResponse(200, { syncToken: 's1', results: [], changes: {}, deleted: [], fullSync: false }),
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'a', dueDate: '2026-10-23' })])),
    };
    routeApi(fetchMock, routes);
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const handler = routes[`${init?.method ?? 'GET'} ${url.pathname}`];
      if (handler) return (handler as never as () => Response)();
      return jsonResponse(200, url.pathname.includes('tasks') ? page([]) : []);
    });
    const queryClient = new QueryClient({
      defaultOptions: { ...appClient.getDefaultOptions(), queries: { ...appClient.getDefaultOptions().queries, retry: false } },
    });

    await renderWithSettings(<SignedInLayout />, { queryClient });
    await tick();
    const early = fetchMock.mock.calls.map(([url]) => pathOf(url));
    expect(early.length).toBeLessThanOrEqual(MAX_REQUESTS_BEFORE_SETTLED);
    expect(early).not.toContain('/api/v1/productivity');
    // Only the Today list itself (display options present), not the widget copy of it.
    expect(early.filter((path) => path.startsWith('/api/v1/tasks?view=today'))).toHaveLength(1);

    await act(async () => {
      release?.();
    });
    await tick();
    const all = fetchMock.mock.calls.map(([url]) => pathOf(url));
    expect(all.length).toBeLessThanOrEqual(MAX_REQUESTS_TOTAL);
    // The widget picture reuses the Today list the screen just loaded: one GET tasks for both.
    expect(all.filter((path) => path.startsWith('/api/v1/tasks'))).toHaveLength(1);
    // Nothing is fetched twice at start: the same path + query never appears twice.
    expect(new Set(all).size).toBe(all.length);
  });
});
