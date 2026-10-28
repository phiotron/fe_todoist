import { MutationObserver } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { OccurrenceInput } from '../../../lib/reminders';
import { FakeReminderScheduler } from '../../../test/fakeReminderScheduler';
import { renderWithProviders } from '../../../test/render';
import type { ReminderRuntimeSettings } from '../reminderSettings';
import type { TaskState } from '../snooze';
import { DATA_WRITE_META, requestReminderSync, requestReminderSyncAfterWrite } from '../syncSignal';
import type { ReminderPermission } from '../types';
import { useReminderSync, type ReminderRuntimeDeps } from '../useReminderSync';

/** 10:00 on 23 Oct 2026 in Asia/Ho_Chi_Minh. */
const NOW = Date.parse('2026-10-23T03:00:00Z');
const SETTINGS: ReminderRuntimeSettings = {
  enabled: true,
  timeZone: 'Asia/Ho_Chi_Minh',
  autoReminderMinutes: 30,
  snoozeMinutes: 15,
  pinReminders: false,
  urgentDeviceId: null,
};
const OCCURRENCES: OccurrenceInput[] = [
  { key: 'auto:t-1', taskId: 't-1', kind: 'AUTO', fireAt: '2026-10-23T11:30:00', content: 'Họp nhóm' },
  { key: 'r-1', taskId: 't-2', kind: 'ABSOLUTE', fireAt: '2026-10-24T09:00:00', content: 'Nộp báo cáo' },
];
const GRANTED: ReminderPermission = { status: 'granted', granted: true, canAskAgain: true };
const UNDETERMINED: ReminderPermission = { status: 'undetermined', granted: false, canAskAgain: true };

function makeDeps(overrides: Partial<ReminderRuntimeDeps> = {}) {
  const scheduler = new FakeReminderScheduler();
  const deps: ReminderRuntimeDeps = {
    scheduler,
    fetchOccurrences: jest.fn(async () => OCCURRENCES),
    fetchTaskState: jest.fn(async (_taskId: string): Promise<TaskState> => 'open'),
    getPermission: jest.fn(async () => GRANTED),
    requestPermission: jest.fn(async () => GRANTED),
    ensureChannel: jest.fn(async () => undefined),
    configureActions: jest.fn(async () => undefined),
    now: () => NOW,
    log: jest.fn(),
    ...overrides,
  };
  return { deps, scheduler };
}

function Probe({ settings, deps }: { settings: ReminderRuntimeSettings | null; deps: ReminderRuntimeDeps }) {
  useReminderSync(settings, { deps, debounceMs: 0 });
  return null;
}

const tick = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

describe('useReminderSync', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('schedules reminders on mount with localized bodies', async () => {
    const { deps, scheduler } = makeDeps();

    await renderWithProviders(<Probe settings={SETTINGS} deps={deps} />);

    await waitFor(() => expect(scheduler.requests.size).toBe(2));
    expect(scheduler.requests.get('auto:t-1')).toMatchObject({
      title: 'Họp nhóm', body: 'Sắp đến hạn', fireAtMs: Date.parse('2026-10-23T04:30:00Z'),
    });
    expect(scheduler.requests.get('r-1')).toMatchObject({
      title: 'Nộp báo cáo', body: 'Nhắc việc', fireAtMs: Date.parse('2026-10-24T02:00:00Z'),
    });
  });

  it('waits until the settings are known', async () => {
    const { deps } = makeDeps();

    await renderWithProviders(<Probe settings={null} deps={deps} />);
    await tick();

    expect(deps.fetchOccurrences).not.toHaveBeenCalled();
  });

  it('cancels every reminder when reminders are turned off', async () => {
    const { deps, scheduler } = makeDeps();
    const view = await renderWithProviders(<Probe settings={SETTINGS} deps={deps} />);
    await waitFor(() => expect(scheduler.requests.size).toBe(2));

    await view.rerender(<Probe settings={{ ...SETTINGS, enabled: false }} deps={deps} />);

    await waitFor(() => expect(scheduler.cancelAllCalls).toBe(1));
    expect(scheduler.requests.size).toBe(0);
  });

  it('syncs again when the automatic reminder minutes change', async () => {
    const { deps } = makeDeps();
    const view = await renderWithProviders(<Probe settings={SETTINGS} deps={deps} />);
    await waitFor(() => expect(deps.fetchOccurrences).toHaveBeenCalledTimes(1));

    await view.rerender(<Probe settings={{ ...SETTINGS, autoReminderMinutes: 60 }} deps={deps} />);

    await waitFor(() => expect(deps.fetchOccurrences).toHaveBeenCalledTimes(2));
  });

  it('syncs again when the app returns to the foreground', async () => {
    const addListener = jest.spyOn(AppState, 'addEventListener');
    const { deps } = makeDeps();
    await renderWithProviders(<Probe settings={SETTINGS} deps={deps} />);
    await waitFor(() => expect(deps.fetchOccurrences).toHaveBeenCalledTimes(1));

    const changeHandlers = addListener.mock.calls.filter(([type]) => type === 'change');
    // The session provider also listens to AppState changes, so deliver the change to every listener.
    await act(async () => {
      for (const [, handler] of changeHandlers) (handler as (state: AppStateStatus) => void)('active');
    });

    await waitFor(() => expect(deps.fetchOccurrences).toHaveBeenCalledTimes(2));
  });

  it('syncs after a successful write but not after a failed one', async () => {
    const { deps } = makeDeps();
    const { queryClient } = await renderWithProviders(<Probe settings={SETTINGS} deps={deps} />);
    await waitFor(() => expect(deps.fetchOccurrences).toHaveBeenCalledTimes(1));

    await act(async () => {
      await new MutationObserver(queryClient, { mutationFn: async () => 'ok' }).mutate();
    });
    await waitFor(() => expect(deps.fetchOccurrences).toHaveBeenCalledTimes(2));

    await act(async () => {
      await new MutationObserver(queryClient, {
        mutationFn: async () => {
          throw new Error('write failed');
        },
      })
        .mutate()
        .catch(() => undefined);
    });
    await tick();
    expect(deps.fetchOccurrences).toHaveBeenCalledTimes(2);
  });

  it('PERF: a data write that says it cannot move a reminder does not re-plan; one that can, does (debounced)', async () => {
    const { deps } = makeDeps();
    const { queryClient } = await renderWithProviders(<Probe settings={SETTINGS} deps={deps} />);
    await waitFor(() => expect(deps.fetchOccurrences).toHaveBeenCalledTimes(1));

    // useDataMutation marks its mutations: it decides itself (label rename, description...) whether reminders care.
    await act(async () => {
      await new MutationObserver(queryClient, { mutationFn: async () => 'ok', meta: DATA_WRITE_META }).mutate();
    });
    await tick();
    expect(deps.fetchOccurrences).toHaveBeenCalledTimes(1);

    await act(async () => {
      requestReminderSyncAfterWrite();
      requestReminderSyncAfterWrite();
      requestReminderSyncAfterWrite();
    });
    await waitFor(() => expect(deps.fetchOccurrences).toHaveBeenCalledTimes(2));
    await tick();
    expect(deps.fetchOccurrences).toHaveBeenCalledTimes(2);
  });

  it('creates the channel, registers the buttons, asks for permission once, then schedules', async () => {
    const order: string[] = [];
    let granted = false;
    const { deps, scheduler } = makeDeps({
      ensureChannel: jest.fn(async () => {
        order.push('channel');
      }),
      configureActions: jest.fn(async () => {
        order.push('actions');
      }),
      getPermission: jest.fn(async () => (granted ? GRANTED : UNDETERMINED)),
      requestPermission: jest.fn(async () => {
        order.push('request');
        granted = true;
        return GRANTED;
      }),
    });

    await renderWithProviders(<Probe settings={SETTINGS} deps={deps} />);

    await waitFor(() => expect(scheduler.requests.size).toBe(2));
    expect(order).toEqual(['channel', 'actions', 'request']);
    expect(deps.ensureChannel).toHaveBeenCalledWith('Nhắc việc', 'Nhắc khẩn cấp');
    expect(deps.configureActions).toHaveBeenCalledWith({ snooze: 'Hoãn', complete: 'Hoàn thành' });
    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when the user already denied', async () => {
    const { deps, scheduler } = makeDeps({
      getPermission: jest.fn(async (): Promise<ReminderPermission> => ({ status: 'denied', granted: false, canAskAgain: false })),
    });

    await renderWithProviders(<Probe settings={SETTINGS} deps={deps} />);
    await tick();

    expect(deps.requestPermission).not.toHaveBeenCalled();
    expect(scheduler.requests.size).toBe(0);
  });

  it('retries on the next trigger after the API failed', async () => {
    const { deps, scheduler } = makeDeps();
    jest.mocked(deps.fetchOccurrences).mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderWithProviders(<Probe settings={SETTINGS} deps={deps} />);
    await waitFor(() => expect(deps.log).toHaveBeenCalledWith('reminder fetch failed: TypeError'));
    expect(scheduler.requests.size).toBe(0);

    await act(async () => {
      requestReminderSync();
    });

    await waitFor(() => expect(scheduler.requests.size).toBe(2));
  });
});
