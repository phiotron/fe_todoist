import { screen } from '@testing-library/react-native';
import { BrowseScreen } from '../../features/browse/BrowseScreen';
import { QuickAddSheet } from '../../features/quickAdd/QuickAddSheet';
import { InboxScreen } from '../../features/views/InboxScreen';
import { TodayScreen } from '../../features/views/TodayScreen';
import { UpcomingScreen } from '../../features/views/UpcomingScreen';
import { jsonResponse } from '../../test/http';
import { inboxProject, makeFavorite, makeProject, makeSection, makeTask, page } from '../../test/m1Fixtures';
import { quickAddSettingsRoute } from '../../test/quickAddFixtures';
import { renderSignedIn } from '../../test/screen';
import { englishWordIn } from '../../test/viTerminology';
import { viewOptionsRoutes } from '../../test/viewOptionsServer';

/**
 * VIUI: the main screens rendered in Vietnamese show no English product word — neither from the locale files nor from
 * the server's fixed "Inbox" project name. Every text node and accessibility label / placeholder is checked.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
}));
// Friday 23/10/2026, 10:00 in Vietnam.
jest.mock('../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../features/auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

type HostNode = (typeof screen)['container'];

/** The jest icon mock renders the icon name as a Text: that is not UI copy. */
function isIcon(node: HostNode): boolean {
  // Host text -> RN Text -> MockIcon: look a few owners up.
  let fiber = node.unstable_fiber?.return;
  for (let depth = 0; fiber && depth < 4; depth += 1, fiber = fiber.return) {
    if ((fiber.type as { name?: string } | null)?.name === 'MockIcon') return true;
  }
  return false;
}

/** Visible texts, accessibility labels / hints and placeholders of the rendered host tree. */
function collect(node: HostNode, out: string[]): string[] {
  if (isIcon(node)) return out;
  for (const prop of ['accessibilityLabel', 'accessibilityHint', 'placeholder']) {
    const value: unknown = node.props[prop];
    if (typeof value === 'string') out.push(value);
  }
  for (const child of node.children) {
    if (typeof child === 'string') out.push(child);
    else collect(child, out);
  }
  return out;
}

function englishOnScreen(): string[] {
  return [...new Set(collect(screen.container, []))].filter((text) => englishWordIn(text) !== null);
}

const work = makeProject({ id: 'p1', name: 'Công ty', sortOrder: 1024, activeTaskCount: 2 });
const inbox = { ...inboxProject, activeTaskCount: 2 };
const inboxTask = makeTask({ id: 't1', content: 'Mua sữa', projectId: 'p-inbox', dueDatetime: '2026-10-23T09:00:00' });
const tomorrowTask = makeTask({ id: 't2', content: 'Họp nhóm', projectId: 'p-inbox', dueDatetime: '2026-10-24T17:00:00' });
const projects = () => jsonResponse(200, [inbox, work]);

describe('Vietnamese screens show no English (VIUI)', () => {
  it('Inbox: title, section header, add-section and add-task rows', async () => {
    await renderSignedIn(<InboxScreen />, {
      'GET /api/v1/projects': projects,
      'GET /api/v1/projects/p-inbox': () => jsonResponse(200, inbox),
      'GET /api/v1/projects/p-inbox/sections': () =>
        jsonResponse(200, [makeSection({ id: 's1', projectId: 'p-inbox', name: 'Việc nhà' })]),
      'GET /api/v1/tasks': () => jsonResponse(200, page([inboxTask])),
      ...viewOptionsRoutes(['project:p-inbox']),
    });
    await screen.findByText('Mua sữa');
    expect(screen.getAllByText('Hộp thư đến').length).toBeGreaterThan(0);
    expect(englishOnScreen()).toEqual([]);
  });

  it('Today: the project of each task is the translated Inbox', async () => {
    await renderSignedIn(<TodayScreen />, {
      'GET /api/v1/projects': projects,
      'GET /api/v1/tasks': () => jsonResponse(200, page([inboxTask])),
      ...viewOptionsRoutes(['TODAY']),
    });
    await screen.findByText('Mua sữa');
    expect(screen.getByText('Hôm nay 09:00')).toBeOnTheScreen();
    expect(englishOnScreen()).toEqual([]);
  });

  it('Upcoming: day headers and dues in Vietnamese', async () => {
    await renderSignedIn(<UpcomingScreen />, {
      'GET /api/v1/projects': projects,
      'GET /api/v1/tasks': (request) =>
        jsonResponse(200, page(request.query.get('view') === 'overdue' ? [] : [tomorrowTask])),
      ...viewOptionsRoutes(['UPCOMING']),
    });
    await screen.findByText('Họp nhóm');
    expect(screen.getByText('24/10 · Ngày mai · Thứ Bảy')).toBeOnTheScreen();
    expect(englishOnScreen()).toEqual([]);
  });

  it('Browse', async () => {
    await renderSignedIn(<BrowseScreen />, {
      'GET /api/v1/projects': projects,
      'GET /api/v1/favorites': () => jsonResponse(200, [makeFavorite('p1')]),
    });
    await screen.findAllByText('Công ty');
    expect(englishOnScreen()).toEqual([]);
  });

  it('Quick Add: the Inbox target row and the chips', async () => {
    await renderSignedIn(<QuickAddSheet params={{}} />, {
      ...quickAddSettingsRoute(),
      'GET /api/v1/projects': projects,
      'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
    });
    await screen.findByText('Hộp thư đến');
    expect(englishOnScreen()).toEqual([]);
  });
});
