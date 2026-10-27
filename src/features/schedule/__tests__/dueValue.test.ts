import { makeTask } from '../../../test/m1Fixtures';
import { lightPalette as palette } from '../../../theme';
import { dueTone } from '../../tasks/dueTone';
import { DEFAULT_PRIORITY, PRIORITIES, priorityColor, prioritySoft } from '../../tasks/priority';
import { NO_DUE, dueValueOf, localTime, withDate, withDuration, withTime, withoutTime } from '../dueValue';

const TZ = 'Asia/Ho_Chi_Minh';
const now = new Date('2026-10-23T03:00:00Z'); // Fri 23/10 10:00 local

describe('due values (floating)', () => {
  it('reads the due trio of a task', () => {
    expect(dueValueOf(makeTask({ dueDatetime: '2026-10-24T09:30:00', durationMinutes: 30 }))).toEqual({
      dueDate: null,
      dueDatetime: '2026-10-24T09:30:00',
      durationMinutes: 30,
    });
    expect(dueValueOf(makeTask())).toEqual(NO_DUE);
  });

  it('moves the day and keeps the time and the duration', () => {
    const timed = { dueDate: null, dueDatetime: '2026-10-24T09:30:00', durationMinutes: 30 };
    expect(withDate(timed, '2026-10-26')).toEqual({ dueDate: null, dueDatetime: '2026-10-26T09:30:00', durationMinutes: 30 });
    expect(withDate(NO_DUE, '2026-10-26')).toEqual({ dueDate: '2026-10-26', dueDatetime: null, durationMinutes: null });
  });

  it('adds a time (on the chosen day, or today), removes it with the duration, and sets a duration only with a time', () => {
    expect(withTime({ dueDate: '2026-10-26', dueDatetime: null, durationMinutes: null }, '14:00', '2026-10-23')).toEqual({
      dueDate: null,
      dueDatetime: '2026-10-26T14:00:00',
      durationMinutes: null,
    });
    expect(withTime(NO_DUE, '08:15', '2026-10-23').dueDatetime).toBe('2026-10-23T08:15:00');
    const timed = { dueDate: null, dueDatetime: '2026-10-26T14:00:00', durationMinutes: 45 };
    expect(withoutTime(timed)).toEqual({ dueDate: '2026-10-26', dueDatetime: null, durationMinutes: null });
    expect(withDuration(timed, 90).durationMinutes).toBe(90);
    expect(withDuration({ dueDate: '2026-10-26', dueDatetime: null, durationMinutes: null }, 30).durationMinutes).toBeNull();
    expect(localTime(new Date(2026, 9, 5, 7, 4))).toBe('07:04');
  });
});

describe('priority and date colours (design section 2)', () => {
  it('maps P1–P4 to the priority tokens, default P4 (BR-03)', () => {
    expect(PRIORITIES).toEqual([1, 2, 3, 4]);
    expect(DEFAULT_PRIORITY).toBe(4);
    expect(priorityColor(1, palette)).toBe(palette.p1);
    expect(prioritySoft(2, palette)).toBe(palette.p2s);
    expect(priorityColor(4, palette)).toBe(palette.p4);
    expect(prioritySoft(4, palette)).toBe('transparent');
    expect(priorityColor(9, palette)).toBe(palette.p4);
  });

  it('colours a due: overdue warn, today ok, tomorrow p2, later vio, none / done mute', () => {
    const tone = (task: Parameters<typeof dueTone>[0]) => dueTone(task, now, TZ, palette);
    expect(tone({ dueDate: '2026-10-22', dueDatetime: null })).toBe(palette.warn);
    expect(tone({ dueDate: null, dueDatetime: '2026-10-23T09:00:00' })).toBe(palette.warn); // 09:00 already passed
    expect(tone({ dueDate: null, dueDatetime: '2026-10-23T18:00:00' })).toBe(palette.ok);
    expect(tone({ dueDate: '2026-10-24', dueDatetime: null })).toBe(palette.p2);
    expect(tone({ dueDate: '2026-10-30', dueDatetime: null })).toBe(palette.vio);
    expect(tone({ dueDate: '2026-10-22', dueDatetime: null, completedAt: '2026-10-22T01:00:00Z' })).toBe(palette.mute);
    expect(tone({ dueDate: null, dueDatetime: null })).toBe(palette.mute);
  });
});
