import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Project, Task } from '../../../../api/models';
import { testUser } from '../../../../test/fixtures';
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
  ...makeSharedProject({ id: 'p1', name: 'NhÃ³m', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }),
  capabilities: { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false, canReview: false },
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

describe('TaskDetailScreen — review circle (Member of a team project)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('my pending request: clock circle, tapping it cancels the request', async () => {
    server = makeTask({ id: 't1', projectId: 'p1', content: 'Việc nhóm', subtaskCount: 1, version: 2, reviewStatus: 'PENDING', reviewRequestedBy: testUser.id, reviewRequestedAt: '2026-10-23T02:00:00Z' });
    const { fetchMock, setRoutes } = await open();
    setRoutes({ ...routes(), 'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange({ ...server, reviewStatus: 'NONE', reviewRequestedBy: null })) });
    expect(screen.getByTestId('task-toggle-pending')).toBeOnTheScreen();
    expect(screen.getByTestId('task-toggle').props.accessibilityLabel).toBe('Huỷ yêu cầu duyệt');
    await fireEvent.press(screen.getByTestId('task-toggle'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')).toHaveLength(1));
    expect(await screen.findByText('Đã huỷ yêu cầu duyệt')).toBeOnTheScreen();
  });

  it('a task completed by an admin cannot be reopened by the Member (circle locked)', async () => {
    server = makeTask({ id: 't1', projectId: 'p1', content: 'Việc nhóm', version: 2, completedAt: '2026-10-22T03:00:00Z' });
    await open();
    expect(screen.getByTestId('task-toggle').props.accessibilityState.disabled).toBe(true);
  });
});
