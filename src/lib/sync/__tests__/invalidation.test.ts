import { QueryClient } from '@tanstack/react-query';
import { DATA_ROOTS } from '../../../api/queryKeys';
import { invalidateAfterSync, remindersAffected, rootsToRefresh } from '../invalidation';

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

  it('device reminders are re-planned only when tasks may have changed', () => {
    expect(remindersAffected({ resources: ['labels', 'FILTER'], everything: false })).toBe(false);
    expect(remindersAffected({ resources: ['tasks'], everything: false })).toBe(true);
    expect(remindersAffected({ resources: ['TASK'], everything: false })).toBe(true);
    expect(remindersAffected({ resources: ['projects'], everything: false })).toBe(true); // archive / delete a project
    expect(remindersAffected({ resources: ['sections'], everything: false })).toBe(true); // delete a section
    expect(remindersAffected({ resources: [], everything: true })).toBe(true);
  });
});
