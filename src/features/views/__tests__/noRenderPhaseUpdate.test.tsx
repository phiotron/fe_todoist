import { act, screen, waitFor } from '@testing-library/react-native';
import type { Project } from '../../../api/models';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeSharedProject } from '../../../test/m8aFixtures';
import { createTestQueryClient } from '../../../test/render';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { InboxScreen } from '../InboxScreen';
import { TodayScreen } from '../TodayScreen';
import { UpcomingScreen } from '../UpcomingScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

// Cold start (nothing cached): rows trigger the projects / workspaces queries while the screen renders. A query added to
// the cache during a render must not setState another component ("Cannot update a component while rendering…").
const teamProject = makeSharedProject({ id: 'pt', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }) as Project;
const mine = makeProject({ id: 'p1', name: 'Của tôi' });
const tasks = [
  makeTask({ id: 'a', projectId: 'pt', content: 'Báo cáo nhóm', dueDate: '2026-10-23' }),
  makeTask({ id: 'b', projectId: 'p1', content: 'Đi chợ', dueDate: '2026-10-23' }),
  makeTask({ id: 'c', projectId: inboxProject.id, content: 'Việc hộp thư', dueDate: '2026-10-24' }),
];

const routes = (view: 'TODAY' | 'UPCOMING' | 'INBOX') => ({
  ...viewOptionsRoutes([view], []),
  'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
  'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, mine, teamProject]),
  'GET /api/v1/workspaces': () => jsonResponse(200, []),
});

describe.each([
  ['Today', <TodayScreen key="t" />, 'TODAY', 'Báo cáo nhóm'],
  ['Upcoming', <UpcomingScreen key="u" />, 'UPCOMING', 'Việc hộp thư'],
  ['Inbox', <InboxScreen key="i" />, 'INBOX', 'Đi chợ'],
] as const)('%s on a cold start', (_name, ui, view, text) => {
  it('does not update a component while rendering another one', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderSignedIn(ui, routes(view), createTestQueryClient());
    await waitFor(() => expect(screen.queryAllByText(text).length + screen.queryAllByTestId(/^task-row-/).length).toBeGreaterThan(0));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    const bad = spy.mock.calls.filter((call) => String(call[0]).includes('while rendering a different component'));
    spy.mockRestore();
    expect(bad).toEqual([]);
  });
});
