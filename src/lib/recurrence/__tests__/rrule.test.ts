import { InvalidRecurrenceError, fromRRule, toRRule } from '../rrule';
import { fromRRule as reexportedFromRRule, toRRule as reexportedToRRule, type RecurrenceSpec } from '../types';

describe('fromRRule', () => {
  it('reads every part of the subset', () => {
    expect(fromRRule('FREQ=MONTHLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;UNTIL=20271231')).toEqual({
      freq: 'MONTHLY',
      interval: 2,
      byDay: [{ weekday: 'MO' }, { weekday: 'TU' }, { weekday: 'WE' }, { weekday: 'TH' }, { weekday: 'FR' }],
      bySetPos: -1,
      untilDate: '2027-12-31',
      fromCompletion: false,
    });
  });

  it('reads ordinal weekdays, month days and months', () => {
    expect(fromRRule('FREQ=YEARLY;BYMONTH=11;BYDAY=4TH')).toMatchObject({ byMonth: [11], byDay: [{ weekday: 'TH', ordinal: 4 }] });
    expect(fromRRule('FREQ=MONTHLY;BYDAY=-1FR').byDay).toEqual([{ weekday: 'FR', ordinal: -1 }]);
    expect(fromRRule('FREQ=MONTHLY;BYMONTHDAY=-1').byMonthDay).toEqual([-1]);
    expect(fromRRule('FREQ=MONTHLY;BYMONTHDAY=1,15').byMonthDay).toEqual([1, 15]);
  });

  it.each([
    '',
    'RRULE:FREQ=DAILY',
    'FREQ=HOURLY',
    'FREQ=DAILY;COUNT=3',
    'FREQ=DAILY;BYHOUR=9',
    'FREQ=DAILY;BYMINUTE=30',
    'FREQ=DAILY;WKST=MO',
    'INTERVAL=2',
    'FREQ=DAILY;INTERVAL=0',
    'FREQ=DAILY;INTERVAL=1000',
    'FREQ=DAILY;INTERVAL=abc',
    'FREQ=DAILY;INTERVAL=+2',
    'FREQ=DAILY;FREQ=WEEKLY',
    'FREQ=WEEKLY;BYDAY=XX',
    'FREQ=WEEKLY;BYDAY=',
    'FREQ=WEEKLY;BYDAY=1MO',
    'FREQ=MONTHLY;BYDAY=5MO',
    'FREQ=MONTHLY;BYDAY=-2MO',
    'FREQ=MONTHLY;BYDAY=0MO',
    'FREQ=MONTHLY;BYMONTHDAY=0',
    'FREQ=MONTHLY;BYMONTHDAY=32',
    'FREQ=MONTHLY;BYMONTHDAY=-2',
    'FREQ=WEEKLY;BYMONTHDAY=3',
    'FREQ=YEARLY;BYMONTH=13',
    'FREQ=YEARLY;BYMONTH=0',
    'FREQ=MONTHLY;BYSETPOS=-1',
    'FREQ=MONTHLY;BYDAY=MO,FR;BYSETPOS=5',
    'FREQ=MONTHLY;BYDAY=MO,FR;BYSETPOS=-2',
    'FREQ=DAILY;UNTIL=2026-10-29',
    'FREQ=DAILY;UNTIL=20261332',
    'freq=daily',
    'FREQ=DAILY;',
    'FREQ=DAILY;;INTERVAL=2',
    'FREQ = DAILY',
  ])('rejects %j (outside the subset)', (rule) => {
    expect(() => fromRRule(rule)).toThrow(InvalidRecurrenceError);
  });
});

describe('toRRule', () => {
  const base: RecurrenceSpec = { freq: 'DAILY', interval: 1, fromCompletion: false };

  it('writes the canonical order and drops INTERVAL=1', () => {
    expect(toRRule(base)).toBe('FREQ=DAILY');
    expect(toRRule({ ...base, freq: 'WEEKLY', interval: 2, byDay: [{ weekday: 'MO' }] })).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO');
    expect(
      toRRule({ freq: 'YEARLY', interval: 1, untilDate: '2026-12-31', byMonthDay: [29], byMonth: [2], fromCompletion: false }),
    ).toBe('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;UNTIL=20261231');
    expect(
      toRRule({
        freq: 'MONTHLY',
        interval: 1,
        bySetPos: -1,
        byDay: ['MO', 'TU', 'WE', 'TH', 'FR'].map((weekday) => ({ weekday: weekday as 'MO' })),
        fromCompletion: false,
      }),
    ).toBe('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1');
    expect(toRRule({ ...base, freq: 'MONTHLY', byDay: [{ weekday: 'FR', ordinal: 3 }, { weekday: 'MO', ordinal: -1 }] })).toBe(
      'FREQ=MONTHLY;BYDAY=3FR,-1MO',
    );
  });

  it('round-trips the canonical strings (same text the backend stores)', () => {
    for (const rule of [
      'FREQ=DAILY',
      'FREQ=DAILY;INTERVAL=3',
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
      'FREQ=MONTHLY;BYMONTHDAY=31',
      'FREQ=MONTHLY;BYMONTHDAY=-1',
      'FREQ=MONTHLY;BYDAY=3FR',
      'FREQ=YEARLY;BYMONTH=11;BYDAY=4TH',
      'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;UNTIL=20301231',
      'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
    ]) {
      expect(toRRule(fromRRule(rule))).toBe(rule);
    }
  });

  it('is also exported from types.ts (contract 8.1)', () => {
    expect(reexportedToRRule).toBe(toRRule);
    expect(reexportedFromRRule).toBe(fromRRule);
  });
});
