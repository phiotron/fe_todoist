import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Project, Task } from '../../../../api/models';
import viTeam from '../../../../i18n/locales/vi/team.json';
import { requestsTo, type ApiRoutes } from '../../../../test/apiRoutes';
import { jsonResponse } from '../../../../test/http';
import { inboxProject, makeTask, taskChange } from '../../../../test/m1Fixtures';
import { makeSharedProject } from '../../../../test/m8aFixtures';
import { renderSignedIn } from '../../../../test/screen';
import { TaskDetailScreen } from '../TaskDetailScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const project = {
  ...makeSharedProject({ id: 'p1', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }),
  capabilities: { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false },
} as Project;

let server: Task;

function routes(): ApiRoutes {
  return {
    'GET /api/v1/tasks/t1': () => jsonResponse(200, server),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    'GET /api/v1/projects/p1': () => jsonResponse(200, project),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
    'GET /api/v1/tasks/t1/subtasks': () => jsonResponse(200, [makeTask({ id: 'k1', projectId: 'p1', parentId: 't1', content: 'Con' })]),
    'GET /api/v1/tasks/t1/comments': () => jsonResponse(200, []),
    'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange({ ...server, completedAt: '2026-10-23T03:00:00Z' })),
    'POST /api/v1/tasks/k1/close': () => jsonResponse(200, taskChange(makeTask({ id: 'k1', projectId: 'p1', parentId: 't1', completedAt: '2026-10-23T03:00:00Z' }))),
  };
}

async function open() {
  const rendered = await renderSignedIn(<TaskDetailScreen taskId="t1" />, routes());
  await waitFor(() => expect(screen.getByTestId('task-content').props.value).toBe('Việc nhóm'));
  await screen.findByTestId('task-team-limited-notice');
  return rendered;
}

describe('TaskDetailScreen — task of a team project where I am a Member (PERM)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    server = makeTask({ id: 't1', projectId: 'p1', content: 'Việc nhóm', subtaskCount: 1, version: 2 });
  });

  it('is read only: notice, name / description locked, no comment box, no add sub-task', async () => {
    await open();
    expect(screen.getByTestId('task-team-limited-notice')).toHaveTextContent(viTeam.team.adminOnly.notice);
    expect(screen.getByTestId('task-content').props.editable).toBe(false);
    expect(screen.getByTestId('task-description').props.editable).toBe(false);
    expect(screen.queryByTestId('comment-composer')).toBeNull();
    expect(screen.queryByTestId('subtask-add')).toBeNull();
  });

  it('the menu has no Delete / Duplicate / Add sub-task / Email', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('task-menu-open'));
    expect(screen.queryByTestId('task-menu-delete')).toBeNull();
    expect(screen.queryByTestId('task-menu-duplicate')).toBeNull();
    expect(screen.queryByTestId('task-menu-add-subtask')).toBeNull();
    expect(screen.queryByTestId('task-menu-email')).toBeNull();
    expect(screen.getByTestId('task-menu-copy-link')).toBeOnTheScreen();
  });

  it('the big circle and the sub-task circles still complete', async () => {
    const { fetchMock } = await open();
    await fireEvent.press(await screen.findByTestId('subtask-toggle-k1'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/k1/close')).toHaveLength(1));
    await fireEvent.press(screen.getByTestId('task-toggle'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')).toHaveLength(1));
  });
});
