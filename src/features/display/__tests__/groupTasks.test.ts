import '../../../i18n';
import type { Label } from '../../../api/labels';
import { formatDayHeader } from '../../../lib/dates/format';
import { makeTask } from '../../../test/m1Fixtures';
import { makeLabel } from '../../../test/m2Fixtures';
import { displayRows, dueDayOf, firstLabelOf, groupTasks, type GroupContext } from '../groupTasks';

const labels = new Map<string, Label>([
  ['l-a', makeLabel({ id: 'l-a', name: 'gap', sortOrder: 2 })],
  ['l-b', makeLabel({ id: 'l-b', name: 'nha', sortOrder: 1 })],
]);
const ctx: GroupContext = { todayKey: '2026-10-26', labels };

describe('task keys used for grouping', () => {
  it('reads the day of a date or floating date-time due', () => {
    expect(dueDayOf({ dueDate: '2026-10-27', dueDatetime: null })).toBe('2026-10-27');
    expect(dueDayOf({ dueDate: null, dueDatetime: '2026-10-28T09:30:00' })).toBe('2026-10-28');
    expect(dueDayOf({ dueDate: null, dueDatetime: null })).toBeNull();
  });

  it('takes the first label in label order and skips unknown ids', () => {
    expect(firstLabelOf({ labelIds: ['l-a', 'l-b'] }, labels)?.id).toBe('l-b');
    expect(firstLabelOf({ labelIds: ['gone', 'l-a'] }, labels)?.id).toBe('l-a');
    expect(firstLabelOf({ labelIds: [] }, labels)).toBeNull();
  });
});

describe('groupTasks (server already sorted by group key)', () => {
  it('groups neighbours by priority', () => {
    const tasks = [
      makeTask({ id: 'a', priority: 1 }),
      makeTask({ id: 'b', priority: 1 }),
      makeTask({ id: 'c', priority: 4 }),
    ];
    const groups = groupTasks(tasks, 'PRIORITY', ctx);
    expect(groups.map((g) => [g.title, g.tasks.map((t) => t.id)])).toEqual([
      ['Ưu tiên 1', ['a', 'b']],
      ['Ưu tiên 4', ['c']],
    ]);
  });

  it('titles date groups like the day headers of M1 and puts no-date last', () => {
    const tasks = [
      makeTask({ id: 'a', dueDate: '2026-10-27' }),
      makeTask({ id: 'b', dueDatetime: '2026-10-27T08:00:00' }),
      makeTask({ id: 'c' }),
    ];
    const groups = groupTasks(tasks, 'DATE', ctx);
    expect(groups.map((g) => g.title)).toEqual([formatDayHeader('2026-10-27', '2026-10-26'), 'Không có ngày']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('groups by deadline, project and label', () => {
    expect(
      groupTasks([makeTask({ id: 'a', deadlineDate: '2026-10-30' }), makeTask({ id: 'b' })], 'DEADLINE', ctx).map(
        (g) => g.title,
      ),
    ).toEqual([`Hạn chót ${formatDayHeader('2026-10-30', '2026-10-26')}`, 'Không có hạn chót']);
    expect(
      groupTasks([makeTask({ id: 'a', projectId: 'p-1', projectName: 'Nhà' })], 'PROJECT', ctx).map((g) => g.title),
    ).toEqual(['Nhà']);
    expect(
      groupTasks([makeTask({ id: 'a', labelIds: ['l-a'] }), makeTask({ id: 'b' })], 'LABEL', ctx).map((g) => g.title),
    ).toEqual(['gap', 'Không có nhãn']);
  });

  it('keeps subtasks with their root in tree mode', () => {
    const tasks = [
      makeTask({ id: 'root', priority: 1 }),
      makeTask({ id: 'child', parentId: 'root', priority: 4 }),
      makeTask({ id: 'other', priority: 4 }),
    ];
    const groups = groupTasks(tasks, 'PRIORITY', ctx, 'tree');
    expect(groups.map((g) => g.tasks.map((t) => t.id))).toEqual([['root', 'child'], ['other']]);
  });
});

describe('displayRows', () => {
  it('returns plain rows when not grouped', () => {
    const rows = displayRows([makeTask({ id: 'a' })], 'NONE', ctx);
    expect(rows.map((r) => r.type)).toEqual(['task']);
  });

  it('puts a header with a unique key before each group', () => {
    const rows = displayRows(
      [makeTask({ id: 'a', priority: 1 }), makeTask({ id: 'b', priority: 2 }), makeTask({ id: 'c', priority: 1 })],
      'PRIORITY',
      ctx,
    );
    expect(rows.map((r) => (r.type === 'task' ? 'task' : 'group'))).toEqual(['group', 'task', 'group', 'task', 'group', 'task']);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });
});

describe('Overdue block and order=desc (backend DisplayRules.leadsWithOverdueBlock)', () => {
  it('never reorders: the Overdue block the server puts first stays first, even with order=desc', () => {
    const tasks = [
      makeTask({ id: 'overdue', dueDate: '2026-10-20' }),
      makeTask({ id: 'later', dueDate: '2026-10-29' }),
      makeTask({ id: 'soon', dueDate: '2026-10-27' }),
    ];
    const groups = groupTasks(tasks, 'NONE', ctx);
    expect(groups).toHaveLength(1);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['overdue', 'later', 'soon']);
  });
});
