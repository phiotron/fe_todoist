import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi/team.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject } from '../../../test/m1Fixtures';
import { makeFolder, makeSharedProject, makeTeamProject, makeWorkspace } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { TeamScreen } from '../TeamScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));

const personal = makeWorkspace({ id: 'w-personal', name: 'Cá nhân', type: 'PERSONAL' });
const team = makeWorkspace({ id: 'w1', name: 'Công ty', role: 'MEMBER', memberCount: 4 });
const mine = makeTeamProject({ id: 'tp1', name: 'Website', joined: true, folderId: 'f1', memberCount: 3, activeTaskCount: 5 });
const open = makeTeamProject({ id: 'tp2', name: 'Chiến dịch', joined: false, memberCount: 1, activeTaskCount: 0 });
const secret = makeTeamProject({ id: 'tp3', name: 'Kế hoạch kín', joined: true, access: 'RESTRICTED' });
const folder = makeFolder({ id: 'f1', workspaceId: 'w1', name: 'Marketing' });

function routes(extra: ApiRoutes = {}, workspace = team): ApiRoutes {
  return {
    'GET /api/v1/workspaces': () => jsonResponse(200, [personal, workspace]),
    'GET /api/v1/workspaces/w1/projects': () => jsonResponse(200, [mine, open, secret]),
    'GET /api/v1/workspaces/w1/folders': () => jsonResponse(200, [folder]),
    ...extra,
  };
}

async function openTeam(extra: ApiRoutes = {}, workspace = team) {
  const rendered = await renderSignedIn(<TeamScreen />, routes(extra, workspace));
  await screen.findByTestId('team-project-tp1');
  return rendered;
}

describe('TeamScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Team Discovery: Active shows every project, folders as headings, members and task counts on the card', async () => {
    await openTeam();
    expect(screen.getByText('Công ty')).toBeOnTheScreen();
    expect(screen.getByTestId('team-group-f1')).toBeOnTheScreen();
    expect(screen.getByText('Marketing')).toBeOnTheScreen();
    expect(screen.getByTestId('team-project-tp2')).toBeOnTheScreen();
    expect(screen.getByTestId('team-project-tp3')).toBeOnTheScreen();
    expect(screen.getByText(`${vi.team.members.replace('{{n}}', '3')} · ${vi.team.tasks.replace('{{n}}', '5')}`)).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(vi.team.restricted))).toBeOnTheScreen();
    // a project I have not joined offers Join, a joined one does not
    expect(screen.getByTestId('team-join-tp2')).toBeOnTheScreen();
    expect(screen.queryByTestId('team-join-tp1')).toBeNull();
  });

  it('Joined and "Projects I haven\'t joined" split the list', async () => {
    await openTeam();
    await fireEvent.press(screen.getByText(vi.team.tabs.notJoined));
    expect(screen.getByTestId('team-project-tp2')).toBeOnTheScreen();
    expect(screen.queryByTestId('team-project-tp1')).toBeNull();
    await fireEvent.press(screen.getByText(vi.team.tabs.joined));
    expect(screen.getByTestId('team-project-tp1')).toBeOnTheScreen();
    expect(screen.queryByTestId('team-project-tp2')).toBeNull();
  });

  it('Join posts to the project and reloads the lists', async () => {
    const { fetchMock } = await openTeam({ 'POST /api/v1/projects/tp2/join': () => jsonResponse(200, {}) });
    await fireEvent.press(screen.getByTestId('team-join-tp2'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/tp2/join')).toHaveLength(1));
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/workspaces/w1/projects').length).toBeGreaterThan(1));
  });

  it('opens a project, People, and the new-project form of this team', async () => {
    await openTeam();
    await fireEvent.press(screen.getByTestId('team-open-tp1'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/project/[id]', params: { id: 'tp1' } });
    await fireEvent.press(screen.getByTestId('team-people'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/team-people/[id]', params: { id: 'w1' } });
    await fireEvent.press(screen.getByTestId('team-new-project'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/project-form', params: { workspaceId: 'w1' } });
  });

  it('creates a folder and deletes one after a confirmation', async () => {
    const { fetchMock } = await openTeam({
      'POST /api/v1/workspaces/w1/folders': () => jsonResponse(201, makeFolder({ id: 'f2', name: 'Kinh doanh' })),
      'DELETE /api/v1/folders/f1': () => jsonResponse(204),
    });
    await fireEvent.press(screen.getByTestId('team-new-folder'));
    await fireEvent.changeText(screen.getByTestId('team-folder-name'), 'Kinh doanh');
    await fireEvent.press(screen.getByTestId('team-folder-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces/w1/folders')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces/w1/folders')[0].body).toEqual({ name: 'Kinh doanh' });

    await fireEvent.press(screen.getByTestId('team-folder-delete-f1'));
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/folders/f1')).toHaveLength(0);
    await fireEvent.press(await screen.findByTestId('team-folder-delete-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/folders/f1')).toHaveLength(1));
  });

  it('an empty tab says so', async () => {
    await renderSignedIn(<TeamScreen />, routes({ 'GET /api/v1/workspaces/w1/projects': () => jsonResponse(200, [mine]) }));
    await screen.findByTestId('team-project-tp1');
    await fireEvent.press(screen.getByText(vi.team.tabs.notJoined));
    expect(screen.getByText(vi.team.empty.notJoined)).toBeOnTheScreen();
  });

  it('a Guest has no Discovery, People or new project: only the projects they were invited to', async () => {
    const guestWorkspace = makeWorkspace({ id: 'w1', name: 'Công ty', role: 'GUEST' });
    const invited = makeSharedProject({ id: 'tp9', name: 'Được mời', workspaceId: 'w1', access: 'TEAM', joined: true, canManage: false });
    const other = makeSharedProject({ id: 'p-other', name: 'Việc riêng', workspaceId: 'w-personal' });
    const { fetchMock } = await renderSignedIn(<TeamScreen />, {
      'GET /api/v1/workspaces': () => jsonResponse(200, [personal, guestWorkspace]),
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, other, invited]),
    });
    expect(await screen.findByTestId('team-project-tp9')).toBeOnTheScreen();
    expect(screen.queryByTestId('team-project-p-other')).toBeNull();
    expect(screen.queryByTestId('team-people')).toBeNull();
    expect(screen.queryByTestId('team-new-project')).toBeNull();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/workspaces/w1/projects')).toHaveLength(0);
  });

  it('with two teams a chip switches between them', async () => {
    const second = makeWorkspace({ id: 'w2', name: 'Câu lạc bộ', role: 'ADMIN' });
    await renderSignedIn(<TeamScreen />, {
      ...routes(),
      'GET /api/v1/workspaces': () => jsonResponse(200, [personal, team, second]),
      'GET /api/v1/workspaces/w2/projects': () => jsonResponse(200, [makeTeamProject({ id: 'tq1', name: 'Giải đấu' })]),
      'GET /api/v1/workspaces/w2/folders': () => jsonResponse(200, []),
    });
    await screen.findByTestId('team-project-tp1');
    await fireEvent.press(screen.getByTestId('team-switch-w2'));
    expect(await screen.findByTestId('team-project-tq1')).toBeOnTheScreen();
    expect(screen.queryByTestId('team-project-tp1')).toBeNull();
  });

  it('shows an empty state while the user belongs to no team', async () => {
    await renderSignedIn(<TeamScreen />, { 'GET /api/v1/workspaces': () => jsonResponse(200, [personal]) });
    expect(await screen.findByTestId('team-none')).toBeOnTheScreen();
  });
});
