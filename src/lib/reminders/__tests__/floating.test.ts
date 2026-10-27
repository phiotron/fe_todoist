import {
  floatingToEpochMs,
  formatFloating,
  isFloatingInFuture,
  nextWholeHour,
  parseFloating,
  pickerDateToWallClock,
  wallClockToPickerDate,
} from '../floating';

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
/** 10:00 on 23 Oct 2026 in Asia/Ho_Chi_Minh. */
const NOW = Date.parse('2026-10-23T03:00:00Z');
const HCM = 'Asia/Ho_Chi_Minh';

describe('parseFloating', () => {
  it.each([
    ['2026-10-24T09:05:00', { year: 2026, month: 10, day: 24, hour: 9, minute: 5 }],
    ['2026-10-24T09:05', { year: 2026, month: 10, day: 24, hour: 9, minute: 5 }],
  ])('parses %s', (value, expected) => {
    expect(parseFloating(value)).toEqual(expected);
  });

  it.each([
    '2026-10-24 09:05',
    '2026-10-24T24:00',
    '2026-10-24T09:60',
    '2026-02-30T09:00',
    '2026-10-24T09:05:00Z',
    '2026-10-24T09:05:00+07:00',
    '',
  ])('rejects %p', (value) => {
    expect(parseFloating(value)).toBeNull();
  });

  it('rejects null and undefined', () => {
    expect(parseFloating(null)).toBeNull();
    expect(parseFloating(undefined)).toBeNull();
  });
});

describe('formatFloating', () => {
  it('pads to yyyy-MM-ddTHH:mm', () => {
    expect(formatFloating({ year: 2026, month: 3, day: 5, hour: 7, minute: 9 })).toBe('2026-03-05T07:09');
  });
});

describe('floatingToEpochMs', () => {
  it('reads the wall clock in the account time zone', () => {
    expect(iso(floatingToEpochMs('2026-10-24T09:00:00', HCM))).toBe('2026-10-24T02:00:00.000Z');
    expect(iso(floatingToEpochMs('2026-10-24T09:00:00', 'America/New_York'))).toBe('2026-10-24T13:00:00.000Z');
    expect(floatingToEpochMs('garbage', HCM)).toBeNull();
  });
});

describe('isFloatingInFuture', () => {
  it('is strictly after now', () => {
    expect(isFloatingInFuture('2026-10-23T10:01', HCM, NOW)).toBe(true);
    expect(isFloatingInFuture('2026-10-23T10:00', HCM, NOW)).toBe(false);
    expect(isFloatingInFuture('2026-10-23T09:59', HCM, NOW)).toBe(false);
    expect(isFloatingInFuture('nope', HCM, NOW)).toBe(false);
  });
});

describe('nextWholeHour', () => {
  it('rounds up to the next hour on the account clock', () => {
    expect(nextWholeHour(NOW, HCM)).toEqual({ year: 2026, month: 10, day: 23, hour: 11, minute: 0 });
    expect(nextWholeHour(Date.parse('2026-10-23T03:40:00Z'), HCM)).toEqual({
      year: 2026, month: 10, day: 23, hour: 11, minute: 0,
    });
  });

  it('rolls over midnight', () => {
    expect(nextWholeHour(Date.parse('2026-10-23T16:30:00Z'), HCM)).toEqual({
      year: 2026, month: 10, day: 24, hour: 0, minute: 0,
    });
  });
});

describe('picker conversion', () => {
  it('keeps the wall-clock fields in device local time', () => {
    const date = wallClockToPickerDate({ year: 2026, month: 10, day: 24, hour: 7, minute: 45 });
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()])
      .toEqual([2026, 9, 24, 7, 45, 0]);
    expect(pickerDateToWallClock(new Date(2026, 9, 24, 7, 45, 30))).toEqual({
      year: 2026, month: 10, day: 24, hour: 7, minute: 45,
    });
  });
});
