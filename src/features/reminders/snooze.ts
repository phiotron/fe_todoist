import { errorName, reminderSignature, warnLog, type ReminderLog } from './syncReminders';
import type { DesiredReminder, ReminderScheduler } from './types';

/** Snooze length (spec 5.8). */
export const SNOOZE_MINUTES = 15;

const MINUTE_MS = 60_000;

/** "gone" = completed or deleted: its snooze must not fire. */
export type TaskState = 'open' | 'gone';

export function snoozeId(taskId: string): string {
  return `snooze:${taskId}`;
}

export interface SnoozeInput {
  taskId: string;
  title: string;
  body: string;
}

/** The same task again in 15 minutes, on this device only (spec 5.8). Snoozing again replaces it. */
export async function scheduleSnooze(scheduler: ReminderScheduler, input: SnoozeInput, nowMs: number): Promise<number> {
  const reminder: DesiredReminder = {
    id: snoozeId(input.taskId),
    taskId: input.taskId,
    kind: 'SNOOZE',
    fireAtMs: nowMs + SNOOZE_MINUTES * MINUTE_MS,
    title: input.title,
    body: input.body,
  };
  await scheduler.schedule({ ...reminder, signature: reminderSignature(reminder) });
  return reminder.fireAtMs;
}

/**
 * Snoozes are not in GET tasks/reminders, so the diff keeps them; this drops the ones whose task is now
 * completed or deleted. An unknown state (offline) keeps the snooze. Returns how many were cancelled.
 */
export async function pruneSnoozes(
  scheduler: ReminderScheduler,
  fetchTaskState: (taskId: string) => Promise<TaskState>,
  log: ReminderLog = warnLog,
): Promise<number> {
  const snoozes = (await scheduler.listScheduled()).filter((item) => item.kind === 'SNOOZE' && item.taskId);
  let cancelled = 0;
  for (const item of snoozes) {
    const taskId = item.taskId as string;
    try {
      if ((await fetchTaskState(taskId)) === 'gone') {
        await scheduler.cancel(item.id);
        cancelled += 1;
      }
    } catch (error) {
      log(`snooze check failed for task ${taskId}: ${errorName(error)}`);
    }
  }
  return cancelled;
}
