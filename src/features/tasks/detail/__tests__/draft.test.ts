import { makeTask } from '../../../../test/m1Fixtures';
import { draftChanges, draftFromTask, sameEditableFields } from '../draft';

describe('task draft', () => {
  const base = makeTask({ content: 'A', description: 'mô tả', priority: 4, dueDate: '2026-10-24', version: 2 });

  it('starts from the task', () => {
    expect(draftFromTask(base)).toEqual({
      content: 'A',
      description: 'mô tả',
      priority: 4,
      dueDate: '2026-10-24',
      dueDatetime: null,
      durationMinutes: null,
      deadlineDate: null,
    });
  });

  it('sends only the changed fields; the content is trimmed', () => {
    expect(draftChanges(base, { ...draftFromTask(base), content: '  B ', priority: 1 })).toEqual({ content: 'B', priority: 1 });
    expect(draftChanges(base, draftFromTask(base))).toEqual({});
    expect(draftChanges(base, { ...draftFromTask(base), description: '' })).toEqual({ description: '' });
  });

  it('sends the whole due together when any part changes, and explicit nulls to clear it', () => {
    const timedBase = makeTask({ dueDatetime: '2026-10-24T09:00:00', durationMinutes: 30 });
    expect(draftChanges(timedBase, { ...draftFromTask(timedBase), durationMinutes: 60 })).toEqual({
      dueDate: null,
      dueDatetime: '2026-10-24T09:00:00',
      durationMinutes: 60,
    });
    expect(draftChanges(base, { ...draftFromTask(base), dueDate: null })).toEqual({
      dueDate: null,
      dueDatetime: null,
      durationMinutes: null,
    });
  });

  it('sends the deadline alone, null clears it', () => {
    expect(draftChanges(base, { ...draftFromTask(base), deadlineDate: '2026-10-30' })).toEqual({ deadlineDate: '2026-10-30' });
    const withDeadline = makeTask({ deadlineDate: '2026-10-30' });
    expect(draftChanges(withDeadline, { ...draftFromTask(withDeadline), deadlineDate: null })).toEqual({ deadlineDate: null });
  });

  it('tells whether two copies differ only in non-editable fields', () => {
    expect(sameEditableFields(base, { ...base, version: 3, completedAt: 'x', subtaskCount: 2 })).toBe(true);
    expect(sameEditableFields(base, { ...base, content: 'Z' })).toBe(false);
    expect(sameEditableFields(base, { ...base, deadlineDate: '2026-10-30' })).toBe(false);
  });
});
