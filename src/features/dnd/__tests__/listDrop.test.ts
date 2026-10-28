import { moveInList, placeDrop, rowHalf, type ListEntry } from '../listDrop';

// Project "P": no section [a (a1, a2), b], section S [c, d]
const entries: ListEntry[] = [
  { id: 'a', parentId: null, container: 'none' },
  { id: 'a1', parentId: 'a', container: 'none' },
  { id: 'a2', parentId: 'a', container: 'none' },
  { id: 'b', parentId: null, container: 'none' },
  { id: 'c', parentId: null, container: 'S' },
  { id: 'd', parentId: null, container: 'S' },
];

describe('placeDrop — root tasks', () => {
  it('lower half of a root = right after it (its sub-tasks follow it)', () => {
    expect(placeDrop(entries, 'b', { kind: 'task', taskId: 'c', after: true })).toEqual({ container: 'S', afterId: 'c' });
    expect(placeDrop(entries, 'd', { kind: 'task', taskId: 'a', after: true })).toEqual({ container: 'none', afterId: 'a' });
  });

  it('upper half = after the previous root of that block, null at the top', () => {
    expect(placeDrop(entries, 'b', { kind: 'task', taskId: 'a', after: false })).toEqual({ container: 'none', afterId: null });
    expect(placeDrop(entries, 'a', { kind: 'task', taskId: 'd', after: false })).toEqual({ container: 'S', afterId: 'c' });
  });

  it('dropping on a sub-task places the root after that sub-task’s root', () => {
    expect(placeDrop(entries, 'c', { kind: 'task', taskId: 'a1', after: false })).toEqual({ container: 'none', afterId: 'a' });
  });

  it('header = top of the block, add row = end of the block', () => {
    expect(placeDrop(entries, 'a', { kind: 'container', container: 'S', edge: 'start' })).toEqual({ container: 'S', afterId: null });
    expect(placeDrop(entries, 'a', { kind: 'container', container: 'S', edge: 'end' })).toEqual({ container: 'S', afterId: 'd' });
    expect(placeDrop(entries, 'c', { kind: 'container', container: 'empty', edge: 'end' })).toEqual({ container: 'empty', afterId: null });
  });

  it('is null when nothing would change or the target is the task itself / its own sub-task', () => {
    expect(placeDrop(entries, 'b', { kind: 'task', taskId: 'a', after: true })).toBeNull();
    expect(placeDrop(entries, 'b', { kind: 'task', taskId: 'b', after: true })).toBeNull();
    expect(placeDrop(entries, 'a', { kind: 'task', taskId: 'a2', after: true })).toBeNull();
    expect(placeDrop(entries, 'c', { kind: 'container', container: 'S', edge: 'start' })).toBeNull();
    expect(placeDrop(entries, 'missing', { kind: 'task', taskId: 'a', after: true })).toBeNull();
  });
});

describe('placeDrop — sub-tasks stay under their parent', () => {
  it('reorders among siblings', () => {
    expect(placeDrop(entries, 'a1', { kind: 'task', taskId: 'a2', after: true })).toEqual({ container: 'none', afterId: 'a2' });
    expect(placeDrop(entries, 'a2', { kind: 'task', taskId: 'a1', after: false })).toEqual({ container: 'none', afterId: null });
  });

  it('lower half of the parent = first sub-task', () => {
    expect(placeDrop(entries, 'a2', { kind: 'task', taskId: 'a', after: true })).toEqual({ container: 'none', afterId: null });
  });

  it('cannot leave the parent (other roots, other blocks, headers)', () => {
    expect(placeDrop(entries, 'a1', { kind: 'task', taskId: 'b', after: true })).toBeNull();
    expect(placeDrop(entries, 'a1', { kind: 'task', taskId: 'a', after: false })).toBeNull();
    expect(placeDrop(entries, 'a1', { kind: 'container', container: 'S', edge: 'start' })).toBeNull();
  });
});

describe('placeDrop — flat day lists (Today / Upcoming)', () => {
  const days: ListEntry[] = [
    { id: 'o1', parentId: null, container: 'overdue' },
    { id: 't1', parentId: null, container: 'today' },
    { id: 't2', parentId: null, container: 'today' },
  ];

  it('an overdue task dropped among today’s tasks lands in today', () => {
    expect(placeDrop(days, 'o1', { kind: 'task', taskId: 't2', after: false })).toEqual({ container: 'today', afterId: 't1' });
    expect(placeDrop(days, 'o1', { kind: 'container', container: 'today', edge: 'start' })).toEqual({ container: 'today', afterId: null });
  });

  it('reorders inside one day', () => {
    expect(placeDrop(days, 't1', { kind: 'task', taskId: 't2', after: true })).toEqual({ container: 'today', afterId: 't2' });
  });
});

describe('rowHalf', () => {
  it('is "after" on the lower half of the row', () => {
    expect(rowHalf(10, 40)).toBe(false);
    expect(rowHalf(25, 40)).toBe(true);
  });
});

describe('moveInList (optimistic order until the server answers)', () => {
  const tasks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

  it('puts the task right after the anchor, or right before one', () => {
    expect(ids(moveInList(tasks, 'a', { afterId: 'c' }))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(moveInList(tasks, 'd', { beforeId: 'b' }))).toEqual(['a', 'd', 'b', 'c']);
    expect(ids(moveInList(tasks, 'b', {}))).toEqual(['a', 'c', 'd', 'b']);
  });

  it('applies the patch to the moved task only and leaves the input untouched', () => {
    const list = [{ id: 'a', day: '1' }, { id: 'b', day: '1' }];
    const moved = moveInList(list, 'a', { afterId: 'b' }, { day: '2' });
    expect(moved).toEqual([{ id: 'b', day: '1' }, { id: 'a', day: '2' }]);
    expect(list[0].day).toBe('1');
  });

  it('returns the list unchanged when the task is not there', () => {
    expect(moveInList(tasks, 'x', { afterId: 'a' })).toBe(tasks);
  });

  it('inserts a task coming from another list (Overdue → a day) when given', () => {
    expect(ids(moveInList(tasks, 'x', { afterId: 'a' }, undefined, { id: 'x' }))).toEqual(['a', 'x', 'b', 'c', 'd']);
  });
});
