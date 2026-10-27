import {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  parseIsoDate,
  resolveTimeZone,
  wallClockAt,
  zonedWallClockToEpochMs,
} from '../zonedTime';

const iso = (ms: number) => new Date(ms).toISOString();

describe('wallClockAt', () => {
  it('reads the wall clock of an instant in the given zone', () => {
    expect(wallClockAt(Date.parse('2026-10-23T17:30:00Z'), 'Asia/Ho_Chi_Minh')).toEqual({
      year: 2026, month: 10, day: 24, hour: 0, minute: 30,
    });
    expect(wallClockAt(Date.parse('2026-10-23T03:59:00Z'), 'America/New_York')).toEqual({
      year: 2026, month: 10, day: 22, hour: 23, minute: 59,
    });
  });

  it('reports midnight as hour 0, never 24', () => {
    expect(wallClockAt(Date.parse('2026-10-23T17:00:00Z'), 'Asia/Ho_Chi_Minh').hour).toBe(0);
  });
});

describe('zonedWallClockToEpochMs', () => {
  it.each<[string, number, number, number, number, number, string]>([
    ['Asia/Ho_Chi_Minh', 2026, 10, 24, 9, 0, '2026-10-24T02:00:00.000Z'],
    ['America/New_York', 2026, 10, 24, 9, 0, '2026-10-24T13:00:00.000Z'],
    ['America/New_York', 2026, 12, 24, 9, 0, '2026-12-24T14:00:00.000Z'],
    ['Pacific/Kiritimati', 2026, 10, 24, 0, 0, '2026-10-23T10:00:00.000Z'],
    ['UTC', 2026, 2, 28, 23, 59, '2026-02-28T23:59:00.000Z'],
  ])('%s %i-%i-%i %i:%i → %s', (zone, year, month, day, hour, minute, expected) => {
    expect(iso(zonedWallClockToEpochMs({ year, month, day, hour, minute }, zone))).toBe(expected);
  });

  it('moves a time inside the spring-forward gap to the later instant', () => {
    // New York 2026-03-08: 02:00 EST jumps to 03:00 EDT, so 02:30 does not exist → 03:30 EDT.
    expect(iso(zonedWallClockToEpochMs({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, 'America/New_York')))
      .toBe('2026-03-08T07:30:00.000Z');
  });

  it('picks the first occurrence of a time repeated by fall-back', () => {
    // Berlin 2026-10-25: 03:00 CEST goes back to 02:00 CET, 02:30 happens twice.
    expect(iso(zonedWallClockToEpochMs({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 }, 'Europe/Berlin')))
      .toBe('2026-10-25T00:30:00.000Z');
    // New York 2026-11-01: 01:30 happens twice (EDT then EST).
    expect(iso(zonedWallClockToEpochMs({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York')))
      .toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('time zone validation', () => {
  it('accepts IANA zones and rejects anything else', () => {
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });

  it('falls back to the default zone', () => {
    expect(resolveTimeZone('Europe/London')).toBe('Europe/London');
    expect(resolveTimeZone('Not/AZone')).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(undefined)).toBe('Asia/Ho_Chi_Minh');
  });
});

describe('parseIsoDate', () => {
  it('parses yyyy-MM-dd and rejects impossible or malformed dates', () => {
    expect(parseIsoDate('2026-10-24')).toEqual({ year: 2026, month: 10, day: 24 });
    expect(parseIsoDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('24/10/2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });
});
