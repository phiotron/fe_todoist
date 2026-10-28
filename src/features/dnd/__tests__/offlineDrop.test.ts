import { mapRequest } from '../../../lib/sync/commandMap';

const newId = () => 'tmp-1';

/** DND writes go through routes the offline queue already knows: nothing new to register in lib/sync. */
describe('DND writes while offline', () => {
  it('the day order (TASK_DAY) is queued as the existing `reorder` command, body = args', () => {
    expect(mapRequest('POST', '/api/v1/reorder', { type: 'TASK_DAY', id: 't1', afterId: null }, newId)).toEqual({
      type: 'reorder',
      args: { type: 'TASK_DAY', id: 't1', afterId: null },
    });
  });

  it('a day change is a task_update (version dropped), a section change a task_move', () => {
    expect(mapRequest('PATCH', '/api/v1/tasks/t1', { version: 3, dueDate: '2026-10-28', dueDatetime: null, durationMinutes: null }, newId)).toEqual({
      type: 'task_update',
      args: { id: 't1', dueDate: '2026-10-28', dueDatetime: null, durationMinutes: null },
    });
    expect(mapRequest('POST', '/api/v1/tasks/t1/move', { projectId: 'p1', sectionId: 's1', parentId: null, afterId: null }, newId)?.type).toBe('task_move');
  });
});
