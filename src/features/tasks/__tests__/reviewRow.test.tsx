import { screen } from '@testing-library/react-native';
import type { Project } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { testUser } from '../../../test/fixtures';
import { makeSharedProject } from '../../../test/m8aFixtures';
import { createTestQueryClient } from '../../../test/render';
import { renderSignedIn } from '../../../test/screen';
import { SelectionScope } from '../SelectionScope';
import { TaskListView } from '../TaskListView';
import { taskRows } from '../taskRows';
import { useTaskList } from '../useTaskList';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const base = makeSharedProject({ id: 'pt', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' });
const memberProject = {
  ...base,
  capabilities: { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false, canReview: false },
} as Project;
const adminProject = {
  ...base,
  capabilities: { canEditTasks: true, canCompleteTasks: true, canManageSections: true, canComment: true, canReview: true },
} as Project;
const mine = makeProject({ id: 'p1', name: 'Của tôi' });

const REQ = { reviewStatus: 'PENDING', reviewRequestedBy: testUser.id, reviewRequestedAt: '2026-10-23T02:00:00Z' } as const;
const tasks = [
  makeTask({ id: 'own', projectId: 'pt', content: 'Việc của tôi chờ', ...REQ }),
  makeTask({ id: 'other', projectId: 'pt', content: 'Việc người khác chờ', ...REQ, reviewRequestedBy: 'someone-else' }),
  makeTask({ id: 'done', projectId: 'pt', content: 'Việc đã xong', completedAt: '2026-10-22T02:00:00Z' }),
  makeTask({ id: 'plain', projectId: 'p1', content: 'Việc riêng' }),
];

function Today() {
  const { query, tasks: list } = useTaskList({ view: 'today' });
  return (
    <SelectionScope>
      <TaskListView rows={taskRows(list)} query={query} />
    </SelectionScope>
  );
}

async function open(team: Project) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.projects.list(false), [inboxProject, mine, team]);
  const rendered = await renderSignedIn(
    <Today />,
    {
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, mine, team]),
    },
    queryClient,
  );
  await screen.findByText('Việc của tôi chờ');
  return rendered;
}

describe('TaskRow / TaskMeta — task waiting for review', () => {
  it('shows the "Chờ duyệt" label and a pending circle (not checked, not in "done")', async () => {
    await open(memberProject);
    expect(screen.getByTestId('task-review-own')).toBeOnTheScreen();
    expect(screen.getAllByText('Chờ duyệt').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('task-toggle-own').props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId('task-toggle-own-pending')).toBeOnTheScreen();
    expect(screen.queryByTestId('task-review-plain')).toBeNull();
    expect(screen.queryByTestId('task-toggle-plain-pending')).toBeNull();
  });

  it('Member: my pending circle cancels (label), somebody else\'s pending is locked', async () => {
    await open(memberProject);
    expect(screen.getByTestId('task-toggle-own').props.accessibilityLabel).toBe('Huỷ yêu cầu duyệt Việc của tôi chờ');
    expect(screen.getByTestId('task-toggle-own').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByTestId('task-toggle-other').props.accessibilityState.disabled).toBe(true);
  });

  it('Member cannot reopen a completed task of the team project; a personal one is untouched', async () => {
    await open(memberProject);
    expect(screen.getByTestId('task-toggle-done').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('task-toggle-plain').props.accessibilityState.disabled).toBe(false);
  });

  it('Admin: every circle stays usable, also on a pending task and on a completed one', async () => {
    await open(adminProject);
    expect(screen.getByTestId('task-toggle-other').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByTestId('task-toggle-done').props.accessibilityState.disabled).toBe(false);
  });
});
