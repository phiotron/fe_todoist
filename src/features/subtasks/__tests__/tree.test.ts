import { MAX_DEPTH, canAddSubtask, childrenOf, depthOf, flattenTree, progressLabel } from '../tree';

const node = (id: string, parentId: string | null, sortOrder = 1024) => ({ id, parentId, sortOrder });

describe('flattenTree', () => {
  it('nests children under their parent, ordered by sortOrder, roots in input order', () => {
    const rows = flattenTree([
      node('b', null),
      node('a', null),
      node('a2', 'a', 2048),
      node('a1', 'a', 1024),
      node('a1x', 'a1'),
    ]);
    expect(rows.map((row) => [row.task.id, row.depth])).toEqual([
      ['b', 1],
      ['a', 1],
      ['a1', 2],
      ['a1x', 3],
      ['a2', 2],
    ]);
  });

  it('shows a task whose parent is not in the list as a root (e.g. parent completed)', () => {
    expect(flattenTree([node('child', 'missing')]).map((row) => [row.task.id, row.depth])).toEqual([['child', 1]]);
  });

  it('never loops or drops tasks on corrupt cyclic data', () => {
    const rows = flattenTree([node('x', 'y'), node('y', 'x')]);
    expect(rows.map((row) => row.task.id).sort()).toEqual(['x', 'y']);
  });
});

describe('depth and children', () => {
  const tasks = [node('r', null), node('c1', 'r'), node('c2', 'c1'), node('c3', 'c2'), node('s', 'r', 512)];

  it('counts the depth from the root (root = 1)', () => {
    expect(depthOf(tasks, 'r')).toBe(1);
    expect(depthOf(tasks, 'c3')).toBe(4);
  });

  it('allows subtasks only above level 4', () => {
    expect(MAX_DEPTH).toBe(4);
    expect(canAddSubtask(tasks, 'c2')).toBe(true);
    expect(canAddSubtask(tasks, 'c3')).toBe(false);
  });

  it('lists direct children by sortOrder', () => {
    expect(childrenOf(tasks, 'r').map((t) => t.id)).toEqual(['s', 'c1']);
  });
});

describe('progressLabel', () => {
  it('shows done/total only when there are subtasks', () => {
    expect(progressLabel({ subtaskCount: 5, completedSubtaskCount: 2 })).toBe('2/5');
    expect(progressLabel({ subtaskCount: 0, completedSubtaskCount: 0 })).toBeNull();
  });
});
