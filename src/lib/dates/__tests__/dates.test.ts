import {
  addDays,
  combineDue,
  dateKeyInZone,
  dayRange,
  describeDeadline,
  describeDue,
  dueTime,
  groupByDueDate,
  groupTodayView,
  isInOverdueBlock,
  isTaskOverdue,
  isoWeekday,
  monthGrid,
  nextUpcomingWindow,
  nowLocal,
  quickDates,
  taskDateKey,
  upcomingLimit,
  weekDays,
  weekStart,
} from '..';
import { DEFAULT_DATE_SETTINGS } from '../settings';

const TZ = 'Asia/Ho_Chi_Minh'; // UTC+7, no DST
const due = (dueDate: string | null, dueDatetime: string | null = null, completedAt: string | null = null) => ({
  dueDate,
  dueDatetime,
  completedAt,
});

describe('calendar helpers', () => {
  it('uses the calendar date and wall clock of the account time zone, not UTC', () => {
    expect(dateKeyInZone(new Date('2026-10-23T16:59:00Z'), TZ)).toBe('2026-10-23');
    expect(dateKeyInZone(new Date('2026-10-23T17:00:00Z'), TZ)).toBe('2026-10-24');
    expect(nowLocal(new Date('2026-10-23T17:05:09Z'), TZ)).toBe('2026-10-24T00:05:09');
  });

  it('adds days across month, year and leap-year ends; ISO weekday 1 = Monday … 7 = Sunday', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isoWeekday('2026-10-23')).toBe(5);
    expect(isoWeekday('2026-10-25')).toBe(7);
    expect(dayRange('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(dayRange('2026-10-30', '2026-10-29')).toEqual([]);
  });

  it('reads the due day and time of floating dues without any zone conversion', () => {
    expect(taskDateKey(due('2026-10-25'))).toBe('2026-10-25');
    expect(taskDateKey(due(null, '2026-10-24T23:30:00'))).toBe('2026-10-24');
    expect(taskDateKey(due(null))).toBeNull();
    expect(dueTime(due(null, '2026-10-24T09:05:00'))).toBe('09:05');
    expect(dueTime(due('2026-10-24'))).toBeNull();
    expect(combineDue('2026-10-24', null)).toEqual({ dueDate: '2026-10-24', dueDatetime: null });
    expect(combineDue('2026-10-24', '09:30')).toEqual({ dueDate: null, dueDatetime: '2026-10-24T09:30:00' });
  });
});

describe('isTaskOverdue (spec 5.1)', () => {
  const now = new Date('2026-10-23T10:00:00Z'); // 17:00 local

  it('timed tasks are overdue as soon as their local time has passed, even today', () => {
    expect(isTaskOverdue(due(null, '2026-10-23T16:59:00'), now, TZ)).toBe(true);
    expect(isTaskOverdue(due(null, '2026-10-23T17:01:00'), now, TZ)).toBe(false);
  });

  it('all-day tasks are overdue only from the next day', () => {
    expect(isTaskOverdue(due('2026-10-22'), now, TZ)).toBe(true);
    expect(isTaskOverdue(due('2026-10-23'), now, TZ)).toBe(false);
  });

  it('switches at local midnight, not UTC midnight', () => {
    expect(isTaskOverdue(due('2026-10-23'), new Date('2026-10-23T17:00:00Z'), TZ)).toBe(true);
    expect(isTaskOverdue(due('2026-10-23'), new Date('2026-10-23T16:59:59Z'), TZ)).toBe(false);
  });

  it('floating time follows the account zone: 09:00 stays 09:00 in another zone', () => {
    const nine = due(null, '2026-10-23T09:00:00');
    const at0830Paris = new Date('2026-10-23T06:30:00Z'); // 08:30 in Paris (UTC+2), 13:30 in Vietnam
    expect(isTaskOverdue(nine, at0830Paris, 'Europe/Paris')).toBe(false);
    expect(isTaskOverdue(nine, at0830Paris, TZ)).toBe(true);
  });

  it('completed tasks and tasks without due are never overdue', () => {
    expect(isTaskOverdue(due('2026-10-01', null, '2026-10-02T00:00:00Z'), now, TZ)).toBe(false);
    expect(isTaskOverdue(due(null), now, TZ)).toBe(false);
  });
});

describe('overdue block (spec 5.1 / 3.1): due DAY before today, not "time already passed"', () => {
  const now = new Date('2026-10-23T10:00:00Z'); // 17:00 local

  it('a timed task whose time passed earlier TODAY is not in the block (it is red in Today, see isTaskOverdue)', () => {
    const passedToday = due(null, '2026-10-23T08:00:00');
    expect(isInOverdueBlock(passedToday, now, TZ)).toBe(false);
    expect(isTaskOverdue(passedToday, now, TZ)).toBe(true);
  });

  it('any open task due on an earlier day is in the block, timed or all-day', () => {
    expect(isInOverdueBlock(due('2026-10-22'), now, TZ)).toBe(true);
    expect(isInOverdueBlock(due(null, '2026-10-22T23:59:00'), now, TZ)).toBe(true);
    expect(isInOverdueBlock(due('2026-10-23'), now, TZ)).toBe(false);
    expect(isInOverdueBlock(due('2026-10-24'), now, TZ)).toBe(false);
  });

  it('completed tasks and tasks without due are never in the block; the day flips at local midnight', () => {
    expect(isInOverdueBlock(due('2026-10-01', null, '2026-10-02T00:00:00Z'), now, TZ)).toBe(false);
    expect(isInOverdueBlock(due(null), now, TZ)).toBe(false);
    expect(isInOverdueBlock(due('2026-10-23'), new Date('2026-10-23T17:00:00Z'), TZ)).toBe(true);
    expect(isInOverdueBlock(due('2026-10-23'), new Date('2026-10-23T16:59:59Z'), TZ)).toBe(false);
  });
});

describe('grouping', () => {
  const now = new Date('2026-10-23T10:00:00Z'); // 17:00 local

  it('splits the Today view into the Overdue block (due day before today) and Today, keeping server order', () => {
    const a = { id: 'a', ...due('2026-10-21') };
    const b = { id: 'b', ...due('2026-10-23') };
    const c = { id: 'c', ...due(null, '2026-10-23T08:00:00') }; // time passed, still today → Today block
    const d = { id: 'd', ...due(null, '2026-10-23T22:00:00') };
    const e = { id: 'e', ...due(null, '2026-10-22T09:00:00') };
    const groups = groupTodayView([a, b, c, d, e], now, TZ);
    expect(groups.overdue.map((t) => t.id)).toEqual(['a', 'e']);
    expect(groups.today.map((t) => t.id)).toEqual(['b', 'c', 'd']);
  });

  it('groups by due day in ascending order and drops tasks without due', () => {
    const tasks = [
      { id: 'a', ...due('2026-10-24') },
      { id: 'b', ...due(null, '2026-10-25T03:00:00') },
      { id: 'c', ...due('2026-10-25') },
      { id: 'd', ...due(null) },
    ];
    expect([...groupByDueDate(tasks).entries()].map(([day, list]) => [day, list.map((t) => t.id)])).toEqual([
      ['2026-10-24', ['a']],
      ['2026-10-25', ['b', 'c']],
    ]);
  });
});

describe('weeks, month grid and quick dates', () => {
  it('starts the week on the configured day', () => {
    expect(weekStart('2026-10-23', 1)).toBe('2026-10-19'); // Monday
    expect(weekStart('2026-10-25', 1)).toBe('2026-10-19'); // Sunday belongs to the week of Monday 19
    expect(weekStart('2026-10-25', 7)).toBe('2026-10-25'); // weeks starting on Sunday
    expect(weekDays('2026-10-19')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });

  it('lays out a month in weeks of 7 cells starting on startDay', () => {
    const grid = monthGrid(2026, 10, 1); // October 2026 starts on a Thursday
    expect(grid[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(grid[grid.length - 1].filter(Boolean).pop()).toBe('2026-10-31');
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it('computes Today / Tomorrow / This weekend / Next week with the default settings', () => {
    expect(quickDates('2026-10-23', DEFAULT_DATE_SETTINGS)).toEqual({
      today: '2026-10-23',
      tomorrow: '2026-10-24',
      thisWeekend: '2026-10-24', // Saturday
      nextWeek: '2026-10-26', // Monday of next week
    });
    expect(quickDates('2026-10-25', DEFAULT_DATE_SETTINGS).nextWeek).toBe('2026-10-26');
  });

  it('"This weekend" is the nearest weekendStartDay AFTER today: Saturday / Sunday → next Saturday (spec 5.2, m8)', () => {
    expect(quickDates('2026-10-23', DEFAULT_DATE_SETTINGS).thisWeekend).toBe('2026-10-24'); // Friday → tomorrow
    expect(quickDates('2026-10-24', DEFAULT_DATE_SETTINGS).thisWeekend).toBe('2026-10-31'); // Saturday → next Saturday
    expect(quickDates('2026-10-25', DEFAULT_DATE_SETTINGS).thisWeekend).toBe('2026-10-31'); // Sunday → next Saturday
    expect(quickDates('2026-10-19', DEFAULT_DATE_SETTINGS).thisWeekend).toBe('2026-10-24'); // Monday
    const sundayWeekend = { ...DEFAULT_DATE_SETTINGS, weekendStartDay: 7 };
    expect(quickDates('2026-10-23', sundayWeekend).thisWeekend).toBe('2026-10-25');
    expect(quickDates('2026-10-25', sundayWeekend).thisWeekend).toBe('2026-11-01');
  });
});

describe('Upcoming day windows (spec 12.3: 14 days by default, at most 2 years ahead)', () => {
  it('limits the view to today + 2 years, clamping 29 February like the server', () => {
    expect(upcomingLimit('2026-10-23')).toBe('2028-10-23');
    expect(upcomingLimit('2028-02-29')).toBe('2030-02-28');
    expect(upcomingLimit('2026-12-31')).toBe('2028-12-31');
  });

  it('builds the next 14-day window from a day, cut at the limit, null past it', () => {
    expect(nextUpcomingWindow('2026-10-23', '2026-10-23')).toEqual({ from: '2026-10-23', to: '2026-11-05' });
    expect(nextUpcomingWindow('2026-11-06', '2026-10-23')).toEqual({ from: '2026-11-06', to: '2026-11-19' });
    expect(nextUpcomingWindow('2028-10-20', '2026-10-23')).toEqual({ from: '2028-10-20', to: '2028-10-23' });
    expect(nextUpcomingWindow('2028-10-23', '2026-10-23')).toEqual({ from: '2028-10-23', to: '2028-10-23' });
    expect(nextUpcomingWindow('2028-10-24', '2026-10-23')).toBeNull();
  });
});

describe('describeDue / describeDeadline', () => {
  const now = new Date('2026-10-23T03:00:00Z'); // Fri 10:00 local

  it('labels relative days, the coming week and far dates', () => {
    expect(describeDue(due('2026-10-23'), now, TZ)).toEqual({
      kind: 'today',
      dateKey: '2026-10-23',
      time: null,
      endTime: null,
      sameYear: true,
    });
    expect(describeDue(due('2026-10-24'), now, TZ)?.kind).toBe('tomorrow');
    expect(describeDue(due('2026-10-22'), now, TZ)?.kind).toBe('yesterday');
    expect(describeDue(due('2026-10-27'), now, TZ)?.kind).toBe('weekday');
    expect(describeDue(due('2026-11-15'), now, TZ)?.kind).toBe('date');
    expect(describeDue(due('2027-01-05'), now, TZ)?.sameYear).toBe(false);
    expect(describeDue(due(null), now, TZ)).toBeNull();
  });

  it('adds the floating time and the end time from the duration', () => {
    expect(describeDue({ ...due(null, '2026-10-23T14:30:00'), durationMinutes: 45 }, now, TZ)).toEqual({
      kind: 'today',
      dateKey: '2026-10-23',
      time: '14:30',
      endTime: '15:15',
      sameYear: true,
    });
    expect(describeDue({ ...due(null, '2026-10-23T23:30:00'), durationMinutes: 60 }, now, TZ)?.endTime).toBe('00:30');
  });

  it('counts the days left until a deadline (negative once passed)', () => {
    expect(describeDeadline('2026-10-26', now, TZ)).toEqual({ dateKey: '2026-10-26', daysLeft: 3 });
    expect(describeDeadline('2026-10-23', now, TZ)?.daysLeft).toBe(0);
    expect(describeDeadline('2026-10-20', now, TZ)?.daysLeft).toBe(-3);
    expect(describeDeadline(null, now, TZ)).toBeNull();
  });
});
