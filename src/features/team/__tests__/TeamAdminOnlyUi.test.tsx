import { screen } from '@testing-library/react-native';
import { jsonResponse } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { makeFolder, makeTeamProject, makeWorkspace } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { TeamScreen } from '../TeamScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));

const folder = makeFolder({ id: 'f1', workspaceId: 'w1', name: 'Marketing' });
const project = makeTeamProject({ id: 'tp1', name: 'Website', joined: true, folderId: 'f1' });

function routes(role: 'ADMIN' | 'MEMBER') {
  return {
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w1', name: 'Công ty', role })]),
    'GET /api/v1/workspaces/w1/projects': () => jsonResponse(200, [project]),
    'GET /api/v1/workspaces/w1/folders': () => jsonResponse(200, [folder]),
  };
}

const ADMIN_ONLY = ['team-new-project', 'team-new-folder', 'team-folder-rename-f1', 'team-folder-delete-f1'];

describe('Team tab — admin-only controls (AccessPolicy: only Admin creates team projects / folders)', () => {
  it.each(['MEMBER'] as const)('%s: sees projects and folders but none of the admin buttons', async (role) => {
    await renderSignedIn(<TeamScreen />, routes(role));
    await screen.findByTestId('team-project-tp1');
    expect(screen.getByTestId('team-people')).toBeOnTheScreen();
    for (const id of ADMIN_ONLY) expect(screen.queryByTestId(id)).toBeNull();
  });

  it('Admin: sees every admin button', async () => {
    await renderSignedIn(<TeamScreen />, routes('ADMIN'));
    await screen.findByTestId('team-project-tp1');
    for (const id of ADMIN_ONLY) expect(screen.getByTestId(id)).toBeOnTheScreen();
  });
});

describe('Team tab — review card follows the role of the chosen workspace', () => {
  const pending = (id: string, projectId: string) => makeTask({ id, projectId, reviewStatus: 'PENDING', reviewRequestedBy: 'u9' });
  const two = [
    makeWorkspace({ id: 'w1', name: 'Công ty', role: 'MEMBER' }),
    makeWorkspace({ id: 'w2', name: 'Hsjsk', role: 'ADMIN' }),
  ];
  const all = {
    'GET /api/v1/workspaces': () => jsonResponse(200, two),
    'GET /api/v1/workspaces/w1/projects': () => jsonResponse(200, [makeTeamProject({ id: 'tp1', name: 'Website' })]),
    'GET /api/v1/workspaces/w1/folders': () => jsonResponse(200, []),
    'GET /api/v1/workspaces/w2/projects': () => jsonResponse(200, [makeTeamProject({ id: 'tq1', name: 'Giải đấu' })]),
    'GET /api/v1/workspaces/w2/folders': () => jsonResponse(200, []),
  };

  it('a request waiting in another team does not count here (Admin team with nothing waiting says so)', async () => {
    await renderSignedIn(<TeamScreen initialWorkspaceId="w2" />, {
      ...all,
      'GET /api/v1/tasks': () => jsonResponse(200, page([pending('t1', 'tp1')])),
    });
    expect(await screen.findByText('Không có công việc nào đang chờ duyệt')).toBeOnTheScreen();
    expect(screen.getByText('Chờ duyệt')).toBeOnTheScreen();
    expect(screen.queryByText('Đang chờ duyệt của tôi')).toBeNull();
  });

  it('Member team shows only its own count, in Member wording', async () => {
    await renderSignedIn(<TeamScreen initialWorkspaceId="w1" />, {
      ...all,
      'GET /api/v1/tasks': () => jsonResponse(200, page([pending('t1', 'tp1'), pending('t2', 'tq1')])),
    });
    expect(await screen.findByText('Đang chờ duyệt của tôi')).toBeOnTheScreen();
    expect(screen.getByText('1 công việc đang chờ duyệt')).toBeOnTheScreen();
  });
});
