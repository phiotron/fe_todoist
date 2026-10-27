/**
 * Wall clock <-> instant conversion in an IANA time zone using Intl only (no date library).
 * Pure functions: reminders follow the ACCOUNT time zone (spec 5.2), not the device one.
 */

export const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const DAY_MS = 86_400_000;

export interface CalendarDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

export interface WallClock extends CalendarDate {
  /** 0-23 */
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(timeZone: string | null | undefined): string {
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

function wallClockWithSeconds(epochMs: number, timeZone: string): WallClock & { second: number } {
  const parts = formatterFor(timeZone).formatToParts(new Date(epochMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const hour = read('hour');
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // Some engines print midnight as "24" even with hourCycle h23.
    hour: hour === 24 ? 0 : hour,
    minute: read('minute'),
    second: read('second'),
  };
}

export function wallClockAt(epochMs: number, timeZone: string): WallClock {
  const wall = wallClockWithSeconds(epochMs, timeZone);
  return { year: wall.year, month: wall.month, day: wall.day, hour: wall.hour, minute: wall.minute };
}

/** Zone offset at that instant in ms (local wall clock minus UTC). */
function offsetMs(epochMs: number, timeZone: string): number {
  const wall = wallClockWithSeconds(epochMs, timeZone);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return wallAsUtc - Math.floor(epochMs / 1000) * 1000;
}

function sameWallClock(a: WallClock, b: WallClock): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;
}

/**
 * Instant of a wall-clock time in a zone. Offsets are sampled a day before, at and a day after the
 * guess (DST changes never happen twice within two days). Time inside a DST gap → the later candidate
 * (clock moved forward, 02:30 → 03:30); time repeated by fall-back → the earlier occurrence.
 */
export function zonedWallClockToEpochMs(local: WallClock, timeZone: string): number {
  const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const offsets = new Set([
    offsetMs(guess - DAY_MS, timeZone),
    offsetMs(guess, timeZone),
    offsetMs(guess + DAY_MS, timeZone),
  ]);
  const candidates = [...offsets].map((offset) => guess - offset);
  const matching = candidates.filter((candidate) => sameWallClock(wallClockAt(candidate, timeZone), local));
  return matching.length > 0 ? Math.min(...matching) : Math.max(...candidates);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "yyyy-MM-dd" → calendar date; null when malformed or impossible (2026-02-30). */
export function parseIsoDate(value: string): CalendarDate | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}
