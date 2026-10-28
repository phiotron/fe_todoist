import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi/views.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeSharedProject, makeWorkspace } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { INBOX_TEAM_COLLAPSED_KEY, InboxTeamSection } from '../InboxTeamSection';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-28T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const t = vi.views.inboxTeam;
const team = makeWorkspace({ id: 'w-team', name: 'Nhóm Alpha' });
const personal = makeWorkspace({ id: 'w-personal', name: 'Cá nhân', type: 'PERSONAL' });
const design = makeSharedProject({ id: 'p-design', name: 'Thiết kế', workspaceId: 'w-team', access: 'TEAM' });
const home = makeSharedProject({ id: 'p-home', name: 'Nhà chung', memberCount: 2 });
const mine = makeSharedProject({ id: 'p-mine', name: 'Riêng', memberCount: 1 });

function routes(tasks = [makeTask({ id: 'd1', projectId: 'p-design', projectName: 'Thiết kế', content: 'Vẽ logo' }),
  makeTask({ id: 'h1', projectId: 'p-home', projectName: 'Nhà chung', content: 'Mua gạo' })], projects = [inboxProject, mine, design, home]) {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, projects),
    'GET /api/v1/workspaces': () => jsonResponse(200, [personal, team]),
    'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
  };
}

beforeEach(async () => {
  jest.mocked(router.push).mockClear();
  await AsyncStorage.clear();
});

describe('InboxTeamSection', () => {
  it('asks view=inbox_team and groups the undated team work by team, then project', async () => {
    const { fetchMock } = await renderSignedIn(<InboxTeamSection />, routes());

    expect(await screen.findByText('Vẽ logo')).toBeOnTheScreen();
    expect(screen.getByText(t.title)).toBeOnTheScreen();
    expect(screen.getByTestId('inbox-team-group-w-team')).toHaveTextContent(/Nhóm Alpha/);
    expect(screen.getByTestId('inbox-team-group-shared')).toHaveTextContent(new RegExp(t.shared));
    expect(screen.getByTestId('inbox-team-project-p-design')).toHaveTextContent(/Thiết kế/);
    // the team group comes before the shared projects
    const texts = screen.getAllByText(/Vẽ logo|Mua gạo/).map((node) => node.props.children);
    expect(texts).toEqual(['Vẽ logo', 'Mua gạo']);
    expect(screen.getByText('Mua gạo')).toBeOnTheScreen();
    const [request] = requestsTo(fetchMock, 'GET', '/api/v1/tasks');
    expect(request.query.get('view')).toBe('inbox_team');
    expect(request.query.get('projectId')).toBeNull();
  });

  it('shows nothing and asks nothing when no joined project is shared or a team project', async () => {
    const { fetchMock } = await renderSignedIn(<InboxTeamSection />, routes([], [inboxProject, mine]));

    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/projects')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks')).toHaveLength(0);
    expect(screen.queryByTestId('inbox-team')).toBeNull();
  });

  it('shows nothing when the group projects have no undated open task', async () => {
    await renderSignedIn(<InboxTeamSection />, routes([]));
    await waitFor(() => expect(screen.queryByTestId('inbox-team')).toBeNull());
  });

  it('never lists a task of a project that is not a group project (Inbox, own project)', async () => {
    await renderSignedIn(
      <InboxTeamSection />,
      routes([
        makeTask({ id: 'i1', projectId: 'p-inbox', content: 'Trong Inbox' }),
        makeTask({ id: 'm1', projectId: 'p-mine', content: 'Của riêng' }),
        makeTask({ id: 'd1', projectId: 'p-design', projectName: 'Thiết kế', content: 'Vẽ logo' }),
      ]),
    );
    expect(await screen.findByText('Vẽ logo')).toBeOnTheScreen();
    expect(screen.queryByText('Trong Inbox')).toBeNull();
    expect(screen.queryByText('Của riêng')).toBeNull();
  });

  it('opens the task detail on tap', async () => {
    await renderSignedIn(<InboxTeamSection />, routes());
    await fireEvent.press(await screen.findByTestId('task-row-d1'));
    expect(router.push).toHaveBeenCalledWith('/task/d1');
  });

  it('shows at most 5 tasks per project, then "See all" opens the project', async () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      makeTask({ id: `d${i + 1}`, projectId: 'p-design', projectName: 'Thiết kế', content: `Việc ${i + 1}` }));
    await renderSignedIn(<InboxTeamSection />, routes(many));

    expect(await screen.findByText('Việc 5')).toBeOnTheScreen();
    expect(screen.queryByText('Việc 6')).toBeNull();
    await fireEvent.press(screen.getByText(t.seeAll.replace('{{n}}', '7')));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/project/[id]', params: { id: 'p-design' } });
  });

  it('collapses the whole section and one group, and remembers both on the device', async () => {
    const first = await renderSignedIn(<InboxTeamSection />, routes());
    expect(await screen.findByText('Vẽ logo')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('inbox-team-group-w-team-toggle'));
    expect(screen.queryByText('Vẽ logo')).toBeNull();
    expect(screen.getByText('Mua gạo')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('inbox-team-header'));
    expect(screen.queryByText('Mua gạo')).toBeNull();
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(INBOX_TEAM_COLLAPSED_KEY)) ?? '[]')).toEqual(
        expect.arrayContaining(['section', 'w-team']),
      ));
    first.unmount();

    await renderSignedIn(<InboxTeamSection />, routes());
    expect(await screen.findByTestId('inbox-team-header')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Mua gạo')).toBeNull());
    await fireEvent.press(screen.getByTestId('inbox-team-header'));
    expect(await screen.findByText('Mua gạo')).toBeOnTheScreen();
    expect(screen.queryByText('Vẽ logo')).toBeNull(); // the team group stays collapsed
  });
});
