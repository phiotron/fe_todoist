import { QueryClient } from '@tanstack/react-query';
import { DATA_ROOTS } from '../../../api/queryKeys';
import { impactOfWrite, invalidateAfterSync, mergeImpacts, remindersAffected, rootsToRefresh } from '../invalidation';

/** PERF: after a sync only the query roots the reported resources can show are refreshed (not every DATA_ROOT). */

describe('sync invalidation', () => {
  it('maps each resource to the roots that show it, all of them data roots', () => {
    for (const resource of ['tasks', 'TASK', 'projects', 'PROJECT', 'sections', 'SECTION', 'labels', 'LABEL', 'filters', 'FILTER']) {
      const roots = rootsToRefresh({ resources: [resource], everything: false });
      expect(roots).not.toBe('all');
      for (const root of roots as ReadonlySet<string>) expect(DATA_ROOTS.has(root)).toBe(true);
    }
    expect(rootsToRefresh({ resources: ['labels'], everything: false })).toEqual(new Set(['labels', 'favorites', 'tasks', 'search']));
    expect(rootsToRefresh({ resources: ['filters'], everything: false })).toEqual(new Set(['filters', 'favorites', 'tasks']));
    const tasks = rootsToRefresh({ resources: ['tasks'], everything: false }) as ReadonlySet<string>;
    expect([...tasks]).toEqual(expect.arrayContaining(['tasks', 'projects', 'search', 'productivity', 'activity', 'insights']));
    expect(tasks.has('labels')).toBe(false);
    expect(tasks.has('sections')).toBe(false);
  });

  it('an unknown resource or a full refresh request refreshes every data root', () => {
    expect(rootsToRefresh({ resources: ['comments'], everything: false })).toBe('all');
    expect(rootsToRefresh({ resources: [], everything: true })).toBe('all');
  });

  it('nothing reported: nothing refreshed', async () => {
    const client = new QueryClient();
    client.setQueryData(['tasks', 'list', {}], []);
    await invalidateAfterSync(client, { resources: [], everything: false });
    expect(client.getQueryState(['tasks', 'list', {}])?.isInvalidated).toBe(false);
  });

  it('refreshes only the mapped roots', async () => {
    const client = new QueryClient();
    client.setQueryData(['labels', 'list'], []);
    client.setQueryData(['productivity', 'get'], {});
    client.setQueryData(['me'], {});
    await invalidateAfterSync(client, { resources: ['LABEL'], everything: false });
    expect(client.getQueryState(['labels', 'list'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['productivity', 'get'])?.isInvalidated).toBe(false);
    expect(client.getQueryState(['me'])?.isInvalidated).toBe(false);
  });

  it('everything = the M1 invalidateData behaviour (every data root, nothing else)', async () => {
    const client = new QueryClient();
    client.setQueryData(['productivity', 'get'], {});
    client.setQueryData(['me'], {});
    await invalidateAfterSync(client, { resources: [], everything: true });
    expect(client.getQueryState(['productivity', 'get'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['me'])?.isInvalidated).toBe(false);
  });

  describe('impactOfWrite (the REST write of useDataMutation)', () => {
    const impact = (method: string, path: string, body?: unknown) => impactOfWrite(method, `/api/v1/${path}`, body);
    const roots = (method: string, path: string, body?: unknown) => {
      const value = impact(method, path, body).roots;
      return value === 'all' ? 'all' : [...value].sort();
    };

    it('task edits: task lists + what counts tasks, not productivity / labels / filters', () => {
      for (const [method, path] of [
        ['POST', 'tasks'],
        ['PATCH', 'tasks/t1'],
        ['POST', 'tasks/t1/move'],
        ['POST', 'tasks/t1/duplicate'],
        ['DELETE', 'tasks/t1'],
        ['POST', 'tasks/overdue/reschedule'],
        ['POST', 'tasks/t1/reminders'],
        ['DELETE', 'tasks/t1/reminders/r1'],
      ] as const) {
        const value = roots(method, path, {});
        expect(value).toEqual(expect.arrayContaining(['tasks', 'projects']));
        for (const absent of ['productivity', 'labels', 'filters', 'viewOptions', 'templates', 'sections']) {
          expect(value).not.toContain(absent);
        }
      }
    });

    it('complete / reopen (and a batch that may complete) also refresh productivity', () => {
      expect(roots('POST', 'tasks/t1/close')).toContain('productivity');
      expect(roots('POST', 'tasks/t1/reopen')).toContain('productivity');
      expect(roots('POST', 'tasks/batch', { action: 'CLOSE', taskIds: [] })).toContain('productivity');
      expect(roots('POST', 'tasks/batch', { action: 'ADD_LABELS', taskIds: [] })).not.toContain('productivity');
    });

    it('labels / filters / projects / sections / view options / reorder map to their own roots', () => {
      expect(roots('POST', 'labels', { name: 'x' })).toEqual(['labels', 'search']);
      expect(roots('PATCH', 'labels/l1', { name: 'x' })).toEqual(['favorites', 'labels', 'search', 'tasks']);
      expect(roots('PUT', 'labels/l1/favorite')).toEqual(['favorites', 'labels']);
      expect(roots('POST', 'filters', {})).toEqual(['filters']);
      expect(roots('PATCH', 'filters/f1', {})).toEqual(['favorites', 'filters', 'tasks']);
      expect(roots('DELETE', 'projects/p1/favorite')).toEqual(['favorites', 'projects']);
      expect(roots('POST', 'projects', {})).not.toContain('tasks');
      expect(roots('POST', 'projects/p1/archive')).toEqual(expect.arrayContaining(['projects', 'tasks', 'sections', 'favorites']));
      expect(roots('PATCH', 'projects/p1/sections/s1', {})).toEqual(['activity', 'sections', 'tasks']);
      expect(roots('PUT', 'view-options/today', {})).toEqual(['viewOptions']);
      expect(roots('POST', 'reorder', { type: 'TASK' })).toEqual(['tasks']);
      expect(roots('POST', 'reorder', { type: 'LABEL' })).toEqual(['labels']);
      expect(roots('POST', 'tasks/t1/comments', {})).toEqual(['activity', 'projects', 'tasks']);
    });

    it('anything not mapped refreshes every data root (the old behaviour)', () => {
      expect(roots('POST', 'workspaces', {})).toBe('all');
      expect(roots('POST', 'templates/t1/import', {})).toBe('all');
      expect(roots('POST', 'reorder', { type: 'SOMETHING_NEW' })).toBe('all');
      expect(impact('POST', 'workspaces', {}).reminders).toBe(true);
    });

    it('reminders: only when a due date / time / text, a reminder or the task itself (close, delete) changes', () => {
      expect(impact('PATCH', 'tasks/t1', { version: 1, description: 'x', labelIds: [] }).reminders).toBe(false);
      expect(impact('PATCH', 'tasks/t1', { version: 1, dueDate: '2026-11-01' }).reminders).toBe(true);
      expect(impact('PATCH', 'tasks/t1', { version: 1, content: 'renamed' }).reminders).toBe(true);
      expect(impact('POST', 'tasks', { content: 'no date' }).reminders).toBe(false);
      expect(impact('POST', 'tasks', { content: 'x', dueDatetime: '2026-11-01T09:00:00Z' }).reminders).toBe(true);
      expect(impact('POST', 'tasks/t1/close').reminders).toBe(true);
      expect(impact('DELETE', 'tasks/t1').reminders).toBe(true);
      expect(impact('POST', 'tasks/t1/reminders', {}).reminders).toBe(true);
      expect(impact('POST', 'tasks/batch', { action: 'ADD_LABELS' }).reminders).toBe(false);
      expect(impact('POST', 'tasks/batch', { action: 'SCHEDULE' }).reminders).toBe(true);
      expect(impact('POST', 'labels', {}).reminders).toBe(false);
      expect(impact('POST', 'reorder', { type: 'TASK' }).reminders).toBe(false);
      expect(impact('POST', 'projects/p1/archive').reminders).toBe(true);
    });

    it('merges the writes of one mutation; none seen = everything', () => {
      const merged = mergeImpacts([impact('POST', 'labels', {}), impact('PUT', 'view-options/today', {})]);
      expect(merged.roots).toEqual(new Set(['labels', 'search', 'viewOptions']));
      expect(merged.reminders).toBe(false);
      expect(mergeImpacts([])).toEqual({ roots: 'all', reminders: true });
      expect(mergeImpacts([impact('POST', 'labels', {}), impact('POST', 'workspaces', {})]).roots).toBe('all');
    });
  });

  it('device reminders are re-planned only when tasks may have changed', () => {
    expect(remindersAffected({ resources: ['labels', 'FILTER'], everything: false })).toBe(false);
    expect(remindersAffected({ resources: ['tasks'], everything: false })).toBe(true);
    expect(remindersAffected({ resources: ['TASK'], everything: false })).toBe(true);
    expect(remindersAffected({ resources: ['projects'], everything: false })).toBe(true); // archive / delete a project
    expect(remindersAffected({ resources: ['sections'], everything: false })).toBe(true); // delete a section
    expect(remindersAffected({ resources: [], everything: true })).toBe(true);
  });
});
