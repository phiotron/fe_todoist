import { makeTask } from '../../../test/m1Fixtures';
import {
  HOUR_HEIGHT,
  clockLabel,
  minutesOfDue,
  placeTimed,
  planDayDrop,
  planSlotDrop,
  shiftAnchor,
  slotMinutes,
  tasksOfDay,
  visibleDays,
  windowOf,
} from '../calendarModel';

describe('visibleDays / windowOf', () => {
  it('week starts on the chosen first day', () => {
    // 2026-11-04 is a Wednesday.
    expect(windowOf('WEEK', '2026-11-04', 1)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(windowOf('WEEK', '2026-11-04', 7)).toEqual({ from: '2026-11-01', to: '2026-11-07' });
  });

  it('3 days and agenda start at the anchor', () => {
    expect(visibleDays('THREE_DAYS', '2026-11-04', 1)).toEqual(['2026-11-04', '2026-11-05', '2026-11-06']);
    expect(visibleDays('AGENDA', '2026-11-04', 1)).toHaveLength(14);
    expect(visibleDays('AGENDA', '2026-11-04', 1)[13]).toBe('2026-11-17');
  });

  it('month = whole weeks (5 or 6), never more than the 42 days the server takes', () => {
    const november = visibleDays('MONTH', '2026-11-17', 1); // 1 Nov 2026 = Sunday, 30 Nov = Monday → 6 weeks
    expect(november[0]).toBe('2026-10-26');
    expect(november).toHaveLength(42);
    expect(november[41]).toBe('2026-12-06');
    const january = visibleDays('MONTH', '2027-01-10', 1); // 1 Jan 2027 = Friday, 31 Jan = Sunday → 5 weeks
    expect(january[0]).toBe('2026-12-28');
    expect(january).toHaveLength(35);
    const august = visibleDays('MONTH', '2026-08-10', 1); // 1 Aug 2026 = Saturday → 6 weeks
    expect(august[0]).toBe('2026-07-27');
    expect(august).toHaveLength(42);
    for (const mode of ['AGENDA', 'THREE_DAYS', 'WEEK', 'MONTH'] as const) {
      expect(visibleDays(mode, '2026-08-10', 7).length).toBeLessThanOrEqual(42);
    }
  });
});

describe('shiftAnchor', () => {
  it('moves one period', () => {
    expect(shiftAnchor('WEEK', '2026-11-04', 1)).toBe('2026-11-11');
    expect(shiftAnchor('THREE_DAYS', '2026-11-04', -1)).toBe('2026-11-01');
    expect(shiftAnchor('AGENDA', '2026-11-04', 1)).toBe('2026-11-18');
    expect(shiftAnchor('MONTH', '2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftAnchor('MONTH', '2026-01-15', -1)).toBe('2025-12-01');
  });
});

describe('tasksOfDay / placeTimed', () => {
  it('splits all-day and timed tasks of one day, timed by start', () => {
    const tasks = [
      makeTask({ id: 'late', dueDate: null, dueDatetime: '2026-11-04T15:00:00' }),
      makeTask({ id: 'all', dueDate: '2026-11-04', dueDatetime: null }),
      makeTask({ id: 'early', dueDate: null, dueDatetime: '2026-11-04T08:30:00' }),
      makeTask({ id: 'other', dueDate: '2026-11-05', dueDatetime: null }),
    ];
    const day = tasksOfDay(tasks, '2026-11-04');
    expect(day.allDay.map((task) => task.id)).toEqual(['all']);
    expect(day.timed.map((task) => task.id)).toEqual(['early', 'late']);
    expect(minutesOfDue(tasks[2])).toBe(510);
    expect(minutesOfDue(tasks[1])).toBeNull();
  });

  it('places by time and duration (30 minutes when none) and ends at midnight', () => {
    const placements = placeTimed([
      makeTask({ id: 'a', dueDatetime: '2026-11-04T09:00:00', durationMinutes: 60 }),
      makeTask({ id: 'b', dueDatetime: '2026-11-04T23:30:00', durationMinutes: 120 }),
      makeTask({ id: 'c', dueDatetime: '2026-11-04T12:00:00', durationMinutes: null }),
    ]);
    const byId = Object.fromEntries(placements.map((p) => [p.task.id, p]));
    expect(byId.a.top).toBe(9 * HOUR_HEIGHT);
    expect(byId.a.height).toBe(HOUR_HEIGHT);
    expect(byId.c.height).toBe(HOUR_HEIGHT / 2);
    expect(byId.b.top + byId.b.height).toBe(24 * HOUR_HEIGHT);
  });

  it('puts overlapping tasks in lanes side by side', () => {
    const placements = placeTimed([
      makeTask({ id: 'a', dueDatetime: '2026-11-04T09:00:00', durationMinutes: 60 }),
      makeTask({ id: 'b', dueDatetime: '2026-11-04T09:30:00', durationMinutes: 60 }),
      makeTask({ id: 'c', dueDatetime: '2026-11-04T10:00:00', durationMinutes: 30 }),
      makeTask({ id: 'd', dueDatetime: '2026-11-04T14:00:00', durationMinutes: 30 }),
    ]);
    const byId = Object.fromEntries(placements.map((p) => [p.task.id, p]));
    expect([byId.a.lane, byId.b.lane, byId.c.lane]).toEqual([0, 1, 0]);
    expect(byId.a.lanes).toBe(2);
    expect(byId.d.lanes).toBe(1);
  });
});

describe('drops', () => {
  it('turns a vertical position into a 30-minute slot, kept inside the day', () => {
    expect(slotMinutes(0)).toBe(0);
    expect(slotMinutes(HOUR_HEIGHT / 2 - 1)).toBe(0);
    expect(slotMinutes(HOUR_HEIGHT / 2)).toBe(30);
    expect(slotMinutes(HOUR_HEIGHT * 9 + 5)).toBe(540);
    expect(slotMinutes(-20)).toBe(0);
    expect(slotMinutes(HOUR_HEIGHT * 30)).toBe(1410);
    expect(clockLabel(1410)).toBe('23:30');
    expect(clockLabel(540)).toBe('09:00');
  });

  it('a time slot gives due + the task duration, or 30 minutes (version attached)', () => {
    expect(planSlotDrop(makeTask({ version: 3, durationMinutes: null }), '2026-11-05', 540)).toEqual({
      version: 3,
      dueDatetime: '2026-11-05T09:00:00',
      durationMinutes: 30,
    });
    expect(planSlotDrop(makeTask({ version: 1, durationMinutes: 90 }), '2026-11-05', 570).durationMinutes).toBe(90);
  });

  it('a day drop is one batch SCHEDULE', () => {
    expect(planDayDrop(['a', 'b'], '2026-11-07')).toEqual({ action: 'SCHEDULE', taskIds: ['a', 'b'], date: '2026-11-07' });
  });
});
