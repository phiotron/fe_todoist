import { meridiem } from '../dates/displayFormat';
import { parseFloating } from './floating';
import type { WallClock } from './zonedTime';

/** Values of me/settings.autoReminderMinutes besides null = off (spec 12.1.1). */
export const AUTO_REMINDER_MINUTES = [0, 5, 10, 15, 30, 45, 60, 120, 180, 1440] as const;
/** Server default [CXM]. */
export const DEFAULT_AUTO_REMINDER_MINUTES = 30;
/** Choices offered for a RELATIVE reminder; the server accepts 0–10 080 (spec 5.9). */
export const RELATIVE_REMINDER_MINUTES = [0, 5, 10, 15, 30, 45, 60, 120, 180, 1440] as const;
export const MAX_RELATIVE_OFFSET_MINUTES = 10_080;

export type OffsetUnit = 'atTime' | 'minutes' | 'hours' | 'days';

/** "N minutes before the due time" in the largest whole unit, for labels. */
export function describeOffset(minutes: number): { unit: OffsetUnit; count: number } {
  if (minutes === 0) return { unit: 'atTime', count: 0 };
  if (minutes % 1440 === 0) return { unit: 'days', count: minutes / 1440 };
  if (minutes % 60 === 0) return { unit: 'hours', count: minutes / 60 };
  return { unit: 'minutes', count: minutes };
}

/** me/settings.dateFormat / timeFormat (spec 12.1.1). */
export type DateFormat = 'DMY' | 'MDY';
export type TimeFormat = 'H24' | 'H12';

const pad = (value: number) => String(value).padStart(2, '0');

export function formatWallClock(wall: WallClock, dateFormat: DateFormat, timeFormat: TimeFormat): string {
  const date =
    dateFormat === 'MDY'
      ? `${pad(wall.month)}/${pad(wall.day)}/${wall.year}`
      : `${pad(wall.day)}/${pad(wall.month)}/${wall.year}`;
  if (timeFormat === 'H12') {
    const hour = wall.hour % 12 === 0 ? 12 : wall.hour % 12;
    return `${date} ${hour}:${pad(wall.minute)} ${meridiem(wall.hour)}`;
  }
  return `${date} ${pad(wall.hour)}:${pad(wall.minute)}`;
}

export function formatFloatingForDisplay(value: string, dateFormat: DateFormat, timeFormat: TimeFormat): string | null {
  const wall = parseFloating(value);
  return wall ? formatWallClock(wall, dateFormat, timeFormat) : null;
}

/**
 * A reminder not sent yet (Quick Add) or about to be sent (task sheet). Same shape as the POST body.
 * M12: time reminders may be `urgent` (full-screen alarm on the chosen device); LOCATION = when arriving at / leaving a
 * saved place (`locationName` is for labels only, never sent).
 */
export type ReminderDraft =
  | { type: 'ABSOLUTE'; at: string; urgent?: boolean }
  | { type: 'RELATIVE'; minuteOffset: number; urgent?: boolean }
  | { type: 'LOCATION'; locationId: string; trigger: 'ON_ENTER' | 'ON_LEAVE'; locationName?: string };

export function draftId(draft: ReminderDraft): string {
  if (draft.type === 'LOCATION') return `LOCATION:${draft.locationId}:${draft.trigger}`;
  const base = draft.type === 'ABSOLUTE' ? `ABSOLUTE:${draft.at}` : `RELATIVE:${draft.minuteOffset}`;
  return draft.urgent ? `${base}:urgent` : base;
}

export function addDraft(drafts: readonly ReminderDraft[], draft: ReminderDraft): ReminderDraft[] {
  const id = draftId(draft);
  return drafts.some((existing) => draftId(existing) === id) ? [...drafts] : [...drafts, draft];
}

/** RELATIVE needs a due time (spec 5.8): without one only ABSOLUTE (and M12 LOCATION) drafts remain. */
export function applicableDrafts(drafts: readonly ReminderDraft[], hasTime: boolean): ReminderDraft[] {
  return hasTime ? [...drafts] : drafts.filter((draft) => draft.type !== 'RELATIVE');
}
