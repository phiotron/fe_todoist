import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ViewOptions } from '../../../api/viewOptions';
import { requestsTo, type ApiRoutes, type RoutedRequest } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { makeViewOptions } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { TodayScreen } from '../../views/TodayScreen';
import { UpcomingScreen } from '../../views/UpcomingScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));
// Friday 23/10/2026, 10:00 in Vietnam (like the M1 Today / Upcoming tests).
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const overdueTask = makeTask({ id: 't-0', content: 'Nộp thuế', dueDate: '2026-10-21' });
const todayTasks = [
  makeTask({ id: 't-1', content: 'Nộp báo cáo', priority: 1, dueDate: '2026-10-23' }),
  makeTask({ id: 't-2', content: 'Tưới cây', priority: 3, dueDate: '2026-10-23' }),
];

function tasks(request: RoutedRequest): Response {
  const view = request.query.get('view');
  if (view === 'today') return jsonResponse(200, page([overdueTask, ...todayTasks]));
  if (view === 'upcoming') return jsonResponse(200, page(todayTasks));
  if (view === 'overdue') return jsonResponse(200, page([overdueTask]));
  return jsonResponse(200, page([]));
}

function viewCalls(fetchMock: Parameters<typeof requestsTo>[0], view: string) {
  return requestsTo(fetchMock, 'GET', '/api/v1/tasks').filter((request) => request.query.get('view') === view);
}

async function render(ui: Parameters<typeof renderSignedIn>[0], saved: ViewOptions[] = []) {
  const routes: ApiRoutes = { 'GET /api/v1/tasks': tasks, ...viewOptionsRoutes(['TODAY', 'UPCOMING'], saved) };
  return renderSignedIn(ui, routes);
}

describe('Today with Display', () => {
  it('fetches once with the saved Display parameters', async () => {
    const { fetchMock } = await render(<TodayScreen />);
    expect(await screen.findByText('Nộp báo cáo')).toBeTruthy();
    const calls = viewCalls(fetchMock, 'today');
    expect(calls).toHaveLength(1);
    expect(calls[0].query.get('sort')).toBe('date');
    expect(calls[0].query.get('order')).toBe('asc');
    expect(calls[0].query.get('group')).toBe('none');
  });

  it('groups only today’s tasks as saved; the Overdue block (due before today) stays on top', async () => {
    await render(<TodayScreen />, [makeViewOptions('TODAY', { sortBy: 'PRIORITY', groupBy: 'PRIORITY' })]);
    expect(await screen.findByText('Ưu tiên 1')).toBeTruthy();
    expect(screen.getByText('Ưu tiên 3')).toBeTruthy();
    expect(screen.getByTestId('section-header-overdue')).toBeTruthy();
    expect(screen.getByText('Nộp thuế')).toBeTruthy();
  });

  it('changes the sort from the ⋯ menu → Display and refetches', async () => {
    const { fetchMock } = await render(<TodayScreen />);
    await fireEvent.press(await screen.findByTestId('today-menu-open'));
    await fireEvent.press(screen.getByTestId('today-menu-display'));
    await fireEvent.press(await screen.findByTestId('display-sort-name'));
    await waitFor(() => expect(viewCalls(fetchMock, 'today').some((r) => r.query.get('sort') === 'name')).toBe(true));
  });
});

describe('Upcoming with Display', () => {
  it('sends the Display parameters with every view=upcoming request and never with the overdue block', async () => {
    const { fetchMock } = await render(<UpcomingScreen />, [makeViewOptions('UPCOMING', { sortBy: 'PRIORITY' })]);
    expect(await screen.findByText('Nộp báo cáo')).toBeTruthy();
    const calls = viewCalls(fetchMock, 'upcoming');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    for (const call of calls) expect(call.query.get('sort')).toBe('priority');
    const overdueCalls = viewCalls(fetchMock, 'overdue');
    expect(overdueCalls.length).toBeGreaterThanOrEqual(1);
    for (const call of overdueCalls) {
      for (const name of ['sort', 'order', 'group', 'filterDue']) expect(call.query.has(name)).toBe(false);
    }
  });

  it('offers no grouping and no "no date" / "overdue" due filter (server: 400)', async () => {
    await render(<UpcomingScreen />);
    await fireEvent.press(await screen.findByTestId('upcoming-menu-open'));
    await fireEvent.press(screen.getByTestId('upcoming-menu-display'));
    expect(await screen.findByTestId('display-sort-date')).toBeTruthy();
    expect(screen.queryByTestId('display-group-none')).toBeNull();
    expect(screen.getByTestId('display-due-next_7_days')).toBeTruthy();
    expect(screen.queryByTestId('display-due-no_date')).toBeNull();
    expect(screen.queryByTestId('display-due-overdue')).toBeNull();
  });
});
