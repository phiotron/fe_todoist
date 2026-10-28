import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { setUpcomingDay } from '../upcomingDayStore';
import { UpcomingScreen } from '../UpcomingScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// Friday 23/10/2026, 10:00 in Vietnam.
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));
jest.mock('../../settings/useDateSettings', () => ({ useDateSettings: () => ({ startDay: 1, nextWeek: 1, weekendStartDay: 6 }) }));

const o = makeTask({ id: 'o', content: 'Nộp thuế', dueDate: '2026-10-21', version: 2 });
const timed = makeTask({ id: 'u1', content: 'Đá bóng', dueDatetime: '2026-10-24T14:30:00', durationMinutes: 45, version: 7 });
const allDay = makeTask({ id: 'u2', content: 'Sinh nhật', dueDate: '2026-10-24', version: 1 });
const later = makeTask({ id: 'u3', content: 'Khám răng', dueDate: '2026-10-26' });

function routes(): ApiRoutes {
  const patch = (task: typeof timed) => (request: { body: unknown }) =>
    jsonResponse(200, { ...task, ...(request.body as object), version: task.version + 1 });
  return {
    'GET /api/v1/tasks': (request) =>
      request.query.get('view') === 'overdue' ? jsonResponse(200, page([o])) : jsonResponse(200, page([timed, allDay, later])),
    'PATCH /api/v1/tasks/u1': patch(timed),
    'PATCH /api/v1/tasks/u2': patch(allDay),
    'PATCH /api/v1/tasks/o': patch(o),
    'POST /api/v1/reorder': (request) => jsonResponse(200, { ...(request.body as object), sortOrder: 1024 }),
    ...viewOptionsRoutes(['UPCOMING']),
  };
}

async function open() {
  setUpcomingDay(undefined);
  const rendered = await renderSignedIn(<UpcomingScreen />, routes());
  await screen.findByText('Khám răng');
  return rendered;
}

const upper = { x: 10, y: 5, width: 300, height: 40 };
const lower = { x: 10, y: 35, width: 300, height: 40 };

describe('Upcoming — drag and drop in the list', () => {
  it('another day keeps the time and the duration, lands where dropped in that day, and offers Undo', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-start-d-2026-10-26'), 'drop', { taskIds: ['u1'], task: timed }, upper);

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/u1')[0].body).toEqual({
      version: 7,
      dueDate: null,
      dueDatetime: '2026-10-26T14:30:00',
      durationMinutes: 45,
    });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK_DAY', id: 'u1', afterId: null });

    expect(await screen.findByText('Đã dời sang 26/10')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('snackbar-action'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/u1')).toHaveLength(2));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/u1')[1].body).toEqual({
      version: 8,
      dueDate: null,
      dueDatetime: '2026-10-24T14:30:00',
      durationMinutes: 45,
      dueString: null,
    });
  });

  it('a day of the week strip takes drops too (end of that day)', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-week-2026-10-25'), 'drop', { taskIds: ['u2'], task: allDay }, upper);
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/u2')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/u2')[0].body).toEqual({
      version: 1,
      dueDate: '2026-10-25',
      dueDatetime: null,
      durationMinutes: null,
    });
  });

  it('inside one day only the day order changes', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-task-u2'), 'drop', { taskIds: ['u1'], task: timed }, lower);
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK_DAY', id: 'u1', afterId: 'u2' });
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/u1')).toHaveLength(0);
  });

  it('an overdue task dropped on a day moves to that day (Upcoming keeps the time rule)', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-task-u2'), 'drop', { taskIds: ['o'], task: o }, lower);
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/o')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/o')[0].body).toEqual({
      version: 2,
      dueDate: '2026-10-24',
      dueDatetime: null,
      durationMinutes: null,
    });
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK_DAY', id: 'o', afterId: 'u2' });
  });
});
