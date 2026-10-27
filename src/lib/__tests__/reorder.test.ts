import { afterIdAt, moveItem } from '../reorder';

describe('reorder helpers', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('moves an item without mutating the input', () => {
    expect(moveItem(items, 0, 2).map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(moveItem(items, 2, 0).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('afterId is the item now standing before, null at the top', () => {
    const moved = moveItem(items, 2, 0);
    expect(afterIdAt(moved, 0)).toBeNull();
    expect(afterIdAt(moved, 2)).toBe('a');
  });
});
