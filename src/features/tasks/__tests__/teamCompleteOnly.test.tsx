import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Project } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { affected, inboxProject, makeProject, makeTask, page, taskChange } from '../../../test/m1Fixtures';
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
jest.mock('../swipe', () => ({
  ...jest.requireActual('../swipe'),
  useSwipeSettings: () => ({ right: 'SCHEDULE', left: 'DELETE' }),
}));

const teamProject = {
  ...makeSharedProject({ id: 'pt', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }),
  capabilities: { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false },
} as Project;
const mine = makeProject({ id: 'p1', name: 'Của tôi' });
const teamTask = makeTask({ id: 't1', projectId: 'pt', content: 'Việc nhóm' });
const myTask = makeTask({ id: 't2', projectId: 'p1', content: 'Việc riêng' });

function Today() {
  const { query, tasks } = useTaskList({ view: 'today' });
  return (
    <SelectionScope>
      <TaskListView rows={taskRows(tasks)} query={query} />
    </SelectionScope>
  );
}

function routes(): ApiRoutes {
  return {
    'GET /api/v1/tasks': () => jsonResponse(200, page([teamTask, myTask])),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, mine, teamProject]),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
    'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange({ ...teamTask, completedAt: '2026-10-23T03:00:00Z' })),
    'POST /api/v1/tasks/batch': () => jsonResponse(200, affected(['t1'])),
  };
}

async function open() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.projects.list(false), [inboxProject, mine, teamProject]);
  const rendered = await renderSignedIn(<Today />, routes(), queryClient);
  await screen.findByText('Việc nhóm');
  return rendered;
}

describe('Today — task of a team project where I am a Member (PERM)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('the circle completes it', async () => {
    const { fetchMock } = await open();
    await fireEvent.press(screen.getByTestId('task-toggle-t1'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')).toHaveLength(1));
  });

  it('no Schedule / Delete swipe on it (my own task keeps them)', async () => {
    await open();
    expect(screen.queryByTestId('task-swipe-t1')).toBeNull();
    expect(screen.getByTestId('task-swipe-t2')).toBeOnTheScreen();
  });

  it('multi-select with it offers only Complete', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('task-row-t1'), 'longPress');
    expect(screen.getByTestId('selection-complete')).toBeOnTheScreen();
    expect(screen.queryByTestId('selection-schedule')).toBeNull();
    expect(screen.queryByTestId('selection-priority')).toBeNull();
    expect(screen.queryByTestId('selection-move')).toBeNull();
    expect(screen.queryByTestId('selection-delete')).toBeNull();
    await fireEvent.press(screen.getByTestId('selection-complete'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0].body).toMatchObject({ action: 'CLOSE', taskIds: ['t1'] });
  });

  it('selecting only my own task keeps every action', async () => {
    await open();
    await fireEvent(screen.getByTestId('task-row-t2'), 'longPress');
    expect(screen.getByTestId('selection-schedule')).toBeOnTheScreen();
    expect(screen.getByTestId('selection-delete')).toBeOnTheScreen();
  });
});
