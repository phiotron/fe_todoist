import { parseQuickAdd } from '../../../lib/quickadd';
import { NO_DUE } from '../../schedule/dueValue';
import { resolveQuickAdd, type ManualChoice, type QuickAddLookups } from '../resolveQuickAdd';

const ctx = {
  today: '2026-10-27',
  dateSettings: { startDay: 1, nextWeek: 1, weekendStartDay: 6 },
  dateFormat: 'DMY' as const,
  smartDate: true,
  projects: ['Work', 'Inbox'],
  sections: ['Meetings'],
};
const lookups: QuickAddLookups = {
  projects: [
    { id: 'p-inbox', name: 'Inbox' },
    { id: 'p-work', name: 'Work' },
  ],
  sections: [{ id: 's-meet', name: 'Meetings' }],
  labels: [{ id: 'l-urgent', name: 'Urgent' }],
  today: '2026-10-27',
};
const manual: ManualChoice = {
  projectId: 'p-inbox',
  sectionId: 's-old',
  due: { dueDate: '2026-11-11', dueDatetime: null, durationMinutes: null },
  priority: 3,
  labelIds: ['l-picked'],
  deadline: '2026-12-24',
};

describe('resolveQuickAdd', () => {
  it('the typed values win over the chips; existing labels by name, new ones to create', () => {
    const parse = parseQuickAdd('Meeting tomorrow 9-10 #Work /meetings p1 %urgent %new {friday} !30 min before', ctx);
    expect(resolveQuickAdd(parse, manual, lookups)).toEqual({
      content: 'Meeting',
      projectId: 'p-work',
      sectionId: 's-meet',
      due: { dueDate: null, dueDatetime: '2026-10-28T09:00:00', durationMinutes: 60 },
      priority: 1,
      labelIds: ['l-picked', 'l-urgent'],
      newLabelNames: ['new'],
      deadline: '2026-10-30',
      reminders: [{ type: 'RELATIVE', minuteOffset: 30 }],
      recurrence: undefined,
      uncompletable: false,
    });
  });

  it('without tokens the chips are used as they are', () => {
    const resolved = resolveQuickAdd(parseQuickAdd('Plain', ctx), manual, lookups);
    expect(resolved).toMatchObject({
      content: 'Plain',
      projectId: 'p-inbox',
      sectionId: 's-old',
      due: manual.due,
      priority: 3,
      labelIds: ['l-picked'],
      newLabelNames: [],
      deadline: '2026-12-24',
    });
  });

  it('#another project drops the section picked for the old one', () => {
    expect(resolveQuickAdd(parseQuickAdd('Plan #Work', ctx), manual, lookups).sectionId).toBeNull();
  });

  it('an absolute reminder without a date uses the due day, or today without due', () => {
    const withDue = resolveQuickAdd(parseQuickAdd('Pay friday !5pm', ctx), { ...manual, due: NO_DUE }, lookups);
    expect(withDue.reminders).toEqual([{ type: 'ABSOLUTE', at: '2026-10-30T17:00' }]);
    const noDue = resolveQuickAdd(parseQuickAdd('Pay !5pm', ctx), { ...manual, due: NO_DUE }, lookups);
    expect(noDue.reminders).toEqual([{ type: 'ABSOLUTE', at: '2026-10-27T17:00' }]);
  });
});
