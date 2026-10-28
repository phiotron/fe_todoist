import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { daysBetween } from '../../../lib/dates';
import { requestsTo, type RoutedRequest } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { affected, makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { HOUR_HEIGHT } from '../calendarModel';
import { CalendarView, setCalendarMode } from '../CalendarView';
import { allTasksScope, filterScope, projectScope } from '../useCalendarTasks';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const FILTERS = {};

/** GET tasks: calendar window → one timed task on `from`; the "no date" list → one undated task. */
function routes(extra: Record<string, () => Response> = {}) {
  return {
    'GET /api/v1/tasks': (request: RoutedRequest) => {
      if (request.query.get('view') === 'calendar') {
        return jsonResponse(200, page([makeTask({ id: 'timed', content: 'Họp nhóm', dueDate: null, dueDatetime: `${request.query.get('from')}T10:00:00`, version: 4 })]));
      }
      return jsonResponse(200, page([makeTask({ id: 'undated', content: 'Chưa có ngày', dueDate: null, dueDatetime: null })]));
    },
    'PATCH /api/v1/tasks/timed': () => jsonResponse(200, makeTask({ id: 'timed' })),
    'POST /api/v1/tasks/batch': () => jsonResponse(200, affected(['undated'])),
    ...extra,
  };
}

const dayOf = (testID: string) => testID.replace(/^calendar-[a-z]+-/, '');

describe('CalendarView', () => {
  beforeEach(() => setCalendarMode('WEEK'));

  it('loads the window of the mode with view=calendar and no sort / group', async () => {
    const { fetchMock } = await renderSignedIn(<CalendarView scope={projectScope('p-1')} filters={FILTERS} />, routes());
    expect(await screen.findByText(/Họp nhóm/)).toBeTruthy();
    const request = requestsTo(fetchMock, 'GET', '/api/v1/tasks')[0];
    expect(request.query.get('view')).toBe('calendar');
    expect(request.query.get('projectId')).toBe('p-1');
    expect(daysBetween(request.query.get('from') as string, request.query.get('to') as string)).toBe(6);
    for (const name of ['sort', 'order', 'group']) expect(request.query.get(name)).toBeNull();
  });

  it('sends only the Display filters of the view, and never "no date"', async () => {
    const { fetchMock } = await renderSignedIn(
      <CalendarView scope={allTasksScope()} filters={{ filterPriority: 1, filterDue: 'no_date' }} />,
      routes(),
    );
    await screen.findByText(/Họp nhóm/);
    const query = requestsTo(fetchMock, 'GET', '/api/v1/tasks')[0].query;
    expect(query.get('filterPriority')).toBe('1');
    expect(query.get('filterDue')).toBeNull();
  });

  it('a filter with commas loads one list per part', async () => {
    const { fetchMock } = await renderSignedIn(<CalendarView scope={filterScope(['p1', 'p2'])} filters={FILTERS} />, routes());
    await screen.findByText(/Họp nhóm/);
    const filters = requestsTo(fetchMock, 'GET', '/api/v1/tasks').map((request) => request.query.get('filter'));
    expect(filters.sort()).toEqual(['p1', 'p2']);
    expect(screen.getAllByText(/Họp nhóm/)).toHaveLength(1); // the same task from two parts shows once
  });

  it('dropping on a time slot PATCHes due + duration 30 with the task version', async () => {
    const { fetchMock } = await renderSignedIn(<CalendarView scope={allTasksScope()} filters={FILTERS} />, routes());
    await screen.findByText(/Họp nhóm/);
    const zones = screen.getAllByTestId(/^calendar-slots-/);
    const day = dayOf(zones[1].props.testID);
    const task = makeTask({ id: 'timed', version: 4, durationMinutes: null });

    await fireEvent(zones[1], 'drop', { taskIds: ['timed'], task }, { x: 5, y: HOUR_HEIGHT * 9 + 3 });

    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/timed')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/timed')[0].body).toEqual({
      version: 4,
      dueDatetime: `${day}T09:00:00`,
      durationMinutes: 30,
    });
  });

  it('dropping on another day schedules it with one batch request; on its own day nothing is sent', async () => {
    const { fetchMock } = await renderSignedIn(<CalendarView scope={allTasksScope()} filters={FILTERS} />, routes());
    await screen.findByText(/Họp nhóm/);
    const zones = screen.getAllByTestId(/^calendar-allday-/);
    const own = dayOf(zones[0].props.testID);
    const other = dayOf(zones[2].props.testID);
    const task = makeTask({ id: 'timed', dueDate: null, dueDatetime: `${own}T10:00:00` });

    await fireEvent(zones[0], 'drop', { taskIds: ['timed'], task }, { x: 1, y: 1 });
    await fireEvent(zones[2], 'drop', { taskIds: ['timed'], task }, { x: 1, y: 1 });

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0].body).toEqual({ action: 'SCHEDULE', taskIds: ['timed'], date: other });
  });

  it('switches modes: month asks for whole weeks (≤ 42 days), agenda for 14 days', async () => {
    const { fetchMock } = await renderSignedIn(<CalendarView scope={allTasksScope()} filters={FILTERS} />, routes());
    await screen.findByText(/Họp nhóm/);

    await fireEvent.press(screen.getByTestId('calendar-mode-MONTH'));
    expect(await screen.findByTestId('calendar-month')).toBeTruthy();
    await waitFor(() => {
      const last = requestsTo(fetchMock, 'GET', '/api/v1/tasks').at(-1) as RoutedRequest;
      const span = daysBetween(last.query.get('from') as string, last.query.get('to') as string) + 1;
      expect([35, 42]).toContain(span);
    });

    await fireEvent.press(screen.getByTestId('calendar-mode-AGENDA'));
    expect(await screen.findByTestId('calendar-agenda')).toBeTruthy();
    await waitFor(() => {
      const last = requestsTo(fetchMock, 'GET', '/api/v1/tasks').at(-1) as RoutedRequest;
      expect(daysBetween(last.query.get('from') as string, last.query.get('to') as string)).toBe(13);
    });
  });

  it('the "No date" tray lists tasks without a date and they can be dragged into the calendar', async () => {
    const { fetchMock } = await renderSignedIn(<CalendarView scope={allTasksScope()} filters={FILTERS} />, routes());
    await screen.findByText(/Họp nhóm/);

    await fireEvent.press(screen.getByTestId('calendar-no-date'));

    expect(await screen.findByText('Chưa có ngày')).toBeTruthy();
    const noDateRequest = requestsTo(fetchMock, 'GET', '/api/v1/tasks').find((request) => request.query.get('view') === null);
    expect(noDateRequest?.query.get('filter')).toBe('no date');

    const zone = screen.getAllByTestId(/^calendar-slots-/)[0];
    const day = dayOf(zone.props.testID);
    const undated = makeTask({ id: 'undated', version: 2, dueDate: null, dueDatetime: null });
    await fireEvent(zone, 'drop', { taskIds: ['undated'], task: undated }, { x: 1, y: HOUR_HEIGHT * 14 });
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PATCH')).toBe(true));
    const patch = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'PATCH');
    expect(JSON.parse((patch?.[1] as RequestInit).body as string)).toEqual({ version: 2, dueDatetime: `${day}T14:00:00`, durationMinutes: 30 });
  });
});
