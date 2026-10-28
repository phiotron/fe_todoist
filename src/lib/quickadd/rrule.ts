import type { RecurrenceSpec } from '../recurrence/types';

/**
 * RecurrenceSpec → RRULE subset of contract 8.1 (no "RRULE:" prefix, INTERVAL only when > 1, UNTIL as yyyyMMdd).
 * Lives in lib/quickadd so lib/recurrence/types.ts stays the shared types-only file of M6c; M6c may move it.
 */
export function toRRule(spec: RecurrenceSpec): string {
  const parts = [`FREQ=${spec.freq}`];
  if (spec.interval > 1) parts.push(`INTERVAL=${spec.interval}`);
  if (spec.byMonth?.length) parts.push(`BYMONTH=${spec.byMonth.join(',')}`);
  if (spec.byDay?.length) {
    parts.push(`BYDAY=${spec.byDay.map((day) => `${day.ordinal ?? ''}${day.weekday}`).join(',')}`);
  }
  if (spec.byMonthDay?.length) parts.push(`BYMONTHDAY=${spec.byMonthDay.join(',')}`);
  if (spec.bySetPos !== undefined) parts.push(`BYSETPOS=${spec.bySetPos}`);
  if (spec.untilDate) parts.push(`UNTIL=${spec.untilDate.replace(/-/g, '')}`);
  return parts.join(';');
}
