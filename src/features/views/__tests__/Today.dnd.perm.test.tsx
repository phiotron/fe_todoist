import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Project } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { affected, inboxProject, makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeSharedProject } from '../../../test/m8aFixtures';
import { createTestQueryClient } from '../../../test/render';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { TodayScreen } from '../TodayScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// Friday 23/10/2026, 10:00 in Vietnam.
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

// PERM × DND: a joined Member of a team project may only complete its tasks — dragging them is off.
const teamProject = {
  ...makeSharedProject({ id: 'pt', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }),
  capabilities: { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false },
} as Project;
const mine = makeProject({ id: 'p1', name: 'Của tôi' });
const teamOverdue = makeTask({ id: 'o', projectId: 'pt', content: 'Báo cáo nhóm', dueDate: '2026-10-21' });
const myOverdue = makeTask({ id: 'm', projectId: 'p1', content: 'Nộp thuế', dueDate: '2026-10-20' });
const t1 = makeTask({ id: 't1', projectId: 'p1', content: 'Đi chợ', dueDate: '2026-10-23' });

function routes(): ApiRoutes {
  return {
    ...viewOptionsRoutes(['TODAY'], []),
    'GET /api/v1/tasks': () => jsonResponse(200, page([teamOverdue, myOverdue, t1])),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, mine, teamProject]),
    'PATCH /api/v1/tasks/o': (request) => jsonResponse(200, { ...teamOverdue, ...(request.body as object), version: 2 }),
    'PATCH /api/v1/tasks/m': (request) => jsonResponse(200, { ...myOverdue, ...(request.body as object), version: 2 }),
    'POST /api/v1/reorder': (request) => jsonResponse(200, { ...(request.body as object), sortOrder: 1024 }),
    'POST /api/v1/tasks/batch': () => jsonResponse(200, affected(['o'])),
  };
}

async function open() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.projects.list(false), [inboxProject, mine, teamProject]);
  const rendered = await renderSignedIn(<TodayScreen />, routes(), queryClient);
  await screen.findByText('Báo cáo nhóm');
  return rendered;
}

const upper = { x: 10, y: 5, width: 300, height: 40 };
const at = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y } });

describe('Today — drag and drop vs. team permissions (PERM × DND)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Overdue → today with a team task of a Member is refused: no PATCH, no reorder', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-start-today'), 'drop', { taskIds: ['o'], task: teamOverdue }, upper);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/o')).toHaveLength(0);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(0);
  });

  it('my own overdue task still moves to today', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-start-today'), 'drop', { taskIds: ['m'], task: myOverdue }, upper);
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/m')).toHaveLength(1));
  });

  it('the team task row is not draggable (plain pressable row); my own overdue task is', async () => {
    await open();
    // Draggable claims moves once lifted (onMoveShouldSetResponder); the plain Pressable row has no such handler.
    expect(screen.getByTestId('task-row-o').props.onMoveShouldSetResponder).toBeUndefined();
    const own = screen.getByTestId('task-row-m');
    expect(typeof own.props.onMoveShouldSetResponder).toBe('function');
    await fireEvent(own, 'responderGrant', at(10, 10));
    expect(await screen.findByTestId('drag-ghost')).toBeTruthy();
    await fireEvent(own, 'responderTerminate', at(10, 10));
    await waitFor(() => expect(screen.queryByTestId('drag-ghost')).toBeNull());
  });

  it('a long press on the team task still enters the multi-select, offering only Complete', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('task-row-o'), 'longPress');
    expect(screen.getByTestId('selection-count')).toBeOnTheScreen();
    expect(screen.getByTestId('selection-complete')).toBeOnTheScreen();
    expect(screen.queryByTestId('selection-schedule')).toBeNull();
    expect(screen.queryByTestId('selection-move')).toBeNull();
    expect(screen.queryByTestId('selection-delete')).toBeNull();
    await fireEvent.press(screen.getByTestId('selection-complete'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0].body).toMatchObject({ action: 'CLOSE', taskIds: ['o'] });
  });
});
