import {
  ALL_CHIPS,
  DEFAULT_CHIPS,
  hiddenChips,
  moveChip,
  readQuickAddPrefs,
  toggleChip,
} from '../quickAddChips';

describe('quickAddChips model (contract 2 / 8.2)', () => {
  it('defaults: Project · Date · Assignee, labels and description shown', () => {
    expect(readQuickAddPrefs(undefined)).toEqual({
      chips: ['PROJECT', 'DATE', 'ASSIGNEE'],
      showActionLabels: true,
      showDescription: true,
    });
    expect(DEFAULT_CHIPS).toEqual(['PROJECT', 'DATE', 'ASSIGNEE']);
    expect(ALL_CHIPS).toHaveLength(9);
  });

  it('reads the server values and falls back field by field when invalid (cache written before M6b)', () => {
    expect(
      readQuickAddPrefs({ quickAddChips: ['LABELS', 'PROJECT'], quickAddShowActionLabels: false, quickAddShowDescription: false }),
    ).toEqual({ chips: ['LABELS', 'PROJECT'], showActionLabels: false, showDescription: false });
    expect(readQuickAddPrefs({ quickAddChips: ['DATE'] }).chips).toEqual(DEFAULT_CHIPS);
    expect(readQuickAddPrefs({ quickAddChips: ['PROJECT', 'PROJECT'] }).chips).toEqual(DEFAULT_CHIPS);
    expect(readQuickAddPrefs({ quickAddChips: 'PROJECT' }).chips).toEqual(DEFAULT_CHIPS);
  });

  it('toggling shows a hidden chip at the end and hides a shown one; PROJECT never hides', () => {
    expect(toggleChip(['PROJECT', 'DATE'], 'LABELS')).toEqual(['PROJECT', 'DATE', 'LABELS']);
    expect(toggleChip(['PROJECT', 'DATE'], 'DATE')).toEqual(['PROJECT']);
    expect(toggleChip(['PROJECT', 'DATE'], 'PROJECT')).toEqual(['PROJECT', 'DATE']);
  });

  it('moves a shown chip up or down, staying inside the list', () => {
    expect(moveChip(['PROJECT', 'DATE', 'LABELS'], 'LABELS', -1)).toEqual(['PROJECT', 'LABELS', 'DATE']);
    expect(moveChip(['PROJECT', 'DATE', 'LABELS'], 'PROJECT', -1)).toEqual(['PROJECT', 'DATE', 'LABELS']);
    expect(moveChip(['PROJECT', 'DATE', 'LABELS'], 'PROJECT', 1)).toEqual(['DATE', 'PROJECT', 'LABELS']);
    expect(moveChip(['PROJECT', 'DATE'], 'LABELS', 1)).toEqual(['PROJECT', 'DATE']);
  });

  it('hidden chips keep the catalogue order', () => {
    expect(hiddenChips(['PROJECT', 'LABELS'])).toEqual([
      'DATE',
      'ASSIGNEE',
      'ATTACHMENT',
      'PRIORITY',
      'REMINDERS',
      'DEADLINE',
      'LOCATION',
    ]);
  });
});
