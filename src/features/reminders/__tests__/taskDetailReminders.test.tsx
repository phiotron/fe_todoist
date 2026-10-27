import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeTask } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { TaskDetailScreen } from '../../tasks/detail/TaskDetailScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const ARCHIVED = '2026-10-01T00:00:00Z';
const REMINDER = { id: 'r-2', taskId: 't1', type: 'RELATIVE', at: null, minuteOffset: 30, createdAt: '2026-10-23T03:00:00Z' };

function detailRoutes(task: ReturnType<typeof makeTask>, project = makeProject({ id: 'p1', name: 'Nhà' })) {
  return {
    'GET /api/v1/tasks/t1': () => jsonResponse(200, task),
    'GET /api/v1/tasks/t1/subtasks': () => jsonResponse(200, []),
    'GET /api/v1/tasks/t1/reminders': () => jsonResponse(200, [REMINDER]),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    'GET /api/v1/projects/p1': () => jsonResponse(200, project),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
  };
}

describe('task detail', () => {
  it('has a Reminders chip (before "Chuyển tới") that shows the reminder value', async () => {
    await renderSignedIn(<TaskDetailScreen taskId="t1" />, detailRoutes(makeTask({ id: 't1', projectId: 'p1', dueDatetime: '2026-10-24T10:00:00' })));

    expect(await screen.findByTestId('task-reminder-chip')).toHaveTextContent(/30 phút trước/);
    expect(screen.getByTestId('task-move-chip')).toBeOnTheScreen();
  });

  it('opens the reminders of a completed task read-only (the screen readOnly reaches the chip)', async () => {
    await renderSignedIn(
      <TaskDetailScreen taskId="t1" />,
      detailRoutes(makeTask({ id: 't1', projectId: 'p1', dueDatetime: '2026-10-24T10:00:00', completedAt: '2026-10-23T02:00:00Z' })),
    );

    await fireEvent.press(await screen.findByTestId('task-reminder-chip'));

    expect(screen.getAllByText('30 phút trước').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('reminder-add-absolute')).toBeNull();
  });

  it('opens the reminders of a task in an archived project read-only', async () => {
    await renderSignedIn(
      <TaskDetailScreen taskId="t1" />,
      detailRoutes(makeTask({ id: 't1', projectId: 'p1', dueDatetime: '2026-10-24T10:00:00' }), makeProject({ id: 'p1', name: 'Nhà', archivedAt: ARCHIVED })),
    );

    await fireEvent.press(await screen.findByTestId('task-reminder-chip'));

    await waitFor(() => expect(screen.queryByTestId('reminder-add-absolute')).toBeNull());
  });
});
