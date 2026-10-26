import type { DesiredReminder, ReminderRequest, ReminderScheduler } from './types';

export type ReminderLog = (message: string) => void;

/** Logs never contain task content (titles are user data). */
export const warnLog: ReminderLog = (message) => console.warn(message);

export interface SyncResult {
  scheduled: number;
  cancelled: number;
  unchanged: number;
  failed: number;
}

export function reminderSignature(reminder: DesiredReminder): string {
  return `${reminder.fireAtMs}|${reminder.title}|${reminder.body}`;
}

export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown error';
}

/**
 * Makes the device schedule equal to `desired`: unchanged reminders are left alone, changed ones are
 * replaced, extra ones (task completed / deleted / due changed / passed) are cancelled. Snoozes are local
 * only and never in `desired`, so they are skipped here (see pruneSnoozes). One failing reminder does not
 * stop the others; it stays different and is retried on the next sync. Rejects only when the current
 * schedule cannot be read.
 */
export async function syncReminders(
  scheduler: ReminderScheduler,
  desired: readonly DesiredReminder[],
  log: ReminderLog = warnLog,
): Promise<SyncResult> {
  const result: SyncResult = { scheduled: 0, cancelled: 0, unchanged: 0, failed: 0 };
  const wanted = new Map<string, ReminderRequest>();
  for (const reminder of desired) {
    wanted.set(reminder.id, { ...reminder, signature: reminderSignature(reminder) });
  }

  const existing = await scheduler.listScheduled();
  for (const item of existing) {
    if (item.kind === 'SNOOZE') continue;
    const want = wanted.get(item.id);
    if (want && want.signature === item.signature) {
      result.unchanged += 1;
      wanted.delete(item.id);
    } else if (!want) {
      try {
        await scheduler.cancel(item.id);
        result.cancelled += 1;
      } catch (error) {
        result.failed += 1;
        log(`reminder cancel failed for ${item.id}: ${errorName(error)}`);
      }
    }
  }

  for (const want of wanted.values()) {
    try {
      await scheduler.schedule(want);
      result.scheduled += 1;
    } catch (error) {
      result.failed += 1;
      log(`reminder schedule failed for ${want.id} (task ${want.taskId}): ${errorName(error)}`);
    }
  }
  return result;
}
