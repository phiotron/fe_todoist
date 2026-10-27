import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import viViews from '../../../i18n/locales/vi/views.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeTask, page, taskChange } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { CompletedScreen } from '../CompletedScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// Friday 23/10/2026, 10:00 in Vietnam.
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const done = (id: string, content: string, completedAt: string, projectName: string) =>
  makeTask({ id, content, completedAt, projectName });

const tasks = [
  done('a', 'So giá đối thủ', '2026-10-23T01:15:00Z', 'Tìm nguồn hàng'), // 08:15 today
  done('b', 'Gửi ảnh mẫu', '2026-10-22T10:40:00Z', 'Tối ưu listing'), // 17:40 yesterday
  done('c', 'Kiểm tra báo cáo', '2026-10-21T09:20:00Z', 'Tìm nguồn hàng'), // 16:20 on Wed 21/10
];

describe('CompletedScreen', () => {
  it('asks view=completed (every project, no projectId / completed param) and groups by completion day, newest first', async () => {
    const { fetchMock } = await renderSignedIn(<CompletedScreen />, {
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
    });

    await screen.findByText('So giá đối thủ');
    const request = requestsTo(fetchMock, 'GET', '/api/v1/tasks')[0];
    expect(request.query.get('view')).toBe('completed');
    expect(request.query.get('completed')).toBeNull();
    expect(request.query.get('projectId')).toBeNull();
    expect(request.query.get('since')).toBeNull();
    expect(request.query.get('until')).toBeNull();
    expect(screen.getByText('Hôm nay · Thứ Sáu')).toBeOnTheScreen();
    expect(screen.getByText('Hôm qua · Thứ Năm')).toBeOnTheScreen();
    expect(screen.getByText('Thứ Tư 21/10')).toBeOnTheScreen();
    expect(screen.getByTestId('task-completed-at-a')).toHaveTextContent('08:15');
    expect(screen.getAllByText('Tìm nguồn hàng')).toHaveLength(2);
  });

  it('groups by the day in the ACCOUNT zone, not UTC: 23:30 UTC on the 22nd is already the 23rd in Vietnam', async () => {
    await renderSignedIn(<CompletedScreen />, {
      'GET /api/v1/tasks': () =>
        jsonResponse(200, page([done('z', 'Xong đêm khuya', '2026-10-22T23:30:00Z', 'Nhà')])), // 06:30 on 23/10 local
    });
    await screen.findByText('Xong đêm khuya');
    expect(screen.getByText('Hôm nay · Thứ Sáu')).toBeOnTheScreen();
    expect(screen.getByTestId('task-completed-at-z')).toHaveTextContent('06:30');
  });

  it('lists a completed sub-task as its own row with the name of its parent', async () => {
    await renderSignedIn(<CompletedScreen />, {
      'GET /api/v1/tasks': () =>
        jsonResponse(
          200,
          page([makeTask({ id: 'k', content: 'Bước 2', completedAt: '2026-10-23T01:00:00Z', parentId: 'p', parentContent: 'Chuẩn bị họp', projectName: 'Công ty' })]),
        ),
    });
    expect(await screen.findByText('Bước 2')).toBeOnTheScreen();
    expect(screen.getByText('Chuẩn bị họp')).toBeOnTheScreen();
  });

  it('loads more with the cursor when the end is reached', async () => {
    const { fetchMock } = await renderSignedIn(<CompletedScreen />, {
      'GET /api/v1/tasks': (request) =>
        request.query.get('cursor') === 'c2'
          ? jsonResponse(200, page([done('d', 'Việc cũ', '2026-10-10T05:00:00Z', 'Nhà')]))
          : jsonResponse(200, page(tasks, 'c2')),
    });
    await screen.findByText('So giá đối thủ');

    await fireEvent(screen.getByTestId('completed-list'), 'endReached');

    expect(await screen.findByText('Việc cũ')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks').map((r) => r.query.get('cursor'))).toEqual([null, 'c2']);
  });

  it('the date range chips send since / until; a since after the until drops the until; "Không giới hạn" clears a bound', async () => {
    const { fetchMock } = await renderSignedIn(<CompletedScreen />, {
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
    });
    await screen.findByText('So giá đối thủ');
    const lastQuery = () => requestsTo(fetchMock, 'GET', '/api/v1/tasks').at(-1)?.query;

    await fireEvent.press(screen.getByTestId('completed-until-chip'));
    await fireEvent.press(await screen.findByTestId('completed-until-day-2026-10-20'));
    await fireEvent.press(screen.getByTestId('completed-until-done'));
    await waitFor(() => expect(lastQuery()?.get('until')).toBe('2026-10-20'));
    expect(lastQuery()?.get('since')).toBeNull();

    // since 22/10 is after until 20/10: the app never sends since > until (the server would answer 400), it drops the until.
    await fireEvent.press(screen.getByTestId('completed-since-chip'));
    await fireEvent.press(await screen.findByTestId('completed-since-day-2026-10-22'));
    await fireEvent.press(screen.getByTestId('completed-since-done'));
    await waitFor(() => expect(lastQuery()?.get('since')).toBe('2026-10-22'));
    expect(lastQuery()?.get('until')).toBeNull();
    const backwards = requestsTo(fetchMock, 'GET', '/api/v1/tasks').filter((r) => {
      const from = r.query.get('since');
      const to = r.query.get('until');
      return from !== null && to !== null && from > to;
    });
    expect(backwards).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('completed-since-chip'));
    await fireEvent.press(await screen.findByTestId('completed-since-noDate'));
    await waitFor(() => expect(lastQuery()?.get('since')).toBeNull());
  });

  it('the until picker cannot go before the since day', async () => {
    await renderSignedIn(<CompletedScreen />, { 'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)) });
    await screen.findByText('So giá đối thủ');
    await fireEvent.press(screen.getByTestId('completed-since-chip'));
    await fireEvent.press(await screen.findByTestId('completed-since-day-2026-10-20'));
    await fireEvent.press(screen.getByTestId('completed-since-done'));

    await fireEvent.press(screen.getByTestId('completed-until-chip'));

    expect(await screen.findByTestId('completed-until-day-2026-10-19')).toBeDisabled();
    expect(screen.getByTestId('completed-until-day-2026-10-20')).not.toBeDisabled();
  });

  it('reopens a task from its filled circle (plain reopen, no undo)', async () => {
    const { fetchMock } = await renderSignedIn(<CompletedScreen />, {
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
      'POST /api/v1/tasks/a/reopen': () => jsonResponse(200, taskChange(makeTask({ id: 'a' }))),
    });
    await screen.findByText('So giá đối thủ');

    await fireEvent.press(screen.getByTestId('task-toggle-a'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/a/reopen')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/a/reopen')[0].body).toBeUndefined();
  });

  it('shows the empty state and the back button leaves', async () => {
    await renderSignedIn(<CompletedScreen />, { 'GET /api/v1/tasks': () => jsonResponse(200, page([])) });
    expect(await screen.findByText(viViews.views.completed.emptyTitle)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('completed-header-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('with a range and no result says so for the range', async () => {
    await renderSignedIn(<CompletedScreen />, { 'GET /api/v1/tasks': () => jsonResponse(200, page([])) });
    await screen.findByText(viViews.views.completed.emptyTitle);
    await fireEvent.press(screen.getByTestId('completed-since-chip'));
    await fireEvent.press(await screen.findByTestId('completed-since-day-2026-10-20'));
    await fireEvent.press(screen.getByTestId('completed-since-done'));
    expect(await screen.findByText(viViews.views.completed.emptyRange)).toBeOnTheScreen();
  });
});
