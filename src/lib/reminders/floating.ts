import { parseIsoDate, wallClockAt, zonedWallClockToEpochMs, type WallClock } from './zonedTime';

/**
 * Floating date-times of the API (spec 5.2): "yyyy-MM-ddTHH:mm[:ss]", no zone, read in the ACCOUNT time zone.
 */

const FLOATING = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const HOUR_MS = 3_600_000;

/** Floating value → wall clock; null when malformed, impossible or zoned. Seconds are ignored. */
export function parseFloating(value: string | null | undefined): WallClock | null {
  if (!value) return null;
  const match = FLOATING.exec(value);
  if (!match) return null;
  const date = parseIsoDate(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = match[4] === undefined ? 0 : Number(match[4]);
  if (!date || hour > 23 || minute > 59 || second > 59) return null;
  return { ...date, hour, minute };
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** Wall clock → "yyyy-MM-ddTHH:mm", the form POST tasks/{id}/reminders expects for `at` (spec 12.8). */
export function formatFloating(wall: WallClock): string {
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

export function floatingToEpochMs(value: string, timeZone: string): number | null {
  const wall = parseFloating(value);
  return wall ? zonedWallClockToEpochMs(wall, timeZone) : null;
}

export function isFloatingInFuture(value: string, timeZone: string, nowMs: number): boolean {
  const epochMs = floatingToEpochMs(value, timeZone);
  return epochMs !== null && epochMs > nowMs;
}

/** The next whole hour after now on the account clock: default value for a new ABSOLUTE reminder. */
export function nextWholeHour(nowMs: number, timeZone: string): WallClock {
  const now = wallClockAt(nowMs, timeZone);
  const startOfHour = zonedWallClockToEpochMs({ ...now, minute: 0 }, timeZone);
  return wallClockAt(startOfHour + HOUR_MS, timeZone);
}

/** Android pickers work in device local time; only the wall-clock fields matter (they mean account time). */
export function wallClockToPickerDate(wall: WallClock): Date {
  return new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0, 0);
}

export function pickerDateToWallClock(date: Date): WallClock {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}
