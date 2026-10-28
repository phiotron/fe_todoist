import type { Task } from '../../../api/models';
import { dayOfContainer, planDayDrop, undoDueBody } from '../dayDrop';

function task(fields: Partial<Task>): Task {
  return {
    id: 't',
    version: 3,
    dueDate: null,
    dueDatetime: null,
    durationMinutes: null,
    dueString: null,
    dueTimezone: null,
    recurrenceRule: null,
    isRecurring: false,
    ...fields,
  } as Task;
}

const TODAY = '2026-10-28';
const dayOf = (container: string) => dayOfContainer(container, TODAY);

describe('dayOfContainer', () => {
  it('maps today / d-<day> to a day; overdue and others to null', () => {
    expect(dayOf('today')).toBe(TODAY);
    expect(dayOf('d-2026-10-30')).toBe('2026-10-30');
    expect(dayOf('overdue')).toBeNull();
    expect(dayOf('none')).toBeNull();
  });
});

describe('planDayDrop — Today: Overdue → today drops the time', () => {
  const overdueTimed = task({ dueDatetime: '2026-10-20T09:15:00', durationMinutes: 30 });

  it('sets the due to today, all-day (no time, no duration), and orders the day when the sort allows it', () => {
    const plan = planDayDrop(overdueTimed, { container: 'today', afterId: 'x' }, { dayOf, keepTime: false, ordered: true });
    expect(plan).toEqual({
      day: TODAY,
      due: { dueDate: TODAY, dueDatetime: null, durationMinutes: null },
      reorderAfterId: 'x',
    });
  });

  it('a repeating task only moves this occurrence: no recurrence field is sent (the rule is kept)', () => {
    const plan = planDayDrop(
      task({ dueDate: '2026-10-21', recurrenceRule: 'FREQ=WEEKLY', isRecurring: true }),
      { container: 'today', afterId: null },
      { dayOf, keepTime: false, ordered: false },
    );
    expect(plan?.due).toEqual({ dueDate: TODAY, dueDatetime: null, durationMinutes: null });
    expect(plan?.due).not.toHaveProperty('recurrenceRule');
    expect(plan?.reorderAfterId).toBeUndefined();
  });

  it('dropping into the Overdue block does nothing', () => {
    expect(planDayDrop(overdueTimed, { container: 'overdue', afterId: null }, { dayOf, keepTime: false, ordered: true })).toBeNull();
  });
});

describe('planDayDrop — Upcoming: another day keeps the time', () => {
  it('moves a timed task to the day, same time and duration', () => {
    const plan = planDayDrop(
      task({ dueDatetime: '2026-10-29T14:30:00', durationMinutes: 45 }),
      { container: 'd-2026-11-02', afterId: null },
      { dayOf, keepTime: true, ordered: true },
    );
    expect(plan).toEqual({
      day: '2026-11-02',
      due: { dueDate: null, dueDatetime: '2026-11-02T14:30:00', durationMinutes: 45 },
      reorderAfterId: null,
    });
  });

  it('moves an all-day task as all-day', () => {
    const plan = planDayDrop(task({ dueDate: '2026-10-29' }), { container: 'd-2026-10-31', afterId: 'y' }, { dayOf, keepTime: true, ordered: false });
    expect(plan).toEqual({ day: '2026-10-31', due: { dueDate: '2026-10-31', dueDatetime: null, durationMinutes: null } });
  });

  it('same day: only the order changes, and nothing at all when the sort is not by date', () => {
    const sameDay = task({ dueDate: '2026-10-29' });
    expect(planDayDrop(sameDay, { container: 'd-2026-10-29', afterId: 'z' }, { dayOf, keepTime: true, ordered: true })).toEqual({
      day: '2026-10-29',
      reorderAfterId: 'z',
    });
    expect(planDayDrop(sameDay, { container: 'd-2026-10-29', afterId: 'z' }, { dayOf, keepTime: true, ordered: false })).toBeNull();
  });
});

describe('undoDueBody', () => {
  it('puts the old due back with the typed text and the fixed zone', () => {
    const before = task({ dueDatetime: '2026-10-20T09:15:00', durationMinutes: 30, dueString: 'thứ 2 9h15', dueTimezone: 'Asia/Tokyo' });
    expect(undoDueBody(before)).toEqual({
      dueDate: null,
      dueDatetime: '2026-10-20T09:15:00',
      durationMinutes: 30,
      dueString: 'thứ 2 9h15',
      dueTimezone: 'Asia/Tokyo',
    });
  });

  it('does not send dueTimezone for a floating due (absent = keep)', () => {
    expect(undoDueBody(task({ dueDate: '2026-10-20' }))).toEqual({
      dueDate: '2026-10-20',
      dueDatetime: null,
      durationMinutes: null,
      dueString: null,
    });
  });
});
