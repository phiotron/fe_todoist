import { screen } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';
import type { Project } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeSharedProject } from '../../../test/m8aFixtures';
import { createTestQueryClient } from '../../../test/render';
import { renderSignedIn } from '../../../test/screen';
import { meQueryKey } from '../../auth/session';
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

const team = {
  ...makeSharedProject({ id: 'pt', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }),
  capabilities: { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false, canReview: false },
} as Project;

function List() {
  const { query, tasks } = useTaskList({ view: 'today' });
  return (
    <SelectionScope>
      <TaskListView rows={taskRows(tasks)} query={query} />
    </SelectionScope>
  );
}

/** Observers on every query a row could open: it must not depend on how many rows (or pending rows) the list has. */
async function observers(n: number, pending: boolean): Promise<number[]> {
  const items = Array.from({ length: n }, (_, i) =>
    makeTask({ id: `t${i}`, projectId: 'pt', content: `Việc ${i}`, ...(pending ? { reviewStatus: 'PENDING', reviewRequestedBy: 'u1' } : {}) }),
  );
  const queryClient: QueryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.projects.list(false), [inboxProject, team]);
  const { unmount } = await renderSignedIn(<List />, { 'GET /api/v1/tasks': () => jsonResponse(200, page(items)) }, queryClient);
  await screen.findByText('Việc 0');
  const cache = queryClient.getQueryCache();
  const counts = [meQueryKey, queryKeys.projects.list(false), queryKeys.workspaces.list()].map(
    (key) => cache.find({ queryKey: key, exact: true })?.getObserversCount() ?? 0,
  );
  unmount();
  return counts;
}

describe('review adds no hook / observer per row', () => {
  it('observers on me / projects / workspaces are the same for 3 plain rows and 12 pending rows', async () => {
    const few = await observers(3, false);
    const many = await observers(12, true);
    expect(many).toEqual(few);
  });
});
