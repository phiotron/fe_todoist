import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { setTasklyAndroidForTests, type TasklyAndroidModule } from '../../../lib/native/tasklyAndroid';
import { tokenStore } from '../../../lib/tokenStore';
import { routeApi } from '../../../test/apiRoutes';
import { FakeReminderPlatform } from '../../../test/fakeReminderPlatform';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { AlarmScreen } from '../AlarmScreen';
import { setReminderPlatform } from '../platform';

const TASK = { id: 't-1', content: 'Uống thuốc', completedAt: null, version: 1 };
const NOW = Date.parse('2026-10-23T03:00:00Z');

describe('AlarmScreen (urgent reminder)', () => {
  let platform: FakeReminderPlatform;
  let stopUrgentAlarm: jest.Mock;
  let onDone: jest.Mock;
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    platform = new FakeReminderPlatform();
    setReminderPlatform(platform);
    stopUrgentAlarm = jest.fn();
    setTasklyAndroidForTests({ stopUrgentAlarm } as unknown as TasklyAndroidModule);
    onDone = jest.fn();
    fetchMock = mockFetch();
    routeApi(fetchMock, {
      'GET /api/v1/tasks/t-1': () => jsonResponse(200, TASK),
      // TaskChangeResponse = the task itself plus the cascaded sub-tasks.
      'POST /api/v1/tasks/t-1/close': () =>
        jsonResponse(200, { task: { ...TASK, completedAt: '2026-10-23T03:00:00Z', version: 2 }, cascaded: [] }),
    });
  });

  afterEach(() => {
    setReminderPlatform(null);
    setTasklyAndroidForTests(undefined);
  });

  async function show(extra: { snoozeMinutes?: number; pinReminders?: boolean } = {}) {
    await renderWithProviders(<AlarmScreen taskId="t-1" onDone={onDone} now={() => NOW} {...extra} />);
    await waitFor(() => expect(screen.getByTestId('alarm-title')).toHaveTextContent('Uống thuốc'));
  }

  it('shows the task name', async () => {
    await show();

    expect(screen.getByText('Nhắc khẩn cấp')).toBeOnTheScreen();
  });

  it('Stop silences the ringing and leaves', async () => {
    await show();

    await fireEvent.press(screen.getByTestId('alarm-stop'));

    expect(stopUrgentAlarm).toHaveBeenCalledWith('t-1');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Snooze rings again after the chosen minutes (this device only), pinned when Pin reminders is on', async () => {
    await show({ snoozeMinutes: 45, pinReminders: true });
    expect(screen.getByText('Hoãn 45 phút')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('alarm-snooze'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(stopUrgentAlarm).toHaveBeenCalledWith('t-1');
    expect(platform.scheduler.requests.get('snooze:t-1')).toMatchObject({
      kind: 'SNOOZE',
      fireAtMs: NOW + 45 * 60_000,
      title: 'Uống thuốc',
      pinned: true,
    });
  });

  it('Complete closes the task, then silences the ringing', async () => {
    await show();

    await fireEvent.press(screen.getByTestId('alarm-complete'));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/tasks/t-1/close') && init?.method === 'POST')).toBe(true);
    expect(stopUrgentAlarm).toHaveBeenCalledWith('t-1');
  });

  it('a failed Complete keeps the alarm ringing and says why', async () => {
    routeApi(fetchMock, {
      'GET /api/v1/tasks/t-1': () => jsonResponse(200, TASK),
      'POST /api/v1/tasks/t-1/close': () => problem(500, 'Internal Server Error'),
    });
    await show();

    await fireEvent.press(screen.getByTestId('alarm-complete'));

    await waitFor(() => expect(screen.getByTestId('alarm-error')).toBeOnTheScreen());
    expect(stopUrgentAlarm).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('a task that no longer exists says so and cannot be completed', async () => {
    routeApi(fetchMock, { 'GET /api/v1/tasks/t-1': () => problem(404, 'Not Found') });
    await renderWithProviders(<AlarmScreen taskId="t-1" onDone={onDone} />);

    await waitFor(() => expect(screen.getByTestId('alarm-title')).toHaveTextContent('Công việc này không còn nữa'));
    expect(screen.getByTestId('alarm-complete').props.accessibilityState?.disabled).toBe(true);
  });
});
