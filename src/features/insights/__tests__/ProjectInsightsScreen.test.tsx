import { screen } from '@testing-library/react-native';
import { jsonResponse, problem } from '../../../test/http';
import { insights } from '../../../test/m10Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { ProjectInsightsScreen } from '../ProjectInsightsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

describe('ProjectInsightsScreen', () => {
  it('asks the project insights and shows progress, the four counts and the 14 days', async () => {
    const { fetchMock } = await renderSignedIn(<ProjectInsightsScreen projectId="p-1" />, {
      'GET /api/v1/projects/p-1/insights': () => jsonResponse(200, insights()),
    });

    expect(await screen.findByTestId('insights-percent')).toHaveTextContent('66% hoàn thành');
    expect(screen.getByTestId('insights-bar').props.accessibilityValue).toMatchObject({ now: 66 });
    expect(screen.getByTestId('insights-total')).toHaveTextContent(/^6/);
    expect(screen.getByTestId('insights-completed')).toHaveTextContent(/^4/);
    expect(screen.getByTestId('insights-active')).toHaveTextContent(/^2/);
    expect(screen.getByTestId('insights-overdue')).toHaveTextContent(/^1/);
    expect(screen.getByTestId('insights-days-2026-11-12')).toBeOnTheScreen();
    expect(screen.getByTestId('insights-days-2026-10-30')).toBeOnTheScreen();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/v1/projects/p-1/insights'))).toBe(true);
  });

  it('says so when the project has no tasks', async () => {
    await renderSignedIn(<ProjectInsightsScreen projectId="p-1" />, {
      'GET /api/v1/projects/p-1/insights': () =>
        jsonResponse(200, insights({ totalTasks: 0, completedTasks: 0, activeTasks: 0, overdueTasks: 0, progressPercent: 0 })),
    });

    expect(await screen.findByText('Dự án chưa có công việc nào.')).toBeOnTheScreen();
    expect(screen.getByTestId('insights-percent')).toHaveTextContent('0% hoàn thành');
  });

  it('shows the error state when the project cannot be read', async () => {
    await renderSignedIn(<ProjectInsightsScreen projectId="p-1" />, {
      'GET /api/v1/projects/p-1/insights': () => problem(404, 'Not Found'),
    });

    expect(await screen.findByTestId('insights-state')).toBeOnTheScreen();
  });
});
