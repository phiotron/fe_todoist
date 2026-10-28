import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import viProductivity from '../../../i18n/locales/vi/productivity.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { productivity } from '../../../test/m10Fixtures';
import { settingsResponse } from '../../../test/settingsFixtures';
import { renderSignedIn } from '../../../test/screen';
import { ProductivityScreen } from '../ProductivityScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const vi = viProductivity.productivity;

function routes(answer = productivity()) {
  return {
    'GET /api/v1/productivity': () => jsonResponse(200, answer),
    'GET /api/v1/me/settings': () => jsonResponse(200, settingsResponse()),
    'PATCH /api/v1/me/settings': () => jsonResponse(200, settingsResponse({ dailyGoal: 8 })),
  };
}

describe('ProductivityScreen', () => {
  it('Daily tab: goal progress, streaks and the last 7 days', async () => {
    await renderSignedIn(<ProductivityScreen />, routes());

    expect(await screen.findByTestId('daily-goal-progress')).toHaveTextContent('2/5');
    expect(screen.getByTestId('daily-goal-hint')).toHaveTextContent('Còn 3 việc nữa để đạt mục tiêu hôm nay');
    expect(screen.getByTestId('streak-current')).toHaveTextContent('1 ngày');
    expect(screen.getByTestId('streak-longest')).toHaveTextContent('4 ngày');
    expect(screen.getByTestId('daily-goal-bar').props.accessibilityValue).toMatchObject({ now: 40 });
    expect(screen.getByTestId('daily-bars-2026-11-12')).toBeOnTheScreen();
    expect(screen.getByTestId('daily-bars-2026-11-06')).toBeOnTheScreen();
  });

  it('tells when the daily goal is reached', async () => {
    const answer = productivity();
    answer.daily = { ...answer.daily, completed: 6, reached: true };
    await renderSignedIn(<ProductivityScreen />, routes(answer));

    expect(await screen.findByTestId('daily-goal-hint')).toHaveTextContent(vi.daily.reached);
    expect(screen.getByTestId('daily-goal-bar').props.accessibilityValue).toMatchObject({ now: 100 });
  });

  it('Weekly tab: goal 12/30, weekly streak and 4 weeks', async () => {
    await renderSignedIn(<ProductivityScreen />, routes());
    await fireEvent.press(await screen.findByTestId('productivity-tabs-weekly'));

    expect(screen.getByTestId('weekly-goal-progress')).toHaveTextContent('12/30');
    expect(screen.getByTestId('streak-current')).toHaveTextContent('0 tuần');
    expect(screen.getByTestId('streak-longest')).toHaveTextContent('2 tuần');
    expect(screen.getByTestId('weekly-bars-2026-11-09')).toBeOnTheScreen();
    expect(screen.getByTestId('weekly-bars-2026-10-19')).toBeOnTheScreen();
  });

  it('Karma tab: score, level, points left, trend and About Karma levels', async () => {
    await renderSignedIn(<ProductivityScreen />, routes());
    await fireEvent.press(await screen.findByTestId('productivity-tabs-karma'));

    expect(screen.getByTestId('karma-score')).toHaveTextContent('223 điểm Karma');
    expect(screen.getByText('Cấp Người mới')).toBeOnTheScreen();
    expect(screen.getByTestId('karma-next')).toHaveTextContent('Còn 277 điểm để lên Tập sự');
    expect(screen.getByTestId('karma-trend-2026-11-12')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('karma-about'));
    expect(router.push).toHaveBeenCalledWith('/karma-levels');
  });

  it('hides the Karma tab when Karma is off', async () => {
    await renderSignedIn(<ProductivityScreen />, routes(productivity({ karmaEnabled: false, karma: null })));

    await screen.findByTestId('productivity-daily');
    expect(screen.queryByTestId('productivity-tabs-karma')).toBeNull();
    expect(screen.getByTestId('productivity-tabs-weekly')).toBeOnTheScreen();
  });

  it('Edit goal: choosing a goal PATCHes dailyGoal and refreshes Productivity', async () => {
    const { fetchMock } = await renderSignedIn(<ProductivityScreen />, routes());
    await fireEvent.press(await screen.findByTestId('daily-goal-edit'));

    await fireEvent.press(await screen.findByTestId('daily-goal-sheet-option-8'));

    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/me/settings')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/me/settings')[0].body).toEqual({ dailyGoal: 8 });
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/productivity').length).toBeGreaterThan(1));
  });

  it('Edit goal (weekly) lists a custom current goal too', async () => {
    await renderSignedIn(<ProductivityScreen />, routes(productivity({ weeklyGoal: 33 })));
    await fireEvent.press(await screen.findByTestId('productivity-tabs-weekly'));
    await fireEvent.press(screen.getByTestId('weekly-goal-edit'));

    expect(await screen.findByTestId('weekly-goal-sheet-option-33')).toBeOnTheScreen();
  });

  it('shows the error state with a retry when loading fails', async () => {
    await renderSignedIn(<ProductivityScreen />, {
      'GET /api/v1/productivity': () => jsonResponse(500, { type: 'about:blank', title: 'Server error', status: 500 }),
    });

    expect(await screen.findByTestId('productivity-state')).toBeOnTheScreen();
  });
});
