import '../../../i18n';
import viTaskList from '../../../i18n/locales/vi/taskList.json';
import { makeTask } from '../../../test/m1Fixtures';
import { DEFAULT_SWIPE, swipeSide } from '../swipe';
import { nodeRow, sectionRow, taskRows, treeRows } from '../taskRows';
import { descriptionError, taskContentError } from '../validation';

describe('task helpers', () => {
  it('validates task content and description (BR-02, spec 5.9)', () => {
    expect(taskContentError('   ')).toBe(viTaskList.taskList.validation.contentRequired);
    expect(taskContentError('a'.repeat(501))).toBe(viTaskList.taskList.validation.contentTooLong);
    expect(taskContentError(' Mua sữa ')).toBeUndefined();
    expect(descriptionError('a'.repeat(16_384))).toBe(viTaskList.taskList.validation.descriptionTooLong);
    expect(descriptionError('')).toBeUndefined();
  });

  it('builds flat, tree, section and node rows', () => {
    const root = makeTask({ id: 'r' });
    const child = makeTask({ id: 'c', parentId: 'r' });
    expect(taskRows([root, child]).map((row) => (row.type === 'task' ? row.depth : 0))).toEqual([1, 1]);
    expect(treeRows([root, child]).map((row) => (row.type === 'task' ? [row.task.id, row.depth] : null))).toEqual([
      ['r', 1],
      ['c', 2],
    ]);
    expect(sectionRow('h', { title: 'Quá hạn', count: 2, tone: 'danger' })).toEqual({
      type: 'section',
      key: 'h',
      props: { title: 'Quá hạn', count: 2, tone: 'danger' },
    });
    expect(nodeRow('n', null)).toEqual({ type: 'node', key: 'n', node: null });
  });

  it('swipes right to complete and left to schedule by default (M3 reads the settings)', () => {
    expect(DEFAULT_SWIPE).toEqual({ right: 'COMPLETE', left: 'SCHEDULE' });
    // ReanimatedSwipeable reports which action panel opened: the left panel means the row went right.
    expect(swipeSide('left')).toBe('right');
    expect(swipeSide('right')).toBe('left');
  });
});
