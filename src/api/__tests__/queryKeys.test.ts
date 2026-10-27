import { QueryClient } from '@tanstack/react-query';
import { invalidateData, queryKeys } from '../queryKeys';

describe('queryKeys / invalidateData', () => {
  it('builds stable keys per list', () => {
    expect(queryKeys.tasks.list({ view: 'today' })).toEqual(['tasks', 'list', { view: 'today' }]);
    expect(queryKeys.tasks.subtasks('t1')).toEqual(['tasks', 'subtasks', 't1']);
    expect(queryKeys.tasks.upcoming('2026-10-23')).toEqual(['tasks', 'upcoming', '2026-10-23']);
    expect(queryKeys.projects.list(true)).toEqual(['projects', 'list', { archived: true }]);
    expect(queryKeys.sections.list('p1')).toEqual(['sections', 'list', 'p1']);
    expect(queryKeys.favorites.list()).toEqual(['favorites', 'list']);
  });

  it('marks every task/project/section/favorite query stale and leaves others alone', async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.tasks.list({ projectId: 'p1' }), { pages: [] });
    client.setQueryData(queryKeys.tasks.subtasks('t1'), []);
    client.setQueryData(queryKeys.projects.list(false), []);
    client.setQueryData(queryKeys.sections.list('p1'), []);
    client.setQueryData(queryKeys.favorites.list(), []);
    client.setQueryData(['me'], { id: 'u1' });

    await invalidateData(client);

    expect(client.getQueryState(queryKeys.tasks.list({ projectId: 'p1' }))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.tasks.subtasks('t1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.projects.list(false))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.sections.list('p1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.favorites.list())?.isInvalidated).toBe(true);
    expect(client.getQueryState(['me'])?.isInvalidated).toBe(false);
  });

  it('keepDetail leaves task detail queries alone (reorder never changes version) but refreshes the lists', async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.tasks.detail('t1'), { id: 't1', version: 2 });
    client.setQueryData(queryKeys.tasks.list({ projectId: 'p1' }), { pages: [] });
    client.setQueryData(queryKeys.tasks.subtasks('t1'), []);
    client.setQueryData(queryKeys.projects.list(false), []);

    await invalidateData(client, { keepDetail: true });

    expect(client.getQueryState(queryKeys.tasks.detail('t1'))?.isInvalidated).toBe(false);
    expect(client.getQueryState(queryKeys.tasks.list({ projectId: 'p1' }))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.tasks.subtasks('t1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.projects.list(false))?.isInvalidated).toBe(true);
  });
});
