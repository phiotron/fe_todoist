import '../../../i18n';
import { makeSection, makeTask } from '../../../test/m1Fixtures';
import type { GroupContext } from '../../display/groupTasks';
import {
  dayBoardColumns,
  dropForGroupKey,
  isDraggable,
  listBoardColumns,
  planColumnDrop,
  projectBoardColumns,
  todayBoardColumns,
} from '../boardColumns';

const ctx: GroupContext = { todayKey: '2026-11-04', labels: new Map(), timeZone: 'Asia/Ho_Chi_Minh' };
const ids = (tasks: { id: string }[]) => tasks.map((task) => task.id);

describe('projectBoardColumns', () => {
  const sections = [makeSection({ id: 's-2', name: 'Hai', sortOrder: 2 }), makeSection({ id: 's-1', name: 'Một', sortOrder: 1 })];
  const tasks = [
    makeTask({ id: 'a', sectionId: null }),
    makeTask({ id: 'b', sectionId: 's-1' }),
    makeTask({ id: 'b-child', sectionId: 's-1', parentId: 'b' }),
    makeTask({ id: 'c', sectionId: 's-2' }),
    makeTask({ id: 'lost', sectionId: 's-gone' }),
    makeTask({ id: 'done', sectionId: 's-1', completedAt: '2026-11-01T00:00:00Z' }),
  ];

  it('puts "No Section" first, then the sections in order, root open tasks only', () => {
    const columns = projectBoardColumns(tasks, sections, 'p-1', 'NONE', ctx);
    expect(columns.map((column) => column.key)).toEqual(['section:none', 'section:s-1', 'section:s-2']);
    expect(columns[0].title).toBe('Không có mục');
    expect(columns.map((column) => ids(column.tasks))).toEqual([['a', 'lost'], ['b'], ['c']]);
    expect(columns[1].drop).toEqual({ kind: 'section', projectId: 'p-1', sectionId: 's-1' });
    expect(columns[0].drop).toEqual({ kind: 'section', projectId: 'p-1', sectionId: null });
    expect(columns[1].add).toEqual({ projectId: 'p-1', sectionId: 's-1' });
    expect(columns[0].add).toEqual({ projectId: 'p-1' });
  });

  it('takes no drops and offers no add when the project is read-only (archived)', () => {
    const columns = projectBoardColumns(tasks, sections, 'p-1', 'NONE', ctx, true);
    expect(columns.every((column) => column.drop === null && column.add === undefined)).toBe(true);
  });

  it('uses the grouping when one is chosen (priority columns take drops)', () => {
    const grouped = projectBoardColumns(
      [makeTask({ id: 'x', priority: 1 }), makeTask({ id: 'y', priority: 4 })],
      sections,
      'p-1',
      'PRIORITY',
      ctx,
    );
    expect(grouped.map((column) => [column.key, ids(column.tasks)])).toEqual([
      ['priority:1', ['x']],
      ['priority:4', ['y']],
    ]);
    expect(grouped[0].drop).toEqual({ kind: 'priority', priority: 1 });
  });
});

describe('other views', () => {
  it('Today: Overdue (no drops) + today (schedule today)', () => {
    const now = new Date('2026-11-04T03:00:00Z');
    const columns = todayBoardColumns(
      [makeTask({ id: 'old', dueDate: '2026-11-01' }), makeTask({ id: 'now', dueDate: '2026-11-04' })],
      now,
      'Asia/Ho_Chi_Minh',
      '2026-11-04',
      'NONE',
      ctx,
    );
    expect(columns.map((column) => [column.key, ids(column.tasks), column.drop])).toEqual([
      ['overdue', ['old'], null],
      ['date:2026-11-04', ['now'], { kind: 'date', date: '2026-11-04' }],
    ]);
    expect(columns[0].tone).toBe('danger');
  });

  it('Today without overdue tasks has only the today column', () => {
    const columns = todayBoardColumns([], new Date('2026-11-04T03:00:00Z'), 'Asia/Ho_Chi_Minh', '2026-11-04', 'NONE', ctx);
    expect(columns.map((column) => column.key)).toEqual(['date:2026-11-04']);
  });

  it('Upcoming: one column per day, empty days included', () => {
    const columns = dayBoardColumns(
      ['2026-11-04', '2026-11-05'],
      new Map([['2026-11-05', [makeTask({ id: 'n' })]]]),
      '2026-11-04',
    );
    expect(columns.map((column) => [column.key, ids(column.tasks)])).toEqual([
      ['date:2026-11-04', []],
      ['date:2026-11-05', ['n']],
    ]);
    expect(columns[1].add).toEqual({ dueDate: '2026-11-05' });
  });

  it('labels / filters: one column without grouping, group columns otherwise', () => {
    expect(listBoardColumns([makeTask({ id: 'a' })], 'NONE', ctx, 'nha').map((column) => [column.title, column.drop])).toEqual([
      ['nha', null],
    ]);
    const byDate = listBoardColumns([makeTask({ id: 'a', dueDate: '2026-11-06' }), makeTask({ id: 'b', dueDate: null })], 'DATE', ctx);
    expect(byDate.map((column) => column.drop)).toEqual([{ kind: 'date', date: '2026-11-06' }, null]);
  });
});

describe('drops', () => {
  it('reads group keys as drop targets', () => {
    expect(dropForGroupKey('date:2026-11-06')).toEqual({ kind: 'date', date: '2026-11-06' });
    expect(dropForGroupKey('priority:2')).toEqual({ kind: 'priority', priority: 2 });
    for (const key of ['date:none', 'deadline:2026-11-06', 'project:p', 'label:l', 'added:2026-11-01', 'all']) {
      expect(dropForGroupKey(key)).toBeNull();
    }
  });

  it('only root open tasks of writable projects can be dragged', () => {
    expect(isDraggable(makeTask())).toBe(true);
    expect(isDraggable(makeTask({ parentId: 'p' }))).toBe(false);
    expect(isDraggable(makeTask({ completedAt: '2026-11-01T00:00:00Z' }))).toBe(false);
    expect(isDraggable(makeTask(), true)).toBe(false);
  });

  it('plans one batch request, leaving out tasks already in the column', () => {
    const column = {
      key: 'section:s-1',
      title: 'Một',
      tasks: [makeTask({ id: 'here' })],
      drop: { kind: 'section', projectId: 'p-1', sectionId: 's-1' } as const,
    };
    expect(planColumnDrop(column, ['here', 'a', 'b'])).toEqual({ action: 'MOVE', taskIds: ['a', 'b'], projectId: 'p-1', sectionId: 's-1' });
    expect(planColumnDrop(column, ['here'])).toBeNull();
    expect(planColumnDrop({ ...column, drop: { kind: 'section', projectId: 'p-1', sectionId: null } }, ['a'])).toEqual({
      action: 'MOVE',
      taskIds: ['a'],
      projectId: 'p-1',
    });
    expect(planColumnDrop({ ...column, drop: { kind: 'date', date: '2026-11-07' } }, ['a'])).toEqual({
      action: 'SCHEDULE',
      taskIds: ['a'],
      date: '2026-11-07',
    });
    expect(planColumnDrop({ ...column, drop: { kind: 'priority', priority: 3 } }, ['a'])).toEqual({
      action: 'PRIORITY',
      taskIds: ['a'],
      priority: 3,
    });
    expect(planColumnDrop({ ...column, drop: null }, ['a'])).toBeNull();
  });
});
