import { toRRule } from '../rrule';

describe('toRRule (contract 8.1: RFC 5545 subset, no RRULE: prefix)', () => {
  it.each([
    [{ freq: 'DAILY', interval: 1, fromCompletion: false }, 'FREQ=DAILY'],
    [{ freq: 'WEEKLY', interval: 2, byDay: [{ weekday: 'MO' }], fromCompletion: false }, 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO'],
    [{ freq: 'MONTHLY', interval: 1, byDay: [{ weekday: 'FR', ordinal: 3 }], fromCompletion: false }, 'FREQ=MONTHLY;BYDAY=3FR'],
    [{ freq: 'MONTHLY', interval: 1, byMonthDay: [-1], fromCompletion: true }, 'FREQ=MONTHLY;BYMONTHDAY=-1'],
    [
      {
        freq: 'MONTHLY',
        interval: 1,
        byDay: [{ weekday: 'MO' }, { weekday: 'FR' }],
        bySetPos: -1,
        untilDate: '2026-12-31',
        fromCompletion: false,
      },
      'FREQ=MONTHLY;BYDAY=MO,FR;BYSETPOS=-1;UNTIL=20261231',
    ],
    [{ freq: 'YEARLY', interval: 1, byMonth: [1], byMonthDay: [5], fromCompletion: false }, 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=5'],
  ] as const)('%j → %s', (spec, rule) => {
    expect(toRRule(spec as Parameters<typeof toRRule>[0])).toBe(rule);
  });
});
