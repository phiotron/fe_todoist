import { mapRequest } from '../commandMap';

let n = 0;
const newId = () => `generated-${++n}`;
beforeEach(() => {
  n = 0;
});

describe('mapRequest — creates', () => {
  it('keeps a client id and uses it as tempId', () => {
    expect(mapRequest('POST', '/api/v1/tasks', { id: 'abc', content: 'x' }, newId)).toEqual({
      type: 'task_add',
      tempId: 'abc',
      args: { id: 'abc', content: 'x' },
    });
  });

  it('generates the id when the body has none (spec 12.11: the queue layer makes it)', () => {
    expect(mapRequest('POST', '/api/v1/tasks', { content: 'x' }, newId)).toEqual({
      type: 'task_add',
      tempId: 'generated-1',
      args: { content: 'x', id: 'generated-1' },
    });
  });

  it.each([
    ['/api/v1/projects', 'project_add'],
    ['/api/v1/labels', 'label_add'],
    ['/api/v1/filters', 'filter_add'],
  ])('maps POST %s', (path, type) => {
    expect(mapRequest('POST', path, { name: 'n' }, newId)?.type).toBe(type);
  });

  it('puts the project id of a section create into args', () => {
    expect(mapRequest('POST', '/api/v1/projects/p%201/sections', { name: 'S' }, newId)).toEqual({
      type: 'section_add',
      tempId: 'generated-1',
      args: { name: 'S', id: 'generated-1', projectId: 'p 1' },
    });
  });
});

describe('mapRequest — updates and state changes', () => {
  it('drops `version` from a task update (the server applies field changes onto its current version)', () => {
    expect(mapRequest('PATCH', '/api/v1/tasks/t1', { version: 7, content: 'new' }, newId)).toEqual({
      type: 'task_update',
      args: { content: 'new', id: 't1' },
    });
  });

  it.each([
    ['POST', '/api/v1/tasks/t1/close', 'task_close'],
    ['POST', '/api/v1/tasks/t1/reopen', 'task_reopen'],
    ['POST', '/api/v1/tasks/t1/move', 'task_move'],
    ['DELETE', '/api/v1/tasks/t1', 'task_delete'],
    ['PATCH', '/api/v1/projects/t1', 'project_update'],
    ['DELETE', '/api/v1/projects/t1', 'project_delete'],
    ['POST', '/api/v1/projects/t1/move', 'project_move'],
    ['POST', '/api/v1/projects/t1/archive', 'project_archive'],
    ['POST', '/api/v1/projects/t1/unarchive', 'project_unarchive'],
    ['PATCH', '/api/v1/labels/t1', 'label_update'],
    ['DELETE', '/api/v1/labels/t1', 'label_delete'],
    ['PATCH', '/api/v1/filters/t1', 'filter_update'],
    ['DELETE', '/api/v1/filters/t1', 'filter_delete'],
  ] as const)('maps %s %s', (method, path, type) => {
    const mapped = mapRequest(method, path, undefined, newId);
    expect(mapped?.type).toBe(type);
    expect(mapped?.args.id).toBe('t1');
    expect(mapped?.tempId).toBeUndefined();
  });

  it('keeps the undo flag of a reopen', () => {
    expect(mapRequest('POST', '/api/v1/tasks/t1/reopen', { undo: true }, newId)?.args).toEqual({ undo: true, id: 't1' });
  });

  it.each([
    ['PATCH', '/api/v1/projects/p1/sections/s1', 'section_update'],
    ['DELETE', '/api/v1/projects/p1/sections/s1', 'section_delete'],
    ['POST', '/api/v1/projects/p1/sections/s1/archive', 'section_archive'],
    ['POST', '/api/v1/projects/p1/sections/s1/unarchive', 'section_unarchive'],
  ] as const)('maps section %s %s with both ids', (method, path, type) => {
    expect(mapRequest(method, path, { name: 'N' }, newId)).toEqual({
      type,
      args: { name: 'N', id: 's1', projectId: 'p1' },
    });
  });

  it('ignores the query string', () => {
    expect(mapRequest('DELETE', '/api/v1/tasks/t1?x=1', undefined, newId)?.type).toBe('task_delete');
  });
});

describe('mapRequest — not queueable', () => {
  it.each([
    ['GET', '/api/v1/tasks'],
    ['POST', '/api/v1/tasks/t1/duplicate'],
    ['GET', '/api/v1/tasks/t1/reminders'],
    ['POST', '/api/v1/filters/validate'],
    ['PATCH', '/api/v1/me/settings'],
    ['POST', '/api/v1/me/settings/reset'],
    ['POST', '/api/v1/auth/logout'],
    ['PUT', '/api/v1/view-options/TODAY'],
  ] as const)('%s %s is null', (method, path) => {
    expect(mapRequest(method, path, {}, newId)).toBeNull();
  });
});

describe('mapRequest — M9 phase 2 (reorder, batch, favorites, reminders)', () => {
  it('maps a reorder to a command whose args are the REST body (afterId null kept)', () => {
    expect(mapRequest('POST', '/api/v1/reorder', { type: 'TASK', id: 't1', afterId: null }, newId)).toEqual({
      type: 'reorder',
      args: { type: 'TASK', id: 't1', afterId: null },
    });
  });

  it('maps tasks/batch and overdue reschedule with the body as args', () => {
    expect(mapRequest('POST', '/api/v1/tasks/batch', { action: 'CLOSE', taskIds: ['a', 'b'] }, newId)).toEqual({
      type: 'task_batch',
      args: { action: 'CLOSE', taskIds: ['a', 'b'] },
    });
    expect(mapRequest('POST', '/api/v1/tasks/overdue/reschedule', { date: '2026-11-01' }, newId)).toEqual({
      type: 'task_reschedule_overdue',
      args: { date: '2026-11-01' },
    });
  });

  it.each([
    ['PUT', '/api/v1/projects/p1/favorite', 'project_favorite'],
    ['DELETE', '/api/v1/projects/p1/favorite', 'project_unfavorite'],
    ['PUT', '/api/v1/labels/p1/favorite', 'label_favorite'],
    ['DELETE', '/api/v1/labels/p1/favorite', 'label_unfavorite'],
    ['PUT', '/api/v1/filters/p1/favorite', 'filter_favorite'],
    ['DELETE', '/api/v1/filters/p1/favorite', 'filter_unfavorite'],
  ] as const)('maps %s %s', (method, path, type) => {
    expect(mapRequest(method, path, undefined, newId)).toEqual({ type, args: { id: 'p1' } });
  });

  it('maps a reminder create with a temp id (the app id) and the task id', () => {
    expect(mapRequest('POST', '/api/v1/tasks/t%201/reminders', { type: 'RELATIVE', minuteOffset: 30 }, newId)).toEqual({
      type: 'reminder_add',
      tempId: 'generated-1',
      args: { type: 'RELATIVE', minuteOffset: 30, id: 'generated-1', taskId: 't 1' },
    });
  });

  it('maps a reminder delete with both ids', () => {
    expect(mapRequest('DELETE', '/api/v1/tasks/t1/reminders/r1', undefined, newId)).toEqual({
      type: 'reminder_delete',
      args: { id: 'r1', taskId: 't1' },
    });
  });

  it('keeps a plain task delete on its own route', () => {
    expect(mapRequest('DELETE', '/api/v1/tasks/t1', undefined, newId)?.type).toBe('task_delete');
  });
});
