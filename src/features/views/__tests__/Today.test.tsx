import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import viViews from '../../../i18n/locales/vi/views.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { affected, makeTask, page } from '../../../test/m1Fixtures';
import { SnackbarProvider } from '../../../components/Snackbar';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { palette } from '../../../theme';
import { TodayScreen } from '../TodayScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// Friday 23/10/2026, 10:00 in Vietnam.
let mockNow = new Date('2026-10-23T03:00:00Z');
jest.mock('../../../lib/useNow', () => ({ useNow: () => mockNow }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const texts = (pattern: RegExp) => screen.getAllByText(pattern).map((node) => node.props.children as string);

const tasks = [
  makeTask({ id: 'a', content: 'Nộp thuế', dueDate: '2026-10-21' }),
  makeTask({ id: 'b', content: 'Gọi điện', dueDatetime: '2026-10-23T08:00:00' }), // 08:00, already past
  makeTask({ id: 'c', content: 'Đi chợ', dueDate: '2026-10-23' }),
  makeTask({ id: 'd', content: 'Họp nhóm', dueDatetime: '2026-10-23T17:00:00' }),
];

describe('TodayScreen', () => {
  beforeEach(() => {
    mockNow = new Date('2026-10-23T03:00:00Z');
  });

  it('Overdue block = due DAY before today; a timed task already past TODAY stays in Today, in red (spec 3.1)', async () => {
    const { fetchMock } = await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
    });

    await screen.findByText('Họp nhóm');
    expect(texts(/^(Quá hạn|23\/10 · Hôm nay · Thứ Sáu|Nộp thuế|Gọi điện|Đi chợ|Họp nhóm)$/)).toEqual([
      'Quá hạn',
      'Nộp thuế',
      '23/10 · Hôm nay · Thứ Sáu',
      'Gọi điện',
      'Đi chợ',
      'Họp nhóm',
    ]);
    expect(screen.getByTestId('section-header-overdue')).toHaveTextContent(/Quá hạn1/);
    expect(screen.getByText('4 công việc · Thứ Sáu 23/10')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks')[0].query.get('view')).toBe('today');
    // 08:00 has passed (it is 10:00): the due is red like an overdue one, but the task is not in the Overdue block.
    expect(StyleSheet.flatten(screen.getByText('Hôm nay 08:00').props.style)).toMatchObject({ color: palette.warn });
    expect(StyleSheet.flatten(screen.getByText('Hôm nay 17:00').props.style)).toMatchObject({ color: palette.ok });
  });

  it('with only a timed task that is late today there is no Overdue block and no Reschedule button', async () => {
    await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      'GET /api/v1/tasks': () => jsonResponse(200, page([tasks[1], tasks[2]])),
    });
    await screen.findByText('Gọi điện');
    expect(screen.queryByText(viViews.views.overdue.title)).toBeNull();
    expect(screen.queryByTestId('overdue-reschedule')).toBeNull();
    expect(screen.getByText('23/10 · Hôm nay · Thứ Sáu')).toBeOnTheScreen();
  });

  it('the Overdue block collapses and opens from its header', async () => {
    await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)) });
    await screen.findByText('Nộp thuế');

    await fireEvent.press(screen.getByTestId('section-header-overdue-toggle'));
    expect(screen.queryByText('Nộp thuế')).toBeNull();
    expect(screen.getByText('Đi chợ')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('section-header-overdue-toggle'));
    expect(screen.getByText('Nộp thuế')).toBeOnTheScreen();
  });

  it('Reschedule moves every overdue task to the chosen day and says how many', async () => {
    const { fetchMock } = await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
      'POST /api/v1/tasks/overdue/reschedule': () => jsonResponse(200, affected(['a', 'b'])),
    });
    await screen.findByText('Nộp thuế');

    await fireEvent.press(screen.getByTestId('overdue-reschedule'));
    await fireEvent.press(await screen.findByTestId('reschedule-tomorrow'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/overdue/reschedule')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/overdue/reschedule')[0].body).toEqual({ date: '2026-10-24' });
    expect(await screen.findByText(viViews.views.overdue.rescheduled.replace('{{n}}', '2'))).toBeOnTheScreen();
  });

  it('Reschedule accepts today but never an earlier day (the server answers 400 for it)', async () => {
    const { fetchMock } = await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
      'POST /api/v1/tasks/overdue/reschedule': () => jsonResponse(200, affected(['a'])),
    });
    await screen.findByText('Nộp thuế');
    await fireEvent.press(screen.getByTestId('overdue-reschedule'));

    expect(await screen.findByTestId('reschedule-day-2026-10-22')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('reschedule-day-2026-10-22'));
    await fireEvent.press(screen.getByTestId('reschedule-done'));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/overdue/reschedule')).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('reschedule-today'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/overdue/reschedule')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/overdue/reschedule')[0].body).toEqual({ date: '2026-10-23' });
  });

  it('"Thêm công việc" under the list opens Quick Add due today', async () => {
    await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)) });
    await screen.findByText('Họp nhóm');

    await fireEvent.press(screen.getByTestId('today-add'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/quick-add', params: { dueDate: '2026-10-23' } });
  });

  it('with nothing to do shows the "all done" state whose button opens Quick Add', async () => {
    await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      'GET /api/v1/tasks': () => jsonResponse(200, page([])) });
    expect(await screen.findByText(viViews.views.today.emptyTitle)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('today-empty-action'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/quick-add', params: { dueDate: '2026-10-23' } });
  });

  it('the ⋯ menu offers "Chọn công việc", which starts the selection mode', async () => {
    await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)) });
    await screen.findByText('Họp nhóm');

    await fireEvent.press(screen.getByTestId('today-menu-open'));
    await fireEvent.press(screen.getByTestId('today-menu-select'));

    expect(screen.getByTestId('selection-count')).toBeOnTheScreen();
  });

  it('refetches after midnight: the new account-zone day is part of the list query key (review C1)', async () => {
    const { fetchMock, rerender } = await renderSignedIn(<TodayScreen />, {
      ...viewOptionsRoutes(['TODAY']),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
    });
    await screen.findByText('Họp nhóm');
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks')).toHaveLength(1);

    // 00:05 on Saturday 24/10 in Vietnam (= 17:05Z on the 23rd).
    mockNow = new Date('2026-10-23T17:05:00Z');
    await rerender(
      <SnackbarProvider>
        <TodayScreen />
      </SnackbarProvider>,
    );

    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks')).toHaveLength(2));
    // Every task is due on 21/10 or 23/10, i.e. before the new today, so all four are Overdue now and the old "today" is gone.
    expect(await screen.findByText('4 công việc · Thứ Bảy 24/10')).toBeOnTheScreen();
    expect(screen.getByTestId('section-header-overdue')).toHaveTextContent(/Quá hạn4/);
    expect(screen.queryByText('23/10 · Hôm nay · Thứ Sáu')).toBeNull();
  });
});
