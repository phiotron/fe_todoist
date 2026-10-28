import { floatingToEpochMs } from './floating';
import { resolveTimeZone } from './zonedTime';

/** At most this many reminders are scheduled on the device (spec 5.8). */
export const MAX_SCHEDULED_REMINDERS = 50;

export type OccurrenceKind = 'AUTO' | 'ABSOLUTE' | 'RELATIVE';

/** Item of GET /api/v1/tasks/reminders as the planner needs it (spec 12.8). */
export interface OccurrenceInput {
  /** "auto:<taskId>" or the reminder id; used as the device schedule id (spec 5.8). */
  key: string;
  taskId: string;
  kind: OccurrenceKind;
  /** Floating "yyyy-MM-ddTHH:mm:ss" computed by the server in the account time zone. */
  fireAt: string;
  content: string;
  /** M12: urgent reminder (absent = false; AUTO is never urgent). */
  urgent?: boolean;
}

export interface PlanSettings {
  /** me/settings.remindersEnabled — applied by the app, the server does not filter on it. */
  enabled: boolean;
  /** Account time zone (spec 5.2). */
  timeZone: string;
}

export interface PlannedReminder {
  id: string;
  taskId: string;
  kind: OccurrenceKind;
  title: string;
  fireAtMs: number;
  /** M12: carried from the occurrence (only when true). */
  urgent?: boolean;
}

function byFireTimeThenId(a: PlannedReminder, b: PlannedReminder): number {
  if (a.fireAtMs !== b.fireAtMs) return a.fireAtMs - b.fireAtMs;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * Reminders that should exist on the device right now (spec 5.2, 5.8): the server already computed the fire
 * times; this only reads them in the account time zone, drops passed ones (never caught up), keeps one per key
 * and one per (task, instant) — a custom reminder wins over the automatic one — nearest first, at most `limit`.
 */
export function planReminders(
  occurrences: readonly OccurrenceInput[],
  settings: PlanSettings,
  nowMs: number,
  limit: number = MAX_SCHEDULED_REMINDERS,
): PlannedReminder[] {
  if (!settings.enabled) return [];
  const timeZone = resolveTimeZone(settings.timeZone);
  const seenKeys = new Set<string>();
  const bySlot = new Map<string, PlannedReminder>();
  for (const occurrence of occurrences) {
    if (seenKeys.has(occurrence.key)) continue;
    seenKeys.add(occurrence.key);
    const fireAtMs = floatingToEpochMs(occurrence.fireAt, timeZone);
    if (fireAtMs === null || fireAtMs <= nowMs) continue;
    const planned: PlannedReminder = {
      id: occurrence.key,
      taskId: occurrence.taskId,
      kind: occurrence.kind,
      title: occurrence.content,
      fireAtMs,
      ...(occurrence.urgent ? { urgent: true } : {}),
    };
    const slot = `${occurrence.taskId}|${fireAtMs}`;
    const existing = bySlot.get(slot);
    if (!existing || (existing.kind === 'AUTO' && planned.kind !== 'AUTO')) bySlot.set(slot, planned);
  }
  return [...bySlot.values()].sort(byFireTimeThenId).slice(0, limit);
}
