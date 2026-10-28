import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { activityItem } from '../../../test/m10Fixtures';
import { makeProject } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { ActivityLogView } from '../ActivityLogView';
import { ActivityScreen } from '../ActivityScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// Thursday 12/11/2026, 10:00 in Vietnam.
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-11-12T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const items = [
  activityItem({ id: 'a1', eventType: 'COMPLETED', objectName: 'Gọi điện', createdAt: '2026-11-12T02:00:00Z' }), // 09:00 today
  activityItem({ id: 'a2', eventType: 'ADDED', objectName: 'Gọi điện', createdAt: '2026-11-12T01:00:00Z' }),
  activityItem({ id: 'a3', objectType: 'PROJECT', eventType: 'DELETED', objectId: 'p-9', objectName: 'Dự án cũ', projectName: 'Dự án cũ', createdAt: '2026-11-11T05:00:00Z' }),
];

const page = (list: unknown[], nextCursor: string | null = null) => jsonResponse(200, { items: list, nextCursor });

describe('ActivityLogView', () => {
  it('lists events newest first, grouped by day, with a sentence per event and the project', async () => {
    await renderSignedIn(<ActivityLogView />, {
      'GET /api/v1/activity': () => page(items),
      'GET /api/v1/projects': () => jsonResponse(200, []),
    });

    expect(await screen.findByText('Bạn đã hoàn thành: Gọi điện')).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã thêm công việc: Gọi điện')).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã xoá dự án: Dự án cũ')).toBeOnTheScreen();
    expect(screen.getByText('Hôm nay · Thứ Năm')).toBeOnTheScreen();
    expect(screen.getByText('Hôm qua · Thứ Tư')).toBeOnTheScreen();
    expect(screen.getAllByText('trong Công việc')).toHaveLength(2);
  });

  it('sends no filter at first; the event chip sends the lower-case eventType', async () => {
    const { fetchMock } = await renderSignedIn(<ActivityLogView />, {
      'GET /api/v1/activity': () => page(items),
      'GET /api/v1/projects': () => jsonResponse(200, []),
    });
    await screen.findByText('Bạn đã hoàn thành: Gọi điện');
    const first = requestsTo(fetchMock, 'GET', '/api/v1/activity')[0];
    expect(first.query.get('eventType')).toBeNull();
    expect(first.query.get('projectId')).toBeNull();

    await fireEvent.press(screen.getByTestId('activity-log-event-COMPLETED'));

    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/activity').some((r) => r.query.get('eventType') === 'completed')).toBe(true));
  });

  it('filters by project from the project sheet', async () => {
    const { fetchMock } = await renderSignedIn(<ActivityLogView />, {
      'GET /api/v1/activity': () => page(items),
      'GET /api/v1/projects': () => jsonResponse(200, [makeProject({ id: 'p-7', name: 'Nhà', isInbox: false })]),
    });
    await screen.findByText('Bạn đã hoàn thành: Gọi điện');

    await fireEvent.press(screen.getByTestId('activity-log-project-chip'));
    await fireEvent.press(await screen.findByTestId('activity-log-project-p-7'));

    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/activity').some((r) => r.query.get('projectId') === 'p-7')).toBe(true));
  });

  it('loads the next page with the cursor', async () => {
    const { fetchMock } = await renderSignedIn(<ActivityLogView />, {
      'GET /api/v1/activity': (request) =>
        request.query.get('cursor') === 'c2'
          ? page([activityItem({ id: 'a9', objectName: 'Việc cũ hơn', createdAt: '2026-11-10T02:00:00Z' })])
          : page(items, 'c2'),
      'GET /api/v1/projects': () => jsonResponse(200, []),
    });
    await screen.findByText('Bạn đã hoàn thành: Gọi điện');

    await fireEvent.press(await screen.findByTestId('activity-log-load-more'));

    expect(await screen.findByText('Bạn đã thêm công việc: Việc cũ hơn')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/activity').some((r) => r.query.get('cursor') === 'c2')).toBe(true);
  });

  it('shows the empty state', async () => {
    await renderSignedIn(<ActivityLogView />, {
      'GET /api/v1/activity': () => page([]),
      'GET /api/v1/projects': () => jsonResponse(200, []),
    });

    expect(await screen.findByTestId('activity-log-empty')).toBeOnTheScreen();
  });

  it('opens the task of an event, but not a deleted one', async () => {
    await renderSignedIn(<ActivityLogView />, {
      'GET /api/v1/activity': () =>
        page([
          activityItem({ id: 'o1', objectId: 't-5', eventType: 'ADDED', objectName: 'Còn đó' }),
          activityItem({ id: 'o2', objectId: 't-6', eventType: 'DELETED', objectName: 'Đã xoá' }),
        ]),
      'GET /api/v1/projects': () => jsonResponse(200, []),
    });

    await fireEvent.press(await screen.findByTestId('activity-log-item-o1'));
    expect(router.push).toHaveBeenCalledWith('/task/t-5');
    jest.mocked(router.push).mockClear();
    await fireEvent.press(screen.getByTestId('activity-log-item-o2'));
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('ActivityScreen (View activity)', () => {
  it('scopes to one task: taskId is sent, no filter chips', async () => {
    const { fetchMock } = await renderSignedIn(<ActivityScreen taskId="t-1" />, {
      'GET /api/v1/activity': () => page(items),
      'GET /api/v1/projects': () => jsonResponse(200, []),
    });

    await screen.findByText('Bạn đã hoàn thành: Gọi điện');
    expect(requestsTo(fetchMock, 'GET', '/api/v1/activity')[0].query.get('taskId')).toBe('t-1');
    expect(screen.queryByTestId('activity-log-filters')).toBeNull();
  });

  it('scopes to one project: projectId is sent and the project chip is hidden', async () => {
    const { fetchMock } = await renderSignedIn(<ActivityScreen projectId="p-1" />, {
      'GET /api/v1/activity': () => page(items),
      'GET /api/v1/projects': () => jsonResponse(200, []),
    });

    await screen.findByText('Bạn đã hoàn thành: Gọi điện');
    expect(requestsTo(fetchMock, 'GET', '/api/v1/activity')[0].query.get('projectId')).toBe('p-1');
    expect(screen.getByTestId('activity-log-event-all')).toBeOnTheScreen();
    expect(screen.queryByTestId('activity-log-project-chip')).toBeNull();
  });

  it('without a scope (Today / Upcoming) asks for everything', async () => {
    const { fetchMock } = await renderSignedIn(<ActivityScreen />, {
      'GET /api/v1/activity': () => page(items),
      'GET /api/v1/projects': () => jsonResponse(200, []),
    });

    await screen.findByText('Bạn đã hoàn thành: Gọi điện');
    const request = requestsTo(fetchMock, 'GET', '/api/v1/activity')[0];
    expect(request.query.get('taskId')).toBeNull();
    expect(request.query.get('projectId')).toBeNull();
  });
});
