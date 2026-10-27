import { FakeReminderScheduler } from '../../../test/fakeReminderScheduler';
import { reminderSignature, syncReminders } from '../syncReminders';
import type { DesiredReminder } from '../types';

const A: DesiredReminder = { id: 'auto:a', taskId: 'a', kind: 'AUTO', fireAtMs: 1_000, title: 'Họp nhóm', body: 'Sắp đến hạn' };
const B: DesiredReminder = { id: 'r-1', taskId: 'b', kind: 'ABSOLUTE', fireAtMs: 2_000, title: 'Nộp báo cáo', body: 'Nhắc việc' };

describe('syncReminders', () => {
  it('schedules every desired reminder on an empty device, with its signature', async () => {
    const scheduler = new FakeReminderScheduler();

    const result = await syncReminders(scheduler, [A, B], jest.fn());

    expect(result).toEqual({ scheduled: 2, cancelled: 0, unchanged: 0, failed: 0 });
    expect(scheduler.requests.get('auto:a')).toEqual({ ...A, signature: reminderSignature(A) });
  });

  it('leaves an unchanged reminder alone', async () => {
    const scheduler = new FakeReminderScheduler();
    await syncReminders(scheduler, [A], jest.fn());
    scheduler.scheduleCalls = 0;

    const result = await syncReminders(scheduler, [A], jest.fn());

    expect(result).toEqual({ scheduled: 0, cancelled: 0, unchanged: 1, failed: 0 });
    expect(scheduler.scheduleCalls).toBe(0);
  });

  it('reschedules when the fire time or the text changed', async () => {
    const scheduler = new FakeReminderScheduler();
    await syncReminders(scheduler, [A, B], jest.fn());

    const moved = { ...A, fireAtMs: 5_000 };
    const renamed = { ...B, title: 'Nộp báo cáo quý' };
    const result = await syncReminders(scheduler, [moved, renamed], jest.fn());

    expect(result).toEqual({ scheduled: 2, cancelled: 0, unchanged: 0, failed: 0 });
    expect(scheduler.requests.get('auto:a')?.fireAtMs).toBe(5_000);
    expect(scheduler.requests.get('r-1')?.title).toBe('Nộp báo cáo quý');
  });

  it('cancels reminders that are no longer desired (completed, deleted, due changed, passed)', async () => {
    const scheduler = new FakeReminderScheduler();
    await syncReminders(scheduler, [A, B], jest.fn());

    const result = await syncReminders(scheduler, [B], jest.fn());

    expect(result).toEqual({ scheduled: 0, cancelled: 1, unchanged: 1, failed: 0 });
    expect([...scheduler.requests.keys()]).toEqual(['r-1']);
  });

  it('reschedules a notification without a signature (not created by this version)', async () => {
    const scheduler = new FakeReminderScheduler();
    scheduler.seed({ id: 'auto:a', taskId: 'a', kind: 'AUTO', signature: null });

    const result = await syncReminders(scheduler, [A], jest.fn());

    expect(result.scheduled).toBe(1);
    expect(scheduler.requests.get('auto:a')?.signature).toBe(reminderSignature(A));
  });

  it('keeps going when one reminder fails, counts it and logs only ids', async () => {
    const scheduler = new FakeReminderScheduler();
    scheduler.failingIds.add('auto:a');
    const log = jest.fn();

    const result = await syncReminders(scheduler, [A, B], log);

    expect(result).toEqual({ scheduled: 1, cancelled: 0, unchanged: 0, failed: 1 });
    expect(scheduler.requests.has('r-1')).toBe(true);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('auto:a');
    expect(log.mock.calls[0][0]).not.toContain('Họp nhóm');
  });

  it('retries a failed reminder on the next sync', async () => {
    const scheduler = new FakeReminderScheduler();
    scheduler.failingIds.add('auto:a');
    await syncReminders(scheduler, [A], jest.fn());
    scheduler.failingIds.clear();

    const result = await syncReminders(scheduler, [A], jest.fn());

    expect(result.scheduled).toBe(1);
    expect(scheduler.requests.has('auto:a')).toBe(true);
  });

  it('rejects when the device schedule cannot be read (caller logs and retries later)', async () => {
    const scheduler = new FakeReminderScheduler();
    scheduler.listError = new Error('native failure');

    await expect(syncReminders(scheduler, [A], jest.fn())).rejects.toThrow('native failure');
  });

  it('never touches a snoozed reminder (it is not in the server list)', async () => {
    const scheduler = new FakeReminderScheduler();
    scheduler.seed({ id: 'snooze:c', taskId: 'c', kind: 'SNOOZE', signature: 'sig' });

    const result = await syncReminders(scheduler, [A], jest.fn());

    expect(result).toEqual({ scheduled: 1, cancelled: 0, unchanged: 0, failed: 0 });
    expect((await scheduler.listScheduled()).map((item) => item.id).sort()).toEqual(['auto:a', 'snooze:c']);
  });
});
