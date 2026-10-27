import { addDays, dateKeyInZone, isTaskOverdue, taskDateKey, type DueFields } from '../../lib/dates';
import { palette } from '../../theme';

/** Design section 2: today ok, overdue warn, tomorrow p2, later vio; no due / completed mute. */
export function dueTone(task: DueFields, now: Date, timeZone: string): string {
  const day = taskDateKey(task);
  if (!day || task.completedAt) return palette.mute;
  if (isTaskOverdue(task, now, timeZone)) return palette.warn;
  const today = dateKeyInZone(now, timeZone);
  if (day === today) return palette.ok;
  if (day === addDays(today, 1)) return palette.p2;
  return day > today ? palette.vio : palette.mute;
}
