import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { makeViewOptions } from '../../../test/m2Fixtures';
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

const overdueTimed = makeTask({
  id: 'o',
  content: 'Nộp thuế',
  version: 4,
  dueDatetime: '2026-10-21T09:15:00',
  durationMinutes: 30,
  dueString: 'thứ 4 9h15',
  recurrenceRule: 'FREQ=WEEKLY',
  isRecurring: true,
} as Parameters<typeof makeTask>[0]);
const t1 = makeTask({ id: 't1', content: 'Đi chợ', dueDate: '2026-10-23' });
const t2 = makeTask({ id: 't2', content: 'Họp nhóm', dueDatetime: '2026-10-23T17:00:00' });

function routes(extra: ApiRoutes = {}, sortBy: 'DATE' | 'PRIORITY' = 'DATE'): ApiRoutes {
  return {
    ...viewOptionsRoutes(['TODAY'], sortBy === 'DATE' ? [] : [makeViewOptions('TODAY', { sortBy })]),
    'GET /api/v1/tasks': () => jsonResponse(200, page([overdueTimed, t1, t2])),
    'PATCH /api/v1/tasks/o': (request) => jsonResponse(200, { ...overdueTimed, ...(request.body as object), version: 5 }),
    'POST /api/v1/reorder': (request) => jsonResponse(200, { ...(request.body as object), sortOrder: 1024 }),
    ...extra,
  };
}

async function open(sortBy: 'DATE' | 'PRIORITY' = 'DATE') {
  const rendered = await renderSignedIn(<TodayScreen />, routes({}, sortBy));
  await screen.findByText('Họp nhóm');
  return rendered;
}

const upper = { x: 10, y: 5, width: 300, height: 40 };
const lower = { x: 10, y: 35, width: 300, height: 40 };

describe('Today — drag and drop', () => {
  it('Overdue → today: due = today WITHOUT time (repeat rule untouched), placed in the day order, with Undo', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-task-t2'), 'drop', { taskIds: ['o'], task: overdueTimed }, upper);

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(1));
    const patch = requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/o');
    expect(patch).toHaveLength(1);
    expect(patch[0].body).toEqual({ version: 4, dueDate: '2026-10-23', dueDatetime: null, durationMinutes: null });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK_DAY', id: 'o', afterId: 't1' });

    expect(await screen.findByText('Đã dời sang Hôm nay')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('snackbar-action'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/o')).toHaveLength(2));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/o')[1].body).toEqual({
      version: 5,
      dueDate: null,
      dueDatetime: '2026-10-21T09:15:00',
      durationMinutes: 30,
      dueString: 'thứ 4 9h15',
    });
  });

  it('dropping an overdue task on the today header puts it first', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-start-today'), 'drop', { taskIds: ['o'], task: overdueTimed }, upper);
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK_DAY', id: 'o', afterId: null });
  });

  it('inside today only the day order changes (POST reorder TASK_DAY, no PATCH)', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-task-t2'), 'drop', { taskIds: ['t1'], task: t1 }, lower);
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK_DAY', id: 't1', afterId: 't2' });
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/t1')).toHaveLength(0);
  });

  it('a drop into the Overdue block does nothing', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-task-o'), 'drop', { taskIds: ['t1'], task: t1 }, upper);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(0);
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/t1')).toHaveLength(0);
  });

  it('sorted by priority: Overdue → today still reschedules, but there is no day order to change', async () => {
    const { fetchMock } = await open('PRIORITY');
    await fireEvent(screen.getByTestId('drop-start-today'), 'drop', { taskIds: ['o'], task: overdueTimed }, upper);
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/o')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(0);
  });

  it('a long press on a today task still enters the multi-select mode', async () => {
    await open();
    await fireEvent(screen.getByTestId('task-row-t1'), 'longPress');
    expect(screen.getByTestId('selection-count')).toBeOnTheScreen();
  });
});
