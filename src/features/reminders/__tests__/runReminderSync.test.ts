import type { OccurrenceInput, PlanSettings } from '../../../lib/reminders';
import { FakeReminderScheduler } from '../../../test/fakeReminderScheduler';
import { buildDesiredReminders, runReminderSync, type ReminderLabels, type ReminderSyncDeps } from '../runReminderSync';
import { scheduleSnooze, type TaskState } from '../snooze';
import type { ReminderPermission } from '../types';

/** 10:00 on 23 Oct 2026 in Asia/Ho_Chi_Minh. */
const NOW = Date.parse('2026-10-23T03:00:00Z');
const SETTINGS: PlanSettings = { enabled: true, timeZone: 'Asia/Ho_Chi_Minh' };
const LABELS: ReminderLabels = { dueSoon: 'Due soon', reminder: 'Reminder' };
const OCCURRENCES: OccurrenceInput[] = [
  { key: 'auto:t-1', taskId: 't-1', kind: 'AUTO', fireAt: '2026-10-23T11:30:00', content: 'Họp nhóm' },
  { key: 'r-1', taskId: 't-2', kind: 'ABSOLUTE', fireAt: '2026-10-24T09:00:00', content: 'Nộp báo cáo' },
];
const GRANTED: ReminderPermission = { status: 'granted', granted: true, canAskAgain: true };
const SNOOZE_TEXT = { title: 'Gọi khách', body: 'Snoozed' };

function makeDeps(overrides: Partial<ReminderSyncDeps> = {}) {
  const scheduler = new FakeReminderScheduler();
  const deps: ReminderSyncDeps = {
    scheduler,
    fetchOccurrences: jest.fn(async () => OCCURRENCES),
    fetchTaskState: jest.fn(async (_taskId: string): Promise<TaskState> => 'open'),
    getPermission: jest.fn(async () => GRANTED),
    now: () => NOW,
    log: jest.fn(),
    ...overrides,
  };
  return { deps, scheduler };
}

describe('buildDesiredReminders', () => {
  it('uses the task name as title and a body per kind', () => {
    expect(buildDesiredReminders(OCCURRENCES, SETTINGS, LABELS, NOW)).toEqual([
      { id: 'auto:t-1', taskId: 't-1', kind: 'AUTO', fireAtMs: Date.parse('2026-10-23T04:30:00Z'), title: 'Họp nhóm', body: 'Due soon' },
      { id: 'r-1', taskId: 't-2', kind: 'ABSOLUTE', fireAtMs: Date.parse('2026-10-24T02:00:00Z'), title: 'Nộp báo cáo', body: 'Reminder' },
    ]);
  });
});

describe('runReminderSync', () => {
  it('fetches, plans and schedules', async () => {
    const { deps, scheduler } = makeDeps();

    const outcome = await runReminderSync(SETTINGS, LABELS, deps);

    expect(outcome).toEqual({
      kind: 'synced',
      result: { scheduled: 2, cancelled: 0, unchanged: 0, failed: 0 },
      snoozesCancelled: 0,
    });
    expect([...scheduler.requests.keys()].sort()).toEqual(['auto:t-1', 'r-1']);
  });

  it('cancels everything, snoozes included, without calling the API when reminders are off', async () => {
    const { deps, scheduler } = makeDeps();
    await runReminderSync(SETTINGS, LABELS, deps);
    await scheduleSnooze(scheduler, { taskId: 't-3', ...SNOOZE_TEXT }, NOW);

    const outcome = await runReminderSync({ ...SETTINGS, enabled: false }, LABELS, deps);

    expect(outcome).toEqual({ kind: 'disabled' });
    expect(scheduler.cancelAllCalls).toBe(1);
    expect(scheduler.requests.size).toBe(0);
    expect(deps.fetchOccurrences).toHaveBeenCalledTimes(1);
  });

  it('leaves the schedule alone without notification permission', async () => {
    const { deps, scheduler } = makeDeps({
      getPermission: jest.fn(async (): Promise<ReminderPermission> => ({ status: 'denied', granted: false, canAskAgain: false })),
    });

    expect(await runReminderSync(SETTINGS, LABELS, deps)).toEqual({ kind: 'noPermission' });
    expect(deps.fetchOccurrences).not.toHaveBeenCalled();
    expect(scheduler.scheduleCalls + scheduler.cancelCalls + scheduler.cancelAllCalls).toBe(0);
  });

  it('keeps the existing schedule when the API fails, and logs', async () => {
    const { deps, scheduler } = makeDeps();
    await runReminderSync(SETTINGS, LABELS, deps);
    jest.mocked(deps.fetchOccurrences).mockRejectedValueOnce(new TypeError('Network request failed'));

    const outcome = await runReminderSync(SETTINGS, LABELS, deps);

    expect(outcome).toEqual({ kind: 'fetchFailed' });
    expect(scheduler.requests.size).toBe(2);
    expect(deps.log).toHaveBeenCalledWith('reminder fetch failed: TypeError');
  });

  it('reports failure when the device schedule cannot be read', async () => {
    const { deps, scheduler } = makeDeps();
    scheduler.listError = new Error('native');

    expect(await runReminderSync(SETTINGS, LABELS, deps)).toEqual({ kind: 'failed' });
    expect(deps.log).toHaveBeenCalledWith('reminder sync failed: Error');
  });

  it('cancels reminders the server no longer returns', async () => {
    const { deps, scheduler } = makeDeps();
    await runReminderSync(SETTINGS, LABELS, deps);
    jest.mocked(deps.fetchOccurrences).mockResolvedValueOnce([OCCURRENCES[1]]);

    await runReminderSync(SETTINGS, LABELS, deps);

    expect([...scheduler.requests.keys()]).toEqual(['r-1']);
  });

  it('drops snoozes of completed or deleted tasks and keeps the others', async () => {
    const { deps, scheduler } = makeDeps();
    await scheduleSnooze(scheduler, { taskId: 't-open', ...SNOOZE_TEXT }, NOW);
    await scheduleSnooze(scheduler, { taskId: 't-gone', ...SNOOZE_TEXT }, NOW);
    jest.mocked(deps.fetchTaskState).mockImplementation(async (taskId) => (taskId === 't-gone' ? 'gone' : 'open'));

    const outcome = await runReminderSync(SETTINGS, LABELS, deps);

    expect(outcome).toMatchObject({ kind: 'synced', snoozesCancelled: 1 });
    expect(scheduler.requests.has('snooze:t-open')).toBe(true);
    expect(scheduler.requests.has('snooze:t-gone')).toBe(false);
  });
});
