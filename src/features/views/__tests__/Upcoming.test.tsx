import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import viViews from '../../../i18n/locales/vi/views.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { affected, makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { getUpcomingDay, setUpcomingDay } from '../upcomingDayStore';
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

const headers = () => screen.getAllByText(/^\d{2}\/\d{2} · /).map((node) => node.props.children as string);
const action = (actionName: string) => ({ nativeEvent: { actionName } });

const OVERDUE = [
  makeTask({ id: 'o1', content: 'Nộp thuế', dueDate: '2026-10-21' }),
  makeTask({ id: 'o2', content: 'Trả lời email', dueDate: '2026-10-22' }),
];

/** Window 1 = 23/10–05/11 (two pages: cursor c2), window 2 = 06/11–19/11, window 3 = 20/11–03/12. */
function routes(extra: Parameters<typeof renderSignedIn>[1] = {}) {
  return {
    'GET /api/v1/tasks': (request: { query: URLSearchParams }) => {
      if (request.query.get('view') === 'overdue') return jsonResponse(200, page(OVERDUE));
      if (request.query.get('from') === '2026-11-06') {
        return jsonResponse(200, page([makeTask({ id: 'w2', content: 'Họp tháng 11', dueDate: '2026-11-10' })]));
      }
      if (request.query.get('from') === '2026-11-20') return jsonResponse(200, page([]));
      if (request.query.get('cursor') === 'c2') {
        return jsonResponse(200, page([makeTask({ id: 'e', content: 'Khám răng', dueDate: '2026-10-26' })]));
      }
      return jsonResponse(
        200,
        page(
          [
            makeTask({ id: 'a', content: 'Sinh nhật', dueDate: '2026-10-24' }),
            makeTask({ id: 'b', content: 'Đá bóng', dueDatetime: '2026-10-25T03:00:00' }),
          ],
          'c2',
        ),
      );
    },
    ...viewOptionsRoutes(['UPCOMING']),
    ...extra,
  };
}

describe('UpcomingScreen', () => {
  beforeEach(() => setUpcomingDay(undefined));

  it('asks a 14-day WINDOW from today, groups by day (a header even for an empty day) and, once the window is complete, shows every day of it', async () => {
    const { fetchMock } = await renderSignedIn(<UpcomingScreen />, routes());

    await screen.findByText('Đá bóng');
    const first = requestsTo(fetchMock, 'GET', '/api/v1/tasks').find((r) => r.query.get('view') === 'upcoming');
    expect(first?.query.get('from')).toBe('2026-10-23');
    expect(first?.query.get('to')).toBe('2026-11-05');
    // The window is not complete yet (a cursor is left): only the days up to the last loaded task.
    expect(headers()).toEqual(['23/10 · Hôm nay · Thứ Sáu', '24/10 · Ngày mai · Thứ Bảy', '25/10 · Chủ nhật']);

    await fireEvent(screen.getByTestId('upcoming-list'), 'endReached');

    expect(await screen.findByText('Khám răng')).toBeOnTheScreen();
    expect(headers()).toEqual([
      '23/10 · Hôm nay · Thứ Sáu',
      '24/10 · Ngày mai · Thứ Bảy',
      '25/10 · Chủ nhật',
      '26/10 · Thứ Hai',
      '27/10 · Thứ Ba',
      '28/10 · Thứ Tư',
      '29/10 · Thứ Năm',
      '30/10 · Thứ Sáu',
      '31/10 · Thứ Bảy',
      '01/11 · Chủ nhật',
      '02/11 · Thứ Hai',
      '03/11 · Thứ Ba',
      '04/11 · Thứ Tư',
      '05/11 · Thứ Năm',
    ]);
  });

  it('reaching the end again loads the NEXT window (from = previous to + 1) — day windows, not task pages', async () => {
    const { fetchMock } = await renderSignedIn(<UpcomingScreen />, routes());
    await screen.findByText('Đá bóng');
    await fireEvent(screen.getByTestId('upcoming-list'), 'endReached'); // cursor c2 of window 1
    await screen.findByText('Khám răng');

    await fireEvent(screen.getByTestId('upcoming-list'), 'endReached'); // window 2

    expect(await screen.findByText('Họp tháng 11')).toBeOnTheScreen();
    const windows = requestsTo(fetchMock, 'GET', '/api/v1/tasks')
      .filter((r) => r.query.get('view') === 'upcoming')
      .map((r) => [r.query.get('from'), r.query.get('to'), r.query.get('cursor')]);
    expect(windows).toEqual([
      ['2026-10-23', '2026-11-05', null],
      ['2026-10-23', '2026-11-05', 'c2'],
      ['2026-11-06', '2026-11-19', null],
    ]);
    expect(headers()).toContain('19/11 · Thứ Năm');
    expect(headers()).not.toContain('20/11 · Thứ Sáu');
  });

  it('draws the week strip: today selected, past days disabled; tapping a day selects it for the + button', async () => {
    await renderSignedIn(<UpcomingScreen />, routes());
    await screen.findByText('Đá bóng');

    expect(screen.getByTestId('week-day-2026-10-23')).toBeSelected();
    expect(screen.getByTestId('week-day-2026-10-20')).toBeDisabled();
    expect(screen.getByText('T2')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('week-day-2026-10-25'));

    expect(screen.getByTestId('week-day-2026-10-25')).toBeSelected();
    expect(getUpcomingDay()).toBe('2026-10-25');
  });

  it('the next week loads pages / windows until its day exists; the previous week is refused at the current week', async () => {
    const { fetchMock } = await renderSignedIn(<UpcomingScreen />, routes());
    await screen.findByText('Đá bóng');

    await fireEvent(screen.getByTestId('upcoming-month'), 'accessibilityAction', action('decrement'));
    expect(screen.getByTestId('week-day-2026-10-23')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('upcoming-month'), 'accessibilityAction', action('increment'));

    expect(await screen.findByTestId('week-day-2026-10-26')).toBeSelected();
    expect(getUpcomingDay()).toBe('2026-10-26');
    await waitFor(() =>
      expect(
        requestsTo(fetchMock, 'GET', '/api/v1/tasks')
          .filter((r) => r.query.get('view') === 'upcoming')
          .map((r) => r.query.get('cursor')),
      ).toEqual([null, 'c2']),
    );
    expect(await screen.findByText('26/10 · Thứ Hai')).toBeOnTheScreen();
  });

  it('"Hôm nay" brings the strip back to this week and selects today', async () => {
    await renderSignedIn(<UpcomingScreen />, routes());
    await screen.findByText('Đá bóng');
    expect(screen.queryByTestId('upcoming-today')).toBeNull();

    await fireEvent(screen.getByTestId('upcoming-month'), 'accessibilityAction', action('increment'));
    await fireEvent.press(await screen.findByTestId('upcoming-today'));

    expect(screen.getByTestId('week-day-2026-10-23')).toBeSelected();
    expect(getUpcomingDay()).toBe('2026-10-23');
  });

  it('the month title opens a date picker that jumps to the chosen day (past days are disabled)', async () => {
    await renderSignedIn(<UpcomingScreen />, routes());
    await screen.findByText('Đá bóng');

    await fireEvent.press(screen.getByTestId('upcoming-month'));
    expect(await screen.findByTestId('upcoming-jump-day-2026-10-22')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('upcoming-jump-tomorrow'));

    expect(getUpcomingDay()).toBe('2026-10-24');
    expect(screen.getByTestId('week-day-2026-10-24')).toBeSelected();
  });

  it('shows the Overdue block first and reschedules it; each day offers "Thêm công việc" for that day', async () => {
    const { fetchMock } = await renderSignedIn(
      <UpcomingScreen />,
      routes({ 'POST /api/v1/tasks/overdue/reschedule': () => jsonResponse(200, affected(['o1', 'o2'])) }),
    );
    expect(await screen.findByText('Nộp thuế')).toBeOnTheScreen();
    expect(screen.getByText('Quá hạn')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('overdue-reschedule'));
    expect(await screen.findByTestId('reschedule-day-2026-10-22')).toBeDisabled(); // only today or later
    await fireEvent.press(screen.getByTestId('reschedule-tomorrow'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/overdue/reschedule')).toHaveLength(1));
    expect(await screen.findByText(viViews.views.overdue.rescheduled.replace('{{n}}', '2'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('upcoming-add-2026-10-24'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/quick-add', params: { dueDate: '2026-10-24' } });
  });
});
