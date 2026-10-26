import { FakeReminderScheduler } from '../../../test/fakeReminderScheduler';
import { SNOOZE_MINUTES, pruneSnoozes, scheduleSnooze, snoozeId, type TaskState } from '../snooze';

const NOW = Date.parse('2026-10-23T03:00:00Z');
const INPUT = { taskId: 't-1', title: 'Họp nhóm', body: 'Đã hoãn 15 phút' };

describe('snooze', () => {
  it('schedules the same task again in 15 minutes, on this device only', async () => {
    const scheduler = new FakeReminderScheduler();

    const fireAtMs = await scheduleSnooze(scheduler, INPUT, NOW);

    expect(SNOOZE_MINUTES).toBe(15);
    expect(fireAtMs).toBe(NOW + 15 * 60_000);
    expect(scheduler.requests.get(snoozeId('t-1'))).toMatchObject({
      id: 'snooze:t-1', taskId: 't-1', kind: 'SNOOZE', fireAtMs, title: 'Họp nhóm', body: 'Đã hoãn 15 phút',
    });
  });

  it('snoozing again replaces the previous snooze of that task', async () => {
    const scheduler = new FakeReminderScheduler();
    await scheduleSnooze(scheduler, INPUT, NOW);

    await scheduleSnooze(scheduler, INPUT, NOW + 60_000);

    expect(scheduler.requests.size).toBe(1);
    expect(scheduler.requests.get('snooze:t-1')?.fireAtMs).toBe(NOW + 60_000 + 15 * 60_000);
  });

  it('cancels snoozes of completed or deleted tasks and keeps the rest', async () => {
    const scheduler = new FakeReminderScheduler();
    await scheduleSnooze(scheduler, { ...INPUT, taskId: 't-open' }, NOW);
    await scheduleSnooze(scheduler, { ...INPUT, taskId: 't-gone' }, NOW);
    scheduler.seed({ id: 'auto:t-gone', taskId: 't-gone', kind: 'AUTO', signature: 'sig' });
    const fetchTaskState = jest.fn(async (taskId: string): Promise<TaskState> => (taskId === 't-gone' ? 'gone' : 'open'));

    const cancelled = await pruneSnoozes(scheduler, fetchTaskState, jest.fn());

    expect(cancelled).toBe(1);
    expect(fetchTaskState).toHaveBeenCalledTimes(2);
    expect((await scheduler.listScheduled()).map((item) => item.id).sort()).toEqual(['auto:t-gone', 'snooze:t-open']);
  });

  it('keeps a snooze when the task state is unknown and logs the task id only', async () => {
    const scheduler = new FakeReminderScheduler();
    await scheduleSnooze(scheduler, INPUT, NOW);
    const log = jest.fn();

    const cancelled = await pruneSnoozes(scheduler, jest.fn(async () => { throw new TypeError('Network request failed'); }), log);

    expect(cancelled).toBe(0);
    expect(scheduler.requests.has('snooze:t-1')).toBe(true);
    expect(log).toHaveBeenCalledWith('snooze check failed for task t-1: TypeError');
  });
});
