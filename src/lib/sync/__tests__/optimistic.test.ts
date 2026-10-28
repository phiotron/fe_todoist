import { QueryClient } from '@tanstack/react-query';
import type { Task } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { applyOptimistic } from '../optimistic';

const NOW = '2026-10-28T10:00:00.000Z';

function task(id: string, extra: Record<string, unknown> = {}): Task {
  return {
    id,
    projectId: 'p1',
    sectionId: null,
    parentId: null,
    content: `task ${id}`,
    description: '',
    priority: 4,
    dueDate: null,
    dueDatetime: null,
    durationMinutes: null,
    deadlineDate: null,
    dueString: null,
    isOverdue: false,
    completedAt: null,
    subtaskCount: 0,
    completedSubtaskCount: 0,
    sortOrder: 1,
    version: 3,
    createdAt: NOW,
    updatedAt: NOW,
    projectName: 'Home',
    parentContent: null,
    labelIds: [],
    ...extra,
  } as unknown as Task;
}

const project = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  color: 'teal',
  description: '',
  parentId: null,
  isInbox: false,
  isFavorite: false,
  archivedAt: null,
  sortOrder: 1,
  ...extra,
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const projectList = [project('inbox', { isInbox: true, name: 'Inbox' }), project('p1', { name: 'Home' })];
  queryClient.setQueryData(queryKeys.projects.list(false), projectList);
  const projectTasks = { pages: [{ items: [task('t1'), task('t2')], nextCursor: null }], pageParams: [null] };
  queryClient.setQueryData(queryKeys.tasks.list({ projectId: 'p1' }), projectTasks);
  queryClient.setQueryData(queryKeys.tasks.list({ projectId: 'p1', completed: true }), {
    pages: [{ items: [task('done', { completedAt: NOW })], nextCursor: null }],
    pageParams: [null],
  });
  queryClient.setQueryData(queryKeys.tasks.list({ view: 'today' }), {
    pages: [{ items: [task('t1')], nextCursor: null }],
    pageParams: [null],
  });
  queryClient.setQueryData(queryKeys.tasks.detail('t1'), task('t1'));
  return queryClient;
}

const items = (qc: QueryClient, key: readonly unknown[]) =>
  (qc.getQueryData<{ pages: { items: Task[] }[] }>(key)?.pages ?? []).flatMap((p) => p.items);

describe('applyOptimistic — tasks', () => {
  it('task_add: builds the answer, fills the detail cache and appends to the project list only', () => {
    const qc = setup();
    const built = applyOptimistic(qc, { type: 'task_add', tempId: 'n1', args: { id: 'n1', content: 'new', projectId: 'p1', priority: 1 } }, NOW) as Task;

    expect(built).toMatchObject({ id: 'n1', content: 'new', projectId: 'p1', projectName: 'Home', priority: 1, completedAt: null });
    expect(qc.getQueryData(queryKeys.tasks.detail('n1'))).toBe(built);
    expect(items(qc, queryKeys.tasks.list({ projectId: 'p1' })).map((t) => t.id)).toEqual(['t1', 't2', 'n1']);
    expect(items(qc, queryKeys.tasks.list({ projectId: 'p1', completed: true })).map((t) => t.id)).toEqual(['done']);
    expect(items(qc, queryKeys.tasks.list({ view: 'today' })).map((t) => t.id)).toEqual(['t1']);
  });

  it('task_add without a project goes to the Inbox; a sub-task joins its parent and bumps the count', () => {
    const qc = setup();
    const inbox = applyOptimistic(qc, { type: 'task_add', tempId: 'a', args: { id: 'a', content: 'x' } }, NOW) as Task;
    expect(inbox.projectId).toBe('inbox');

    qc.setQueryData(queryKeys.tasks.subtasks('t1'), [task('s0', { parentId: 't1' })]);
    const sub = applyOptimistic(qc, { type: 'task_add', tempId: 's', args: { id: 's', content: 'sub', parentId: 't1' } }, NOW) as Task;
    expect(sub).toMatchObject({ parentId: 't1', projectId: 'p1', parentContent: 'task t1' });
    expect(qc.getQueryData<Task[]>(queryKeys.tasks.subtasks('t1'))?.map((t) => t.id)).toEqual(['s0', 's']);
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('t1'))?.subtaskCount).toBe(1);
    expect(items(qc, queryKeys.tasks.list({ projectId: 'p1' })).map((t) => t.id)).not.toContain('s');
  });

  it('task_update patches every cached copy and answers with the merged task', () => {
    const qc = setup();
    const answer = applyOptimistic(qc, { type: 'task_update', args: { id: 't1', content: 'edited', priority: 2, dueDate: null } }, NOW) as Task;

    expect(answer).toMatchObject({ id: 't1', content: 'edited', priority: 2, dueDate: null });
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('t1'))?.content).toBe('edited');
    expect(items(qc, queryKeys.tasks.list({ projectId: 'p1' }))[0].content).toBe('edited');
    expect(items(qc, queryKeys.tasks.list({ view: 'today' }))[0].priority).toBe(2);
    expect(items(qc, queryKeys.tasks.list({ projectId: 'p1' }))[1].content).toBe('task t2');
  });

  it('task_close: marks done in detail, leaves open lists, answers in the TaskChangeResponse shape', () => {
    const qc = setup();
    const answer = applyOptimistic(qc, { type: 'task_close', args: { id: 't1' } }, NOW) as { task: Task; cascaded: unknown[] };

    expect(answer.task).toMatchObject({ id: 't1', completedAt: NOW });
    expect(answer.cascaded).toEqual([]);
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('t1'))?.completedAt).toBe(NOW);
    expect(items(qc, queryKeys.tasks.list({ projectId: 'p1' })).map((t) => t.id)).toEqual(['t2']);
    expect(items(qc, queryKeys.tasks.list({ view: 'today' }))).toEqual([]);
    expect(items(qc, queryKeys.tasks.list({ projectId: 'p1', completed: true })).map((t) => t.id)).toEqual(['done']);
  });

  it('task_reopen clears completedAt', () => {
    const qc = setup();
    qc.setQueryData(queryKeys.tasks.detail('done'), task('done', { completedAt: NOW }));
    const answer = applyOptimistic(qc, { type: 'task_reopen', args: { id: 'done' } }, NOW) as { task: Task };
    expect(answer.task.completedAt).toBeNull();
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('done'))?.completedAt).toBeNull();
  });

  it('task_delete removes the task, its cached children and their detail entries', () => {
    const qc = setup();
    qc.setQueryData(queryKeys.tasks.subtasks('t1'), [task('c1', { parentId: 't1' })]);
    qc.setQueryData(queryKeys.tasks.detail('c1'), task('c1', { parentId: 't1' }));

    expect(applyOptimistic(qc, { type: 'task_delete', args: { id: 't1' } }, NOW)).toBeUndefined();

    expect(items(qc, queryKeys.tasks.list({ projectId: 'p1' })).map((t) => t.id)).toEqual(['t2']);
    expect(qc.getQueryData(queryKeys.tasks.detail('t1'))).toBeUndefined();
    expect(qc.getQueryData(queryKeys.tasks.detail('c1'))).toBeUndefined();
    expect(qc.getQueryData<Task[]>(queryKeys.tasks.subtasks('t1'))).toEqual([]);
  });

  it('task_move patches the destination and leaves the old project list', () => {
    const qc = setup();
    qc.setQueryData(queryKeys.projects.list(false), [project('p2', { name: 'Work' }), project('p1', { name: 'Home' })]);
    const answer = applyOptimistic(qc, { type: 'task_move', args: { id: 't1', projectId: 'p2', sectionId: null } }, NOW) as Task;

    expect(answer).toMatchObject({ projectId: 'p2', projectName: 'Work' });
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('t1'))?.projectId).toBe('p2');
    expect(items(qc, queryKeys.tasks.list({ projectId: 'p1' })).map((t) => t.id)).toEqual(['t2']);
    expect(items(qc, queryKeys.tasks.list({ view: 'today' })).map((t) => t.id)).toEqual(['t1']);
  });
});

describe('applyOptimistic — projects, sections, labels, filters', () => {
  it('project add / update / archive / delete', () => {
    const qc = setup();
    const created = applyOptimistic(qc, { type: 'project_add', tempId: 'np', args: { id: 'np', name: 'New', color: 'red' } }, NOW) as { id: string };
    expect(created).toMatchObject({ id: 'np', name: 'New', color: 'red', isInbox: false, archivedAt: null });
    expect(qc.getQueryData<{ id: string }[]>(queryKeys.projects.list(false))?.map((p) => p.id)).toEqual(['inbox', 'p1', 'np']);

    applyOptimistic(qc, { type: 'project_update', args: { id: 'p1', name: 'Renamed' } }, NOW);
    expect(qc.getQueryData<{ name: string }[]>(queryKeys.projects.list(false))?.[1].name).toBe('Renamed');

    applyOptimistic(qc, { type: 'project_archive', args: { id: 'p1' } }, NOW);
    expect(qc.getQueryData<{ id: string }[]>(queryKeys.projects.list(false))?.map((p) => p.id)).toEqual(['inbox', 'np']);

    applyOptimistic(qc, { type: 'project_delete', args: { id: 'np' } }, NOW);
    expect(qc.getQueryData<{ id: string }[]>(queryKeys.projects.list(false))?.map((p) => p.id)).toEqual(['inbox']);
  });

  it('section add / update / delete', () => {
    const qc = setup();
    qc.setQueryData(queryKeys.sections.list('p1'), []);
    const created = applyOptimistic(qc, { type: 'section_add', tempId: 's1', args: { id: 's1', projectId: 'p1', name: 'S' } }, NOW);
    expect(created).toMatchObject({ id: 's1', projectId: 'p1', name: 'S' });
    expect(qc.getQueryData<unknown[]>(queryKeys.sections.list('p1'))).toHaveLength(1);

    applyOptimistic(qc, { type: 'section_update', args: { id: 's1', projectId: 'p1', name: 'S2' } }, NOW);
    expect(qc.getQueryData<{ name: string }[]>(queryKeys.sections.list('p1'))?.[0].name).toBe('S2');

    applyOptimistic(qc, { type: 'section_delete', args: { id: 's1', projectId: 'p1' } }, NOW);
    expect(qc.getQueryData<unknown[]>(queryKeys.sections.list('p1'))).toEqual([]);
  });

  it('label and filter add / update / delete', () => {
    const qc = setup();
    qc.setQueryData(queryKeys.labels.list(), []);
    qc.setQueryData(queryKeys.filters.list(), []);

    expect(applyOptimistic(qc, { type: 'label_add', tempId: 'l', args: { id: 'l', name: 'urgent' } }, NOW)).toMatchObject({ id: 'l', color: 'charcoal' });
    expect(applyOptimistic(qc, { type: 'filter_add', tempId: 'f', args: { id: 'f', name: 'F', query: 'p1' } }, NOW)).toMatchObject({ id: 'f', query: 'p1' });
    applyOptimistic(qc, { type: 'label_update', args: { id: 'l', name: 'later' } }, NOW);
    applyOptimistic(qc, { type: 'filter_update', args: { id: 'f', query: 'p2' } }, NOW);
    expect(qc.getQueryData<{ name: string }[]>(queryKeys.labels.list())?.[0].name).toBe('later');
    expect(qc.getQueryData<{ query: string }[]>(queryKeys.filters.list())?.[0].query).toBe('p2');

    applyOptimistic(qc, { type: 'label_delete', args: { id: 'l' } }, NOW);
    applyOptimistic(qc, { type: 'filter_delete', args: { id: 'f' } }, NOW);
    expect(qc.getQueryData(queryKeys.labels.list())).toEqual([]);
    expect(qc.getQueryData(queryKeys.filters.list())).toEqual([]);
  });

  it('an unknown command type changes nothing', () => {
    const qc = setup();
    expect(applyOptimistic(qc, { type: 'future_cmd', args: { id: 'x' } }, NOW)).toBeUndefined();
  });

  it('works on an empty cache (nothing cached yet)', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    expect(applyOptimistic(qc, { type: 'task_add', tempId: 'a', args: { id: 'a', content: 'c' } }, NOW)).toMatchObject({ id: 'a', projectId: '' });
    expect(() => applyOptimistic(qc, { type: 'task_update', args: { id: 'zz', content: 'c' } }, NOW)).not.toThrow();
    expect(() => applyOptimistic(qc, { type: 'task_close', args: { id: 'zz' } }, NOW)).not.toThrow();
  });
});
