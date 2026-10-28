import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ViewOptions } from '../../../api/viewOptions';
import { requestsTo, type ApiRoutes, type RoutedRequest } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { affected, inboxProject, makeProject, makeSection, makeTask, page } from '../../../test/m1Fixtures';
import { makeViewOptions } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../../projects/ProjectScreen';
import { TodayScreen } from '../../views/TodayScreen';
import { UpcomingScreen } from '../../views/UpcomingScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));
// Friday 23/10/2026, 10:00 in Vietnam.
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const project = makeProject({ id: 'p-1', name: 'Nhà' });
const section = makeSection({ id: 's-1', projectId: 'p-1', name: 'Bếp' });
const projectTasks = [
  makeTask({ id: 't-1', projectId: 'p-1', sectionId: 's-1', content: 'Rửa bát' }),
  makeTask({ id: 't-2', projectId: 'p-1', sectionId: null, content: 'Quét nhà' }),
];
const overdueTask = makeTask({ id: 'od', content: 'Nộp thuế', dueDate: '2026-10-21' });
const todayTask = makeTask({ id: 'td', content: 'Nộp báo cáo', dueDate: '2026-10-23' });
const doneToday = makeTask({ id: 'dn', content: 'Đã xong sáng nay', completedAt: '2026-10-23T01:00:00Z' });

function tasks(request: RoutedRequest): Response {
  const view = request.query.get('view');
  if (view === 'today') return jsonResponse(200, page([overdueTask, todayTask]));
  if (view === 'upcoming') return jsonResponse(200, page([todayTask]));
  if (view === 'overdue') return jsonResponse(200, page([overdueTask]));
  if (view === 'completed') return jsonResponse(200, page([doneToday]));
  if (view === 'calendar') return jsonResponse(200, page([todayTask]));
  if (request.query.get('projectId') === 'p-1') return jsonResponse(200, page(projectTasks));
  return jsonResponse(200, page([]));
}

function routes(saved: ViewOptions[]): ApiRoutes {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    'GET /api/v1/projects/p-1': () => jsonResponse(200, project),
    'GET /api/v1/projects/p-1/sections': () => jsonResponse(200, [section]),
    'GET /api/v1/tasks': tasks,
    'POST /api/v1/tasks/batch': () => jsonResponse(200, affected(['t-2'])),
    ...viewOptionsRoutes(['project:p-1', 'TODAY', 'UPCOMING'], saved),
  };
}

const calls = (fetchMock: Parameters<typeof requestsTo>[0], view: string) =>
  requestsTo(fetchMock, 'GET', '/api/v1/tasks').filter((request) => request.query.get('view') === view);

describe('M7 layouts on the screens', () => {
  it('a project saved as Board draws No Section + section columns, and a drop moves the task with one batch', async () => {
    const { fetchMock } = await renderSignedIn(
      <ProjectScreen projectId="p-1" />,
      routes([makeViewOptions('project:p-1', { sortBy: 'MANUAL', showCompleted: false, layout: 'BOARD' })]),
    );
    expect(await screen.findByTestId('project-board')).toBeTruthy();
    expect(screen.getByTestId('board-column-section:none')).toBeTruthy();
    expect(screen.getByTestId('board-column-section:s-1')).toBeTruthy();
    expect(screen.getByText('Rửa bát')).toBeTruthy();
    expect(screen.queryByTestId('project-list')).toBeNull();

    await fireEvent(screen.getByTestId('board-column-section:s-1'), 'drop', { taskIds: ['t-2'], task: projectTasks[1] }, { x: 1, y: 1 });

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0].body).toEqual({
      action: 'MOVE',
      taskIds: ['t-2'],
      projectId: 'p-1',
      sectionId: 's-1',
    });
  });

  it('a project saved as Calendar asks the calendar API for that project', async () => {
    const { fetchMock } = await renderSignedIn(
      <ProjectScreen projectId="p-1" />,
      routes([makeViewOptions('project:p-1', { sortBy: 'MANUAL', showCompleted: false, layout: 'CALENDAR' })]),
    );
    expect(await screen.findByTestId('calendar-mode')).toBeTruthy();
    await waitFor(() => expect(calls(fetchMock, 'calendar')).toHaveLength(1));
    expect(calls(fetchMock, 'calendar')[0].query.get('projectId')).toBe('p-1');
  });

  it('choosing Board in Display → Layout switches Today at once and saves it', async () => {
    const { fetchMock } = await renderSignedIn(<TodayScreen />, routes([]));
    expect(await screen.findByText('Nộp báo cáo')).toBeTruthy();
    expect(screen.getByTestId('today-list')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('today-menu-open'));
    await fireEvent.press(screen.getByTestId('today-menu-display'));
    await fireEvent.press(await screen.findByTestId('display-layout-board'));

    expect(await screen.findByTestId('today-board')).toBeTruthy();
    expect(screen.getByTestId('board-column-overdue')).toBeTruthy();
    expect(screen.getByTestId('board-column-date:2026-10-23')).toBeTruthy();
    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/view-options/TODAY')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/view-options/TODAY')[0].body).toMatchObject({ layout: 'BOARD' });
  });

  it('Today as Calendar asks for today + overdue tasks', async () => {
    const { fetchMock } = await renderSignedIn(<TodayScreen />, routes([makeViewOptions('TODAY', { showCompleted: false, layout: 'CALENDAR' })]));
    expect(await screen.findByTestId('calendar-mode')).toBeTruthy();
    await waitFor(() => expect(calls(fetchMock, 'calendar')).toHaveLength(1));
    expect(calls(fetchMock, 'calendar')[0].query.get('filter')).toBe('today | overdue');
  });

  it('Completed tasks on Today shows what was completed today (view=completed for today only)', async () => {
    const { fetchMock } = await renderSignedIn(<TodayScreen />, routes([makeViewOptions('TODAY', { showCompleted: true })]));
    expect(await screen.findByText('Đã xong sáng nay')).toBeTruthy();
    expect(screen.getByText('Đã hoàn thành hôm nay')).toBeTruthy();
    const request = calls(fetchMock, 'completed')[0];
    expect(request.query.get('since')).toBe('2026-10-23');
    expect(request.query.get('until')).toBe('2026-10-23');
    expect(request.query.get('sort')).toBeNull();
  });

  it('Upcoming as Board has one column per day and drops schedule that day', async () => {
    const { fetchMock } = await renderSignedIn(
      <UpcomingScreen />,
      routes([makeViewOptions('UPCOMING', { showCompleted: false, showFutureOccurrences: false, layout: 'BOARD' })]),
    );
    expect(await screen.findByTestId('upcoming-board')).toBeTruthy();
    expect(screen.getByTestId('board-column-date:2026-10-23')).toBeTruthy();
    expect(screen.getByTestId('board-column-date:2026-11-05')).toBeTruthy(); // 14 days from today

    await fireEvent(screen.getByTestId('board-column-date:2026-10-25'), 'drop', { taskIds: ['td'], task: todayTask }, { x: 1, y: 1 });

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0].body).toEqual({ action: 'SCHEDULE', taskIds: ['td'], date: '2026-10-25' });
  });

  it('Upcoming: press and hold a day of the week strip adds a task on that day', async () => {
    await renderSignedIn(<UpcomingScreen />, routes([]));
    await screen.findByTestId('week-day-2026-10-24');

    await fireEvent(screen.getByTestId('week-day-2026-10-24'), 'longPress');

    expect(router.push).toHaveBeenCalledWith({ pathname: '/quick-add', params: { dueDate: '2026-10-24' } });
  });
});
