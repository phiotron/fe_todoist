import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeSharedProject, makeWorkspace } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../ProjectScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true), navigate: jest.fn() },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

type SharedOverrides = Parameters<typeof makeSharedProject>[0];

function routes(project: ReturnType<typeof makeSharedProject>, extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    [`GET /api/v1/projects/${project.id}`]: () => jsonResponse(200, project),
    [`GET /api/v1/projects/${project.id}/sections`]: () => jsonResponse(200, []),
    'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'a', projectId: project.id, content: 'Việc chung' })])),
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w-personal', type: 'PERSONAL' })]),
    ...viewOptionsRoutes([`project:${project.id}`]),
    ...extra,
  };
}

async function open(overrides: SharedOverrides = {}, extra: ApiRoutes = {}) {
  const project = makeSharedProject({ id: 'p1', name: 'Nhà', ...overrides });
  const rendered = await renderSignedIn(<ProjectScreen projectId="p1" />, routes(project, extra));
  await screen.findByText('Việc chung');
  return rendered;
}

async function openMenu() {
  await fireEvent.press(screen.getByTestId('project-menu-open'));
}

describe('ProjectScreen sharing (M8a)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('the owner of a shared project: Share, Archive, Delete; no Leave', async () => {
    await open({ memberCount: 3 });
    await openMenu();
    expect(screen.getByTestId('project-menu-share')).toBeOnTheScreen();
    expect(screen.getByTestId('project-menu-archive')).toBeOnTheScreen();
    expect(screen.getByTestId('project-menu-delete')).toBeOnTheScreen();
    expect(screen.queryByTestId('project-menu-leave')).toBeNull();
    await fireEvent.press(screen.getByTestId('project-menu-share'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/project-share/[id]', params: { id: 'p1' } });
  });

  it('a collaborator (everyone is equal, but only the owner manages): Share and Leave, no Archive / Delete', async () => {
    await open({ canManage: false });
    await openMenu();
    expect(screen.getByTestId('project-menu-share')).toBeOnTheScreen();
    expect(screen.getByTestId('project-menu-leave')).toBeOnTheScreen();
    expect(screen.queryByTestId('project-menu-archive')).toBeNull();
    expect(screen.queryByTestId('project-menu-delete')).toBeNull();
    expect(screen.getByTestId('project-fab')).toBeOnTheScreen(); // they can still add tasks
  });

  it('Leave project asks first, then posts and goes back', async () => {
    const { fetchMock } = await open({ canManage: false }, { 'POST /api/v1/projects/p1/leave': () => jsonResponse(204) });
    await openMenu();
    await fireEvent.press(screen.getByTestId('project-menu-leave'));
    expect(await screen.findByTestId('project-leave-dialog')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/leave')).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('project-leave-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/leave')).toHaveLength(1));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('previewing a team project: banner + Join, read only (no + button, no add-section), Join posts', async () => {
    const { fetchMock } = await open(
      { access: 'TEAM', joined: false, canManage: false, workspaceId: 'w1' },
      { 'POST /api/v1/projects/p1/join': () => jsonResponse(200, {}) },
    );
    expect(screen.getByTestId('project-preview-banner')).toBeOnTheScreen();
    expect(screen.queryByTestId('project-fab')).toBeNull();
    expect(screen.queryByTestId('project-archived-banner')).toBeNull();
    await openMenu();
    expect(screen.queryByTestId('project-menu-add-section')).toBeNull();
    expect(screen.queryByTestId('project-menu-share')).toBeNull();
    expect(screen.queryByTestId('project-menu-leave')).toBeNull();
    expect(screen.queryByTestId('project-menu-delete')).toBeNull();
    await fireEvent.press(screen.getByTestId('project-menu-join'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/join')).toHaveLength(1));
  });

  it('the Join button of the banner posts too', async () => {
    const { fetchMock } = await open(
      { access: 'TEAM', joined: false, canManage: false },
      { 'POST /api/v1/projects/p1/join': () => jsonResponse(200, {}) },
    );
    await fireEvent.press(screen.getByTestId('project-join'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/join')).toHaveLength(1));
  });

  it('a joined team project: its creator / Admin can archive and leave; no sub-project entry (team has none)', async () => {
    await open({ access: 'RESTRICTED', joined: true, canManage: true });
    await openMenu();
    expect(screen.getByTestId('project-menu-archive')).toBeOnTheScreen();
    expect(screen.getByTestId('project-menu-leave')).toBeOnTheScreen();
    expect(screen.getByTestId('project-menu-add-subproject').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByTestId('project-menu-move-to-team')).toBeNull(); // no way back out, and no way "in" twice
  });

  it('Move to a team: only offered to the owner who has a team; chooses team + access and posts', async () => {
    const team = makeWorkspace({ id: 'w1', name: 'Công ty', role: 'ADMIN' });
    const { fetchMock } = await open(
      {},
      {
        'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w-personal', type: 'PERSONAL' }), team]),
        'POST /api/v1/projects/p1/move-to-workspace': () => jsonResponse(200, {}),
      },
    );
    await openMenu();
    await fireEvent.press(await screen.findByTestId('project-menu-move-to-team'));
    expect(await screen.findByTestId('move-to-team-sheet')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('move-access-RESTRICTED'));
    await fireEvent.press(screen.getByTestId('move-to-team-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/move-to-workspace')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/move-to-workspace')[0].body).toEqual({
      workspaceId: 'w1',
      access: 'RESTRICTED',
    });
  });

  it('without a team there is no Move to a team entry', async () => {
    await open();
    await openMenu();
    expect(screen.queryByTestId('project-menu-move-to-team')).toBeNull();
  });
});
