import { act, waitFor } from '@testing-library/react-native';
import { requestsTo } from '../../../test/apiRoutes';
import { FakeReminderPlatform } from '../../../test/fakeReminderPlatform';
import { jsonResponse, problem } from '../../../test/http';
import { renderSignedIn } from '../../../test/screen';
import type { ReminderTap, ReminderTapAction } from '../platform';
import { useReminderResponses } from '../useReminderResponses';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const NOW = Date.parse('2026-10-23T03:00:00Z');
const CLOSE_PATH = '/api/v1/tasks/t-1/close';

function tapOf(taskId: string, action: ReminderTapAction = 'open'): ReminderTap {
  return { action, taskId, notificationId: `auto:${taskId}`, title: 'Họp nhóm' };
}

function Probe({ platform }: { platform: FakeReminderPlatform }) {
  useReminderResponses({ platform, now: () => NOW });
  return null;
}

async function respond(platform: FakeReminderPlatform, tap: ReminderTap) {
  await act(async () => {
    platform.tap(tap);
  });
}

describe('useReminderResponses', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
  });

  it('opens the task whose reminder launched the app, once', async () => {
    const platform = new FakeReminderPlatform();
    platform.launchTap = tapOf('t-9');

    await renderSignedIn(<Probe platform={platform} />);

    expect(mockRouter.push).toHaveBeenCalledWith('/task/t-9');
    expect(platform.takeLastTap()).toBeNull();
  });

  it('opens the task when a reminder is tapped while the app runs', async () => {
    const platform = new FakeReminderPlatform();
    await renderSignedIn(<Probe platform={platform} />);

    await respond(platform, tapOf('t-3'));

    expect(mockRouter.push).toHaveBeenCalledWith('/task/t-3');
  });

  it('snoozes for 15 minutes on this device and removes the shown notification', async () => {
    const platform = new FakeReminderPlatform();
    await renderSignedIn(<Probe platform={platform} />);

    await respond(platform, tapOf('t-1', 'snooze'));

    await waitFor(() => expect(platform.dismissed).toEqual(['auto:t-1']));
    expect(platform.scheduler.requests.get('snooze:t-1')).toMatchObject({
      kind: 'SNOOZE', taskId: 't-1', title: 'Họp nhóm', body: 'Đã hoãn 15 phút', fireAtMs: NOW + 15 * 60_000,
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('opens the task when snoozing fails', async () => {
    const platform = new FakeReminderPlatform();
    platform.scheduler.failingIds.add('snooze:t-1');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderSignedIn(<Probe platform={platform} />);

    await respond(platform, tapOf('t-1', 'snooze'));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/task/t-1'));
    expect(platform.dismissed).toEqual([]);
    jest.restoreAllMocks();
  });

  it('completes the task from the notification', async () => {
    const platform = new FakeReminderPlatform();
    const { fetchMock } = await renderSignedIn(<Probe platform={platform} />, {
      [`POST ${CLOSE_PATH}`]: () => jsonResponse(200, { task: { id: 't-1' }, cascaded: [] }),
    });

    await respond(platform, tapOf('t-1', 'complete'));

    await waitFor(() => expect(platform.dismissed).toEqual(['auto:t-1']));
    expect(requestsTo(fetchMock, 'POST', CLOSE_PATH)).toHaveLength(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('opens the task when completing fails (offline, server error)', async () => {
    const platform = new FakeReminderPlatform();
    await renderSignedIn(<Probe platform={platform} />, {
      [`POST ${CLOSE_PATH}`]: () => problem(500, 'Internal Server Error'),
    });

    await respond(platform, tapOf('t-1', 'complete'));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/task/t-1'));
    expect(platform.dismissed).toEqual([]);
  });

  it('treats a deleted task as done', async () => {
    const platform = new FakeReminderPlatform();
    await renderSignedIn(<Probe platform={platform} />, {
      [`POST ${CLOSE_PATH}`]: () => problem(404, 'Not Found'),
    });

    await respond(platform, tapOf('t-1', 'complete'));

    await waitFor(() => expect(platform.dismissed).toEqual(['auto:t-1']));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('stops listening on unmount', async () => {
    const platform = new FakeReminderPlatform();
    const view = await renderSignedIn(<Probe platform={platform} />);

    await view.unmount();
    await respond(platform, tapOf('t-3'));

    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
