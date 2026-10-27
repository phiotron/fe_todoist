import { makeTask } from '../../../../test/m1Fixtures';
import { draftChanges, draftFromTask, sameEditableFields } from '../draft';

describe('task draft with labels (M2, spec 12.3: PATCH labelIds replaces the whole set)', () => {
  const base = makeTask({ version: 2, labelIds: ['l-1', 'l-2'] });

  it('starts with a copy of the task labels (a task without the field counts as none)', () => {
    const draft = draftFromTask(base);
    expect(draft.labelIds).toEqual(['l-1', 'l-2']);
    expect(draft.labelIds).not.toBe(base.labelIds);
    expect(draftFromTask({ ...base, labelIds: undefined as unknown as string[] }).labelIds).toEqual([]);
  });

  it('sends labelIds only when the set differs, ignoring order; an empty set clears them', () => {
    expect(draftChanges(base, { ...draftFromTask(base), labelIds: ['l-2', 'l-1'] })).toEqual({});
    expect(draftChanges(base, { ...draftFromTask(base), labelIds: ['l-1'] })).toEqual({ labelIds: ['l-1'] });
    expect(draftChanges(base, { ...draftFromTask(base), labelIds: [] })).toEqual({ labelIds: [] });
  });

  it('counts a label change from another device as an editable-field change', () => {
    expect(sameEditableFields(base, { ...base, version: 3, labelIds: ['l-1'] })).toBe(false);
    expect(sameEditableFields(base, { ...base, version: 3 })).toBe(true);
  });
});
