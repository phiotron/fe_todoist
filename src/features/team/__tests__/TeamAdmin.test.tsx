import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { API_URL } from '../../../lib/config';
import viTeam from '../../../i18n/locales/vi/team.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, problem } from '../../../test/http';
import { makeFolder, makeMember, makeSharedProject, makeTeamProject, makeWorkspace } from '../../../test/m8aFixtures';
import { inboxProject, makeProject } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { ProjectFormScreen } from '../../projects/ProjectFormScreen';
import { TeamPeopleScreen } from '../TeamPeopleScreen';
import { TeamScreen } from '../TeamScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const me = makeMember({ userId: testUser.id, displayName: 'An', email: testUser.email, role: 'ADMIN' });
const bob = makeMember({ userId: 'u-bob', displayName: 'Bob', email: 'bob@example.com', role: 'MEMBER' });

function peopleRoutes(role: 'ADMIN' | 'MEMBER', extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w1', name: 'Công ty', role })]),
    'GET /api/v1/workspaces/w1/members': () => jsonResponse(200, [me, bob]),
    'GET /api/v1/workspaces/w1/invitations': () => jsonResponse(200, []),
    'GET /api/v1/workspaces/w1/invite-link': () => jsonResponse(200, { token: null, url: null }),
    ...extra,
  };
}

async function openPeople(role: 'ADMIN' | 'MEMBER' = 'ADMIN', extra: ApiRoutes = {}) {
  const rendered = await renderSignedIn(<TeamPeopleScreen workspaceId="w1" />, peopleRoutes(role, extra));
  await screen.findByTestId('team-member-u-bob');
  return rendered;
}

describe('Team settings in People (X2): rename and delete the team', () => {
  beforeEach(() => jest.clearAllMocks());

  it('an Admin renames the team with PATCH {name}; the save button waits for a change', async () => {
    const { fetchMock } = await openPeople('ADMIN', {
      'PATCH /api/v1/workspaces/w1': () => jsonResponse(200, makeWorkspace({ id: 'w1', name: 'Đội mới' })),
    });
    expect(screen.getByTestId('team-rename-input').props.value).toBe('Công ty');
    expect(screen.getByTestId('team-rename-submit').props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.changeText(screen.getByTestId('team-rename-input'), '  Đội mới ');
    await fireEvent.press(screen.getByTestId('team-rename-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/workspaces/w1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/workspaces/w1')[0].body).toEqual({ name: 'Đội mới' });
    expect(await screen.findByText(viTeam.team.peopleScreen.renamed)).toBeOnTheScreen();
  });

  it('refuses an empty name locally and shows a server error under the field', async () => {
    const { fetchMock } = await openPeople('ADMIN', {
      'PATCH /api/v1/workspaces/w1': () => problem(403, 'Forbidden'),
    });
    await fireEvent.changeText(screen.getByTestId('team-rename-input'), '   ');
    await fireEvent.press(screen.getByTestId('team-rename-submit'));
    expect(screen.getByText(viTeam.team.peopleScreen.nameInvalid)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/workspaces/w1')).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('team-rename-input'), 'Tên khác');
    await fireEvent.press(screen.getByTestId('team-rename-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/workspaces/w1')).toHaveLength(1));
    expect(screen.queryByText(viTeam.team.peopleScreen.nameInvalid)).toBeNull();
  });

  it('deleting asks first, then DELETEs the workspace and goes to Browse', async () => {
    const { fetchMock } = await openPeople('ADMIN', { 'DELETE /api/v1/workspaces/w1': () => jsonResponse(204) });
    await fireEvent.press(screen.getByTestId('team-delete'));
    expect(await screen.findByTestId('team-delete-dialog')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/workspaces/w1')).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('team-delete-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/workspaces/w1')).toHaveLength(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/browse'));
  });

  it('cancelling the delete dialog sends nothing', async () => {
    const { fetchMock } = await openPeople('ADMIN');
    await fireEvent.press(screen.getByTestId('team-delete'));
    await fireEvent.press(await screen.findByTestId('team-delete-dialog-cancel'));
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/workspaces/w1')).toHaveLength(0);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('a 409 last-admin refusal is worded in the app language and keeps the dialog open', async () => {
    await openPeople('ADMIN', {
      'DELETE /api/v1/workspaces/w1': () => problem(409, 'Conflict', { code: 'last-admin', detail: 'The team needs an admin' }),
    });
    await fireEvent.press(screen.getByTestId('team-delete'));
    await fireEvent.press(await screen.findByTestId('team-delete-dialog-confirm'));
    expect(await screen.findByText(viTeam.team.lastAdmin)).toBeOnTheScreen();
    expect(screen.getByTestId('team-delete-dialog')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('a plain Member sees neither the rename field nor Delete', async () => {
    await openPeople('MEMBER');
    expect(screen.queryByTestId('team-rename-input')).toBeNull();
    expect(screen.queryByTestId('team-delete')).toBeNull();
    expect(screen.getByTestId('team-leave')).toBeOnTheScreen();
  });
});

describe('People avatars (X2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('draws the picture when the API sends avatarUrl, initials only otherwise', async () => {
    await renderSignedIn(<TeamPeopleScreen workspaceId="w1" />, {
      ...peopleRoutes('ADMIN'),
      'GET /api/v1/workspaces/w1/members': () => jsonResponse(200, [me, { ...bob, avatarUrl: '/api/v1/users/u-bob/avatar?v=2' }]),
    });
    const image = await screen.findByTestId('team-avatar-u-bob-image');
    expect(image.props.source).toEqual({ uri: `${API_URL}/api/v1/users/u-bob/avatar?v=2`, headers: { Authorization: expect.stringMatching(/^Bearer /) } });
    expect(screen.queryByTestId(`team-avatar-${testUser.id}-image`)).toBeNull();
    expect(screen.getByText('A')).toBeOnTheScreen();
  });
});

describe('Folders of a team (X2): rename', () => {
  const team = makeWorkspace({ id: 'w1', name: 'Công ty', role: 'MEMBER' });
  const folder = makeFolder({ id: 'f1', workspaceId: 'w1', name: 'Marketing' });
  const project = makeTeamProject({ id: 'tp1', name: 'Website', folderId: 'f1' });

  beforeEach(() => jest.clearAllMocks());

  async function openTeam(extra: ApiRoutes = {}) {
    const rendered = await renderSignedIn(<TeamScreen />, {
      'GET /api/v1/workspaces': () => jsonResponse(200, [team]),
      'GET /api/v1/workspaces/w1/projects': () => jsonResponse(200, [project]),
      'GET /api/v1/workspaces/w1/folders': () => jsonResponse(200, [folder]),
      ...extra,
    });
    await screen.findByTestId('team-project-tp1');
    return rendered;
  }

  it('the pencil opens the folder dialog with the current name and PATCHes the new one', async () => {
    const { fetchMock } = await openTeam({
      'PATCH /api/v1/folders/f1': () => jsonResponse(200, { ...folder, name: 'Truyền thông' }),
    });
    await fireEvent.press(screen.getByTestId('team-folder-rename-f1'));
    expect(screen.getByTestId('team-folder-name').props.value).toBe('Marketing');
    await fireEvent.changeText(screen.getByTestId('team-folder-name'), 'Truyền thông');
    await fireEvent.press(screen.getByTestId('team-folder-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/folders/f1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/folders/f1')[0].body).toEqual({ name: 'Truyền thông' });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces/w1/folders')).toHaveLength(0);
  });

  it('"New folder" after a rename starts empty and creates, not renames', async () => {
    const { fetchMock } = await openTeam({
      'POST /api/v1/workspaces/w1/folders': () => jsonResponse(201, makeFolder({ id: 'f2', name: 'Mới' })),
    });
    await fireEvent.press(screen.getByTestId('team-folder-rename-f1'));
    await fireEvent.press(screen.getByTestId('team-new-folder'));
    expect(screen.getByTestId('team-folder-name').props.value).toBe('');
    await fireEvent.changeText(screen.getByTestId('team-folder-name'), 'Mới');
    await fireEvent.press(screen.getByTestId('team-folder-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces/w1/folders')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/folders/f1')).toHaveLength(0);
  });

  it('an empty folder name is refused locally', async () => {
    const { fetchMock } = await openTeam();
    await fireEvent.press(screen.getByTestId('team-folder-rename-f1'));
    await fireEvent.changeText(screen.getByTestId('team-folder-name'), '  ');
    await fireEvent.press(screen.getByTestId('team-folder-submit'));
    expect(screen.getByText(viTeam.team.folderNameRequired)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/folders/f1')).toHaveLength(0);
  });
});

describe('Folder of a team project in the project form (X2)', () => {
  const folders = [makeFolder({ id: 'f1', workspaceId: 'w1', name: 'Marketing' }), makeFolder({ id: 'f2', workspaceId: 'w1', name: 'Kinh doanh' })];

  function routes(extra: ApiRoutes = {}): ApiRoutes {
    return {
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, makeProject({ id: 'p0' })]),
      'GET /api/v1/workspaces/w1/folders': () => jsonResponse(200, folders),
      ...extra,
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('creating a team project sends the chosen folderId; none chosen sends no folderId', async () => {
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen workspaceId="w1" />,
      routes({ 'POST /api/v1/projects': () => jsonResponse(201, makeSharedProject({ id: 'tp1' })) }),
    );
    expect(await screen.findByTestId('project-form-folder')).toBeOnTheScreen();
    expect(screen.getByText(viTeam.team.project.noFolder)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('project-form-name'), 'Website');
    await fireEvent.press(screen.getByTestId('project-form-folder'));
    await fireEvent.press(await screen.findByTestId('project-form-folder-f2'));
    expect(screen.getByText('Kinh doanh')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-form-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')[0].body).toMatchObject({ workspaceId: 'w1', access: 'TEAM', folderId: 'f2' });
  });

  it('a team without folders shows no folder field; a personal project never does', async () => {
    await renderSignedIn(<ProjectFormScreen workspaceId="w1" />, routes({ 'GET /api/v1/workspaces/w1/folders': () => jsonResponse(200, []) }));
    await screen.findByTestId('project-form-restricted');
    await waitFor(() => expect(screen.queryByTestId('project-form-folder')).toBeNull());
  });

  it('editing: moving to another folder and "No folder" send folderId only when it changed', async () => {
    const managed = makeSharedProject({ id: 'tp1', name: 'Website', workspaceId: 'w1', access: 'TEAM', canManage: true, folderId: 'f1' });
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen projectId="tp1" />,
      routes({ 'GET /api/v1/projects/tp1': () => jsonResponse(200, managed), 'PATCH /api/v1/projects/tp1': () => jsonResponse(200, managed) }),
    );
    await waitFor(() => expect(screen.getByTestId('project-form-name').props.value).toBe('Website'));
    expect(await screen.findByText('Marketing')).toBeOnTheScreen();

    // untouched: the PATCH carries no folderId (absent = keep)
    await fireEvent.press(screen.getByTestId('project-form-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/tp1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/tp1')[0].body).not.toHaveProperty('folderId');
  });

  it('editing: choosing "No folder" sends folderId null', async () => {
    const managed = makeSharedProject({ id: 'tp1', name: 'Website', workspaceId: 'w1', access: 'TEAM', canManage: true, folderId: 'f1' });
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen projectId="tp1" />,
      routes({ 'GET /api/v1/projects/tp1': () => jsonResponse(200, managed), 'PATCH /api/v1/projects/tp1': () => jsonResponse(200, managed) }),
    );
    await screen.findByText('Marketing');
    await fireEvent.press(screen.getByTestId('project-form-folder'));
    await fireEvent.press(await screen.findByTestId('project-form-folder-none'));
    await fireEvent.press(screen.getByTestId('project-form-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/tp1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/tp1')[0].body).toMatchObject({ folderId: null });
  });

  it('a member who cannot manage the project has no folder field', async () => {
    const plain = makeSharedProject({ id: 'tp2', name: 'Chung', workspaceId: 'w1', access: 'TEAM', canManage: false });
    await renderSignedIn(<ProjectFormScreen projectId="tp2" />, routes({ 'GET /api/v1/projects/tp2': () => jsonResponse(200, plain) }));
    await waitFor(() => expect(screen.getByTestId('project-form-name').props.value).toBe('Chung'));
    expect(screen.queryByTestId('project-form-folder')).toBeNull();
  });
});
