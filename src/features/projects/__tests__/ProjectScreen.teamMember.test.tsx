import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Project } from '../../../api/models';
import viTeam from '../../../i18n/locales/vi/team.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeTask, page, taskChange } from '../../../test/m1Fixtures';
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

const MEMBER = { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false };
const ADMIN = { canEditTasks: true, canCompleteTasks: true, canManageSections: true, canComment: true };

const task = makeTask({ id: 'a', projectId: 'p1', content: 'Việc chung' });

function teamProject(capabilities: typeof MEMBER): Project {
  return {
    ...makeSharedProject({ id: 'p1', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }),
    capabilities,
  } as Project;
}

function routes(project: Project): ApiRoutes {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    'GET /api/v1/projects/p1': () => jsonResponse(200, project),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
    'GET /api/v1/tasks': () => jsonResponse(200, page([task])),
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w1', role: 'MEMBER' })]),
    'POST /api/v1/tasks/a/close': () => jsonResponse(200, taskChange({ ...task, completedAt: '2026-10-23T03:00:00Z' })),
    ...viewOptionsRoutes(['project:p1']),
  };
}

async function open(capabilities: typeof MEMBER) {
  const rendered = await renderSignedIn(<ProjectScreen projectId="p1" />, routes(teamProject(capabilities)));
  await screen.findByText('Việc chung');
  return rendered;
}

describe('ProjectScreen — team Member / Guest (PERM: only complete tasks)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the "only admins edit" notice; no + button, no add-task / add-section rows', async () => {
    await open(MEMBER);
    expect(screen.getByTestId('project-team-limited-notice')).toHaveTextContent(viTeam.team.adminOnly.notice);
    expect(screen.queryByTestId('project-fab')).toBeNull();
    expect(screen.queryByTestId('project-add-none')).toBeNull();
    expect(screen.queryByTestId('project-add-section')).toBeNull();
    expect(screen.queryByTestId('project-preview-banner')).toBeNull();
  });

  it('the menu keeps reading / leaving / selecting but drops every edit', async () => {
    await open(MEMBER);
    await fireEvent.press(screen.getByTestId('project-menu-open'));
    expect(screen.queryByTestId('project-menu-edit')).toBeNull();
    expect(screen.queryByTestId('project-menu-add-section')).toBeNull();
    expect(screen.queryByTestId('project-menu-reorder-tasks')).toBeNull();
    expect(screen.queryByTestId('project-menu-reorder-sections')).toBeNull();
    expect(screen.queryByTestId('project-menu-archive')).toBeNull();
    expect(screen.getByTestId('project-menu-comments')).toBeOnTheScreen();
    expect(screen.getByTestId('project-menu-leave')).toBeOnTheScreen();
    expect(screen.getByTestId('project-menu-select')).toBeOnTheScreen(); // select to complete many
  });

  it('the circle still completes the task', async () => {
    const { fetchMock } = await open(MEMBER);
    await fireEvent.press(screen.getByTestId('task-toggle-a'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/a/close')).toHaveLength(1));
  });

  it('an Admin of the team sees the usual screen (no notice, + button)', async () => {
    await open(ADMIN);
    expect(screen.queryByTestId('project-team-limited-notice')).toBeNull();
    expect(screen.getByTestId('project-fab')).toBeOnTheScreen();
  });
});
