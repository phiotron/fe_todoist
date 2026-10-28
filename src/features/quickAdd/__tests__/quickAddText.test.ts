import { parseQuickAdd, type QuickAddToken } from '../../../lib/quickadd';
import { backspacedToken, pastedLines, segments, tappedToken } from '../quickAddText';

const ctx = {
  today: '2026-10-27',
  dateSettings: { startDay: 1, nextWeek: 1, weekendStartDay: 6 },
  dateFormat: 'DMY' as const,
  smartDate: true,
};
const tokensOf = (text: string): QuickAddToken[] => parseQuickAdd(text, ctx).tokens;

describe('backspacedToken', () => {
  it('Backspace right after a highlighted part names that token (the text is restored by the caller)', () => {
    const before = 'Call tomorrow p1';
    expect(backspacedToken(before, 'Call tomorro p1', tokensOf(before))?.key).toBe('date:tomorrow');
    expect(backspacedToken(before, 'Call tomorrow p', tokensOf(before))?.key).toBe('priority:p1');
  });

  it('works when the last letter repeats ("p11" is not a token, "tmrw" deleting w)', () => {
    const before = 'Go tmrw';
    expect(backspacedToken(before, 'Go tmr', tokensOf(before))?.key).toBe('date:tmrw');
  });

  it('typing, deleting elsewhere, or deleting more than one character is not a dismissal', () => {
    const before = 'Call tomorrow';
    expect(backspacedToken(before, 'Call tomorrow ', tokensOf(before))).toBeNull();
    expect(backspacedToken(before, 'Cal tomorrow', tokensOf(before))).toBeNull();
    expect(backspacedToken(before, 'Call tomor', tokensOf(before))).toBeNull();
    expect(backspacedToken(before, 'Call tomorow', tokensOf(before))).toBeNull();
  });
});

describe('tappedToken', () => {
  it('a caret strictly inside a highlighted part names it; at its edges it does not', () => {
    const tokens = tokensOf('Call tomorrow');
    expect(tappedToken({ start: 7, end: 7 }, tokens)?.key).toBe('date:tomorrow');
    expect(tappedToken({ start: 5, end: 5 }, tokens)).toBeNull();
    expect(tappedToken({ start: 13, end: 13 }, tokens)).toBeNull();
    expect(tappedToken({ start: 6, end: 9 }, tokens)).toBeNull();
  });
});

describe('pastedLines', () => {
  it('several non-empty lines → the lines, trimmed', () => {
    expect(pastedLines('', 'Milk\n\n  Eggs \r\nBread\n')).toEqual(['Milk', 'Eggs', 'Bread']);
    expect(pastedLines('Buy ', 'Buy Milk\nEggs')).toEqual(['Buy Milk', 'Eggs']);
  });

  it('one line (even with a trailing newline) or no newline → null', () => {
    expect(pastedLines('', 'Milk\n')).toBeNull();
    expect(pastedLines('', 'Milk')).toBeNull();
  });
});

describe('segments', () => {
  it('splits the text into plain and highlighted runs', () => {
    expect(segments('Call tomorrow p1', tokensOf('Call tomorrow p1'))).toEqual([
      { text: 'Call ', highlighted: false },
      { text: 'tomorrow', highlighted: true },
      { text: ' ', highlighted: false },
      { text: 'p1', highlighted: true },
    ]);
    expect(segments('', [])).toEqual([]);
  });
});
