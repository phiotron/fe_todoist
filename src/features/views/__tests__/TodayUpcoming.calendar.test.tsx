import { screen } from '@testing-library/react-native';
import viViews from '../../../i18n/locales/vi/views.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { TodayScreen } from '../TodayScreen';
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

const STATUS = {
  connected: true,
  provider: 'GOOGLE',
  accountEmail: 'lich@example.com',
  showEvents: true,
  syncTasks: false,
  needsReauth: false,
  lastSyncedAt: null,
};

const EVENTS = {
  needsReauth: false,
  items: [
    {
      id: 'ev-1',
      title: 'Họp phụ huynh',
      allDay: false,
      startDate: '2026-10-23',
      endDate: '2026-10-23',
      startDatetime: '2026-10-23T15:00:00',
      endDatetime: '2026-10-23T16:00:00',
      location: null,
    },
    {
      id: 'ev-2',
      title: 'Nghỉ phép',
      allDay: true,
      startDate: '2026-10-24',
      endDate: '2026-10-25',
      startDatetime: null,
      endDatetime: null,
      location: null,
    },
  ],
};

const tasksRoute = { 'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'c', content: 'Đi chợ', dueDate: '2026-10-23' })])) };

describe('Calendar events in Today and Upcoming (M13b)', () => {
  it('Today shows the events of today (read-only) above the tasks and asks for exactly today', async () => {
    const { fetchMock } = await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      ...tasksRoute,
      'GET /api/v1/me/calendar': () => jsonResponse(200, STATUS),
      'GET /api/v1/calendar/events': () => jsonResponse(200, EVENTS),
    });

    expect(await screen.findByText('Họp phụ huynh')).toBeOnTheScreen();
    expect(screen.getByText('15:00 – 16:00')).toBeOnTheScreen();
    expect(screen.getByText('Đi chợ')).toBeOnTheScreen();
    expect(screen.queryByText('Nghỉ phép')).toBeNull(); // tomorrow's event is not in Today
    const query = requestsTo(fetchMock, 'GET', '/api/v1/calendar/events')[0].query;
    expect(query.get('from')).toBe('2026-10-23');
    expect(query.get('to')).toBe('2026-10-23');
  });

  it('Today asks nothing about events while no calendar is connected', async () => {
    const { fetchMock } = await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      ...tasksRoute,
      'GET /api/v1/me/calendar': () => jsonResponse(200, { ...STATUS, connected: false, provider: null }),
    });

    await screen.findByText('Đi chợ');
    expect(requestsTo(fetchMock, 'GET', '/api/v1/calendar/events')).toEqual([]);
    expect(screen.queryByText(viViews.views.today.emptyTitle)).toBeNull();
  });

  it('Today ignores events when the calendar is hidden ("Show events" off)', async () => {
    const { fetchMock } = await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      ...tasksRoute,
      'GET /api/v1/me/calendar': () => jsonResponse(200, { ...STATUS, showEvents: false }),
      'GET /api/v1/calendar/events': () => jsonResponse(200, EVENTS),
    });

    await screen.findByText('Đi chợ');
    expect(requestsTo(fetchMock, 'GET', '/api/v1/calendar/events')).toEqual([]);
    expect(screen.queryByText('Họp phụ huynh')).toBeNull();
  });

  it('Upcoming puts each event under its day, a multi-day event under every day it covers', async () => {
    await renderSignedIn(<UpcomingScreen />, {
      ...viewOptionsRoutes(['UPCOMING']),
      'GET /api/v1/tasks': () => jsonResponse(200, page([])),
      'GET /api/v1/me/calendar': () => jsonResponse(200, STATUS),
      'GET /api/v1/calendar/events': () => jsonResponse(200, EVENTS),
    });

    expect(await screen.findByTestId('upcoming-events-2026-10-23')).toBeOnTheScreen();
    expect(screen.getByTestId('upcoming-events-2026-10-24')).toBeOnTheScreen();
    expect(screen.getByTestId('upcoming-events-2026-10-25')).toBeOnTheScreen();
    expect(screen.getAllByText('Nghỉ phép')).toHaveLength(2);
    expect(screen.queryByTestId('upcoming-events-2026-10-26')).toBeNull();
  });

  it('a failing events request never hides the tasks', async () => {
    await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      ...tasksRoute,
      'GET /api/v1/me/calendar': () => jsonResponse(200, STATUS),
      'GET /api/v1/calendar/events': () => jsonResponse(503, { status: 503, title: 'Service Unavailable' }),
    });

    expect(await screen.findByText('Đi chợ')).toBeOnTheScreen();
    expect(screen.queryByText('Họp phụ huynh')).toBeNull();
  });
});
