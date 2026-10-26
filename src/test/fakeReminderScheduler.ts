import type { ReminderRequest, ReminderScheduler, ScheduledReminder } from '../features/reminders/types';

/** In-memory ReminderScheduler for tests. */
export class FakeReminderScheduler implements ReminderScheduler {
  readonly requests = new Map<string, ReminderRequest>();
  readonly failingIds = new Set<string>();
  /** Entries scheduled outside this fake's schedule() (e.g. a previous app version). */
  private readonly foreign = new Map<string, ScheduledReminder>();
  listError: Error | null = null;
  scheduleCalls = 0;
  cancelCalls = 0;
  cancelAllCalls = 0;

  seed(entry: ScheduledReminder): void {
    this.foreign.set(entry.id, entry);
  }

  async listScheduled(): Promise<ScheduledReminder[]> {
    if (this.listError) throw this.listError;
    const ours = [...this.requests.values()].map((request) => ({
      id: request.id,
      taskId: request.taskId,
      kind: request.kind,
      signature: request.signature,
    }));
    return [...ours, ...[...this.foreign.values()].filter((entry) => !this.requests.has(entry.id))];
  }

  async schedule(request: ReminderRequest): Promise<void> {
    this.scheduleCalls += 1;
    if (this.failingIds.has(request.id)) throw new Error('schedule failed');
    this.foreign.delete(request.id);
    this.requests.set(request.id, request);
  }

  async cancel(id: string): Promise<void> {
    this.cancelCalls += 1;
    this.requests.delete(id);
    this.foreign.delete(id);
  }

  async cancelAll(): Promise<void> {
    this.cancelAllCalls += 1;
    this.requests.clear();
    this.foreign.clear();
  }
}
