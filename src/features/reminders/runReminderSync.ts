import { planReminders, type OccurrenceInput, type PlanSettings } from '../../lib/reminders';
import { pruneSnoozes, type TaskState } from './snooze';
import { errorName, syncReminders, warnLog, type ReminderLog, type SyncResult } from './syncReminders';
import type { DesiredReminder, ReminderPermission, ReminderScheduler } from './types';

/** Localised notification bodies; the title is the task name. */
export interface ReminderLabels {
  /** AUTO and RELATIVE: tied to the due time. */
  dueSoon: string;
  /** ABSOLUTE: a time the user picked. */
  reminder: string;
}

export interface ReminderSyncDeps {
  scheduler: ReminderScheduler;
  fetchOccurrences: () => Promise<OccurrenceInput[]>;
  fetchTaskState: (taskId: string) => Promise<TaskState>;
  getPermission: () => Promise<ReminderPermission>;
  now: () => number;
  log?: ReminderLog;
}

export type ReminderSyncOutcome =
  | { kind: 'disabled' }
  | { kind: 'noPermission' }
  | { kind: 'fetchFailed' }
  | { kind: 'failed' }
  | { kind: 'synced'; result: SyncResult; snoozesCancelled: number };

/** M12 flags applied when building the device schedule (absent = M4 behaviour). */
export interface ReminderDeliveryOptions {
  /** Pin reminders: notifications stay in the tray. */
  pinReminders?: boolean;
  /** This device is me/settings.urgentDeviceId: urgent occurrences ring as alarms here. */
  urgentHere?: boolean;
}

export function buildDesiredReminders(
  occurrences: readonly OccurrenceInput[],
  settings: PlanSettings & ReminderDeliveryOptions,
  labels: ReminderLabels,
  nowMs: number,
): DesiredReminder[] {
  return planReminders(occurrences, settings, nowMs).map((planned) => ({
    id: planned.id,
    taskId: planned.taskId,
    kind: planned.kind,
    fireAtMs: planned.fireAtMs,
    title: planned.title,
    body: planned.kind === 'ABSOLUTE' ? labels.reminder : labels.dueSoon,
    ...(settings.pinReminders ? { pinned: true } : {}),
    ...(planned.urgent && settings.urgentHere ? { urgent: true } : {}),
  }));
}

/**
 * One full sync (spec 5.8). Reminders off → cancel all (snoozes too). No permission → leave the schedule
 * alone. API failure → keep the current schedule; the next trigger retries. Never throws.
 */
export async function runReminderSync(
  settings: PlanSettings & ReminderDeliveryOptions,
  labels: ReminderLabels,
  deps: ReminderSyncDeps,
): Promise<ReminderSyncOutcome> {
  const log = deps.log ?? warnLog;
  try {
    if (!settings.enabled) {
      await deps.scheduler.cancelAll();
      return { kind: 'disabled' };
    }
    const permission = await deps.getPermission();
    if (!permission.granted) return { kind: 'noPermission' };

    let occurrences: OccurrenceInput[];
    try {
      occurrences = await deps.fetchOccurrences();
    } catch (error) {
      log(`reminder fetch failed: ${errorName(error)}`);
      return { kind: 'fetchFailed' };
    }

    const desired = buildDesiredReminders(occurrences, settings, labels, deps.now());
    const result = await syncReminders(deps.scheduler, desired, log);
    const snoozesCancelled = await pruneSnoozes(deps.scheduler, deps.fetchTaskState, log);
    return { kind: 'synced', result, snoozesCancelled };
  } catch (error) {
    log(`reminder sync failed: ${errorName(error)}`);
    return { kind: 'failed' };
  }
}
