import { extraFields, normalizePatch, settlePending } from '../settingsModel';

describe('settings model with the M10 number list (daysOff)', () => {
  it('keeps a list of numbers as an extra field, like a list of strings', () => {
    expect(extraFields({ daysOff: [6, 7], quickAddChips: ['PROJECT'], dailyGoal: 5 })).toEqual({
      daysOff: [6, 7],
      quickAddChips: ['PROJECT'],
      dailyGoal: 5,
    });
  });

  it('keeps an empty list (no day off) but drops a mixed list', () => {
    expect(extraFields({ daysOff: [] })).toEqual({ daysOff: [] });
    expect(extraFields({ mixed: [1, 'a'] })).toEqual({});
  });

  it('a pending daysOff change survives until the user changes it again', () => {
    expect(normalizePatch({ daysOff: [1, 2] })).toEqual({ daysOff: [1, 2] });
    expect(settlePending({ daysOff: [1, 2] }, { daysOff: [1, 2] })).toBeNull();
    expect(settlePending({ daysOff: [1, 2, 3] }, { daysOff: [1, 2] })).toEqual({ daysOff: [1, 2, 3] });
  });
});
