import { displayContent, isUncompletable } from '../uncompletable';

describe('uncompletable tasks (Todoist "* " prefix)', () => {
  it('only a leading "* " counts', () => {
    expect(isUncompletable('* Ghi chú')).toBe(true);
    expect(isUncompletable('*Ghi chú')).toBe(false);
    expect(isUncompletable('Ghi * chú')).toBe(false);
    expect(isUncompletable(' * Ghi chú')).toBe(false);
  });

  it('the list shows the name without the prefix', () => {
    expect(displayContent('* Ghi chú')).toBe('Ghi chú');
    expect(displayContent('Mua sữa')).toBe('Mua sữa');
  });
});
