import { QueryClient } from '@tanstack/react-query';
import type { Task } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { taskRemindersKey } from '../../../features/reminders/useTaskReminders';
import { applyOptimistic, remindersCacheKey } from '../optimistic';

const NOW = '2026-10-28T10:00:00.000Z';

function task(id: string, extra: Record<string, unknown> = {}): Task {
  return {
    id,
    projectId: 'p1',
    sectionId: null,
    parentId: null,
    content: `task ${id}`,
    priority: 4,
    dueDate: null,
    dueDatetime: null,
    durationMinutes: null,
    isOverdue: false,
    completedAt: null,
    subtaskCount: 0,
    sortOrder: 1024,
    version: 3,
    projectName: 'Home',
    labelIds: [],
    ...extra,
  } as unknown as Task;
}

const page = (items: unknown[]) => ({ pages: [{ items, nextCursor: null }], pageParams: [null] });
const listItems = (qc: QueryClient, key: readonly unknown[]) =>
  (qc.getQueryData<{ pages: { items: Task[] }[] }>(key)?.pages ?? []).flatMap((p) => p.items);
const order = (qc: QueryClient, key: readonly unknown[]) =>
  [...listItems(qc, key)].sort((a, b) => a.sortOrder - b.sortOrder).map((t) => t.id);

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  qc.setQueryData(
    queryKeys.tasks.list({ projectId: 'p1' }),
    page([task('a', { sortOrder: 1000 }), task('b', { sortOrder: 2000 }), task('c', { sortOrder: 3000 }), task('x', { sectionId: 's1', sortOrder: 10 })]),
  );
  qc.setQueryData(queryKeys.tasks.detail('c'), task('c', { sortOrder: 3000 }));
  return qc;
}

describe('applyOptimistic — reorder', () => {
  const key = queryKeys.tasks.list({ projectId: 'p1' });

  it('puts a task first (afterId null) and answers with the new sortOrder', () => {
    const qc = setup();
    const answer = applyOptimistic(qc, { type: 'reorder', args: { type: 'TASK', id: 'c', afterId: null } }, NOW);
    expect(order(qc, key).filter((id) => id !== 'x')).toEqual(['c', 'a', 'b']);
    expect(answer).toMatchObject({ type: 'TASK', id: 'c', sortOrder: -24 });
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('c'))?.sortOrder).toBe(-24); // detail copy too
  });

  it('puts a task between two siblings and after the last one', () => {
    const qc = setup();
    applyOptimistic(qc, { type: 'reorder', args: { type: 'TASK', id: 'c', afterId: 'a' } }, NOW);
    expect(order(qc, key).filter((id) => id !== 'x')).toEqual(['a', 'c', 'b']);
    applyOptimistic(qc, { type: 'reorder', args: { type: 'TASK', id: 'a', afterId: 'b' } }, NOW);
    expect(order(qc, key).filter((id) => id !== 'x')).toEqual(['c', 'b', 'a']);
  });

  it('only compares tasks of the same container (project + section + parent)', () => {
    const qc = setup();
    // x is alone in section s1: "first" among no siblings must not use the other section's numbers
    const answer = applyOptimistic(qc, { type: 'reorder', args: { type: 'TASK', id: 'x', afterId: null } }, NOW) as { sortOrder: number };
    expect(answer.sortOrder).toBe(1024);
  });

  it('reorders sections, labels, filters and projects with the same rule', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    qc.setQueryData(queryKeys.sections.list('p1'), [
      { id: 's1', projectId: 'p1', sortOrder: 1000 },
      { id: 's2', projectId: 'p1', sortOrder: 2000 },
    ]);
    qc.setQueryData(queryKeys.labels.list(), [
      { id: 'l1', sortOrder: 1000 },
      { id: 'l2', sortOrder: 2000 },
    ]);
    qc.setQueryData(queryKeys.filters.list(), [
      { id: 'f1', sortOrder: 1000 },
      { id: 'f2', sortOrder: 2000 },
    ]);
    qc.setQueryData(queryKeys.projects.list(false), [
      { id: 'inbox', parentId: null, sortOrder: 0 },
      { id: 'q1', parentId: null, sortOrder: 1000 },
      { id: 'q2', parentId: null, sortOrder: 2000 },
      { id: 'child', parentId: 'q1', sortOrder: 500 },
    ]);

    applyOptimistic(qc, { type: 'reorder', args: { type: 'SECTION', id: 's2', afterId: null } }, NOW);
    applyOptimistic(qc, { type: 'reorder', args: { type: 'LABEL', id: 'l2', afterId: null } }, NOW);
    applyOptimistic(qc, { type: 'reorder', args: { type: 'FILTER', id: 'f2', afterId: null } }, NOW);
    applyOptimistic(qc, { type: 'reorder', args: { type: 'PROJECT', id: 'q2', afterId: 'inbox' } }, NOW);

    const sorted = (key: readonly unknown[]) =>
      [...(qc.getQueryData<{ id: string; sortOrder: number }[]>(key) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.id);
    expect(sorted(queryKeys.sections.list('p1'))).toEqual(['s2', 's1']);
    expect(sorted(queryKeys.labels.list())).toEqual(['l2', 'l1']);
    expect(sorted(queryKeys.filters.list())).toEqual(['f2', 'f1']);
    expect(sorted(queryKeys.projects.list(false))).toEqual(['inbox', 'q2', 'child', 'q1']);
  });

  it('answers without touching anything when the record is not cached or the type is unknown', () => {
    const qc = setup();
    expect(applyOptimistic(qc, { type: 'reorder', args: { type: 'TASK', id: 'zz', afterId: null } }, NOW)).toMatchObject({ sortOrder: 0 });
    expect(applyOptimistic(qc, { type: 'reorder', args: { type: 'NOPE', id: 'a', afterId: null } }, NOW)).toMatchObject({ sortOrder: 0 });
    expect(order(qc, key).filter((id) => id !== 'x')).toEqual(['a', 'b', 'c']);
  });
});

describe('applyOptimistic — task_batch', () => {
  const key = queryKeys.tasks.list({ projectId: 'p1' });
  const batch = (qc: QueryClient, args: Record<string, unknown>) =>
    applyOptimistic(qc, { type: 'task_batch', args }, NOW);

  it('answers with the affected ids', () => {
    expect(batch(setup(), { action: 'PRIORITY', taskIds: ['a', 'b'], priority: 1 })).toEqual({ taskIds: ['a', 'b'] });
  });

  it('CLOSE removes tasks from open lists and marks the detail done; REOPEN clears it', () => {
    const qc = setup();
    batch(qc, { action: 'CLOSE', taskIds: ['a', 'c'] });
    expect(listItems(qc, key).map((t) => t.id)).toEqual(['b', 'x']);
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('c'))?.completedAt).toBe(NOW);
    batch(qc, { action: 'REOPEN', taskIds: ['c'], undo: true });
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('c'))?.completedAt).toBeNull();
  });

  it('DELETE removes tasks and their detail entries', () => {
    const qc = setup();
    batch(qc, { action: 'DELETE', taskIds: ['b', 'c'] });
    expect(listItems(qc, key).map((t) => t.id)).toEqual(['a', 'x']);
    expect(qc.getQueryData(queryKeys.tasks.detail('c'))).toBeUndefined();
  });

  it('MOVE patches the destination and leaves the old project list', () => {
    const qc = setup();
    qc.setQueryData(queryKeys.projects.list(false), [{ id: 'p2', name: 'Work', sortOrder: 1 }]);
    batch(qc, { action: 'MOVE', taskIds: ['c'], projectId: 'p2', sectionId: 's9' });
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('c'))).toMatchObject({ projectId: 'p2', sectionId: 's9', parentId: null, projectName: 'Work' });
  });

  it('PRIORITY patches every task', () => {
    const qc = setup();
    batch(qc, { action: 'PRIORITY', taskIds: ['a', 'c'], priority: 1 });
    expect(listItems(qc, key).filter((t) => t.priority === 1).map((t) => t.id)).toEqual(['a', 'c']);
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('c'))?.priority).toBe(1);
  });

  it('SCHEDULE sets the day (a timed task keeps its time) and null clears the due', () => {
    const qc = setup();
    qc.setQueryData(
      queryKeys.tasks.list({ projectId: 'p9' }),
      page([task('t', { projectId: 'p9', dueDate: '2026-10-20', dueDatetime: '2026-10-20T09:15:00', durationMinutes: 30, isOverdue: true })]),
    );
    batch(qc, { action: 'SCHEDULE', taskIds: ['t'], date: '2026-10-30' });
    expect(listItems(qc, queryKeys.tasks.list({ projectId: 'p9' }))[0]).toMatchObject({
      dueDate: '2026-10-30',
      dueDatetime: '2026-10-30T09:15:00',
      durationMinutes: 30,
      isOverdue: false,
    });
    batch(qc, { action: 'SCHEDULE', taskIds: ['t'], date: null });
    expect(listItems(qc, queryKeys.tasks.list({ projectId: 'p9' }))[0]).toMatchObject({ dueDate: null, dueDatetime: null, durationMinutes: null });
    batch(qc, { action: 'SCHEDULE', taskIds: ['t'], date: '2026-10-01' });
    expect(listItems(qc, queryKeys.tasks.list({ projectId: 'p9' }))[0].isOverdue).toBe(true);
  });

  it('ADD_LABELS / REMOVE_LABELS change labelIds without duplicates', () => {
    const qc = setup();
    batch(qc, { action: 'ADD_LABELS', taskIds: ['a'], labelIds: ['l1', 'l2'] });
    batch(qc, { action: 'ADD_LABELS', taskIds: ['a'], labelIds: ['l2', 'l3'] });
    expect(listItems(qc, key).find((t) => t.id === 'a')?.labelIds).toEqual(['l1', 'l2', 'l3']);
    batch(qc, { action: 'REMOVE_LABELS', taskIds: ['a'], labelIds: ['l2'] });
    expect(listItems(qc, key).find((t) => t.id === 'a')?.labelIds).toEqual(['l1', 'l3']);
  });

  it('an unknown action only answers; ids that are not cached are ignored', () => {
    const qc = setup();
    expect(batch(qc, { action: 'NOPE', taskIds: ['a'] })).toEqual({ taskIds: ['a'] });
    expect(() => batch(qc, { action: 'PRIORITY', taskIds: ['ghost'], priority: 2 })).not.toThrow();
  });
});

describe('applyOptimistic — task_reschedule_overdue', () => {
  it('moves cached open overdue tasks to the date and answers with their ids', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    qc.setQueryData(
      queryKeys.tasks.list({ view: 'overdue' }),
      page([
        task('o1', { dueDate: '2026-10-20', isOverdue: true }),
        task('o2', { dueDate: '2026-10-21', dueDatetime: '2026-10-21T08:00:00', isOverdue: true }),
        task('fine', { dueDate: '2026-11-05' }),
      ]),
    );
    const answer = applyOptimistic(qc, { type: 'task_reschedule_overdue', args: { date: '2026-10-29' } }, NOW);
    expect(answer).toEqual({ taskIds: ['o1', 'o2'] });
    const items = listItems(qc, queryKeys.tasks.list({ view: 'overdue' }));
    expect(items[0]).toMatchObject({ dueDate: '2026-10-29', isOverdue: false });
    expect(items[1]).toMatchObject({ dueDate: '2026-10-29', dueDatetime: '2026-10-29T08:00:00', isOverdue: false });
    expect(items[2]).toMatchObject({ dueDate: '2026-11-05' });
  });

  it('does nothing without a date', () => {
    const qc = new QueryClient();
    expect(applyOptimistic(qc, { type: 'task_reschedule_overdue', args: {} }, NOW)).toEqual({ taskIds: [] });
  });
});

describe('applyOptimistic — favorites', () => {
  it.each([
    ['project', queryKeys.projects.list(false), 'PROJECT'],
    ['label', queryKeys.labels.list(), 'LABEL'],
    ['filter', queryKeys.filters.list(), 'FILTER'],
  ] as const)('%s favorite / unfavorite patches the record and the Favorites list', (kind, key, targetType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    qc.setQueryData(key, [{ id: 'x1', name: 'N', isFavorite: false, sortOrder: 1 }]);
    qc.setQueryData(queryKeys.favorites.list(), [{ targetType: 'PROJECT', targetId: 'other', createdAt: NOW }]);

    const on = applyOptimistic(qc, { type: `${kind}_favorite`, args: { id: 'x1' } }, NOW);
    expect(on).toMatchObject({ id: 'x1', name: 'N', isFavorite: true });
    expect(qc.getQueryData<{ isFavorite: boolean }[]>(key)?.[0].isFavorite).toBe(true);
    expect(qc.getQueryData<{ targetType: string; targetId: string }[]>(queryKeys.favorites.list())).toEqual([
      { targetType: 'PROJECT', targetId: 'other', createdAt: NOW },
      { targetType, targetId: 'x1', createdAt: NOW },
    ]);
    applyOptimistic(qc, { type: `${kind}_favorite`, args: { id: 'x1' } }, NOW); // twice is harmless
    expect(qc.getQueryData<unknown[]>(queryKeys.favorites.list())).toHaveLength(2);

    const off = applyOptimistic(qc, { type: `${kind}_unfavorite`, args: { id: 'x1' } }, NOW);
    expect(off).toMatchObject({ id: 'x1', isFavorite: false });
    expect(qc.getQueryData<unknown[]>(queryKeys.favorites.list())).toHaveLength(1);
  });

  it('works when nothing is cached', () => {
    const qc = new QueryClient();
    expect(applyOptimistic(qc, { type: 'label_favorite', args: { id: 'zz' } }, NOW)).toEqual({ id: 'zz', isFavorite: true });
  });
});

describe('applyOptimistic — reminders', () => {
  it('uses the same cache key as the reminders feature', () => {
    expect(remindersCacheKey('t1')).toEqual(taskRemindersKey('t1'));
  });

  it('reminder_add appends to the cached list (seconds added to a floating time) and answers with the reminder', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    qc.setQueryData(taskRemindersKey('t1'), []);
    const answer = applyOptimistic(
      qc,
      { type: 'reminder_add', tempId: 'r1', args: { id: 'r1', taskId: 't1', type: 'ABSOLUTE', at: '2026-10-29T09:00', urgent: true } },
      NOW,
    );
    expect(answer).toMatchObject({ id: 'r1', taskId: 't1', type: 'ABSOLUTE', at: '2026-10-29T09:00:00', minuteOffset: null, urgent: true });
    expect(qc.getQueryData<{ id: string }[]>(taskRemindersKey('t1'))).toHaveLength(1);
  });

  it('a relative and a location reminder carry their own fields', () => {
    const qc = new QueryClient();
    expect(
      applyOptimistic(qc, { type: 'reminder_add', tempId: 'r2', args: { id: 'r2', taskId: 't1', type: 'RELATIVE', minuteOffset: 30 } }, NOW),
    ).toMatchObject({ minuteOffset: 30, at: null, urgent: false });
    expect(
      applyOptimistic(qc, { type: 'reminder_add', tempId: 'r3', args: { id: 'r3', taskId: 't1', type: 'LOCATION', locationId: 'loc', trigger: 'ON_ENTER' } }, NOW),
    ).toMatchObject({ locationId: 'loc', locationTrigger: 'ON_ENTER' });
  });

  it('reminder_delete removes it from the cached list', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    qc.setQueryData(taskRemindersKey('t1'), [{ id: 'r1' }, { id: 'r2' }]);
    expect(applyOptimistic(qc, { type: 'reminder_delete', args: { id: 'r1', taskId: 't1' } }, NOW)).toBeUndefined();
    expect(qc.getQueryData(taskRemindersKey('t1'))).toEqual([{ id: 'r2' }]);
  });
});
