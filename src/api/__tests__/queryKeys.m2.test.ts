import { QueryClient } from '@tanstack/react-query';
import { DATA_ROOTS, invalidateData, queryKeys } from '../queryKeys';

describe('M2 query keys', () => {
  it('builds stable keys', () => {
    expect(queryKeys.labels.list()).toEqual(['labels', 'list']);
    expect(queryKeys.filters.list()).toEqual(['filters', 'list']);
    expect(queryKeys.filterValidation('today')).toEqual(['filterValidation', 'today']);
    expect(queryKeys.search.tasks('họp', true)).toEqual(['search', 'tasks', { q: 'họp', completed: true }]);
    expect(queryKeys.search.objects('họp')).toEqual(['search', 'objects', 'họp']);
    expect(queryKeys.viewOptions.list()).toEqual(['viewOptions', 'list']);
  });

  it('keeps the M1 roots and adds the M2 ones', () => {
    for (const root of ['tasks', 'projects', 'sections', 'labels', 'filters', 'search', 'viewOptions']) {
      expect(DATA_ROOTS.has(root)).toBe(true);
    }
    expect(DATA_ROOTS.has('filterValidation')).toBe(false);
  });

  it('marks label, filter, search and Display queries stale after a write, never filter validation', async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.labels.list(), []);
    client.setQueryData(queryKeys.filters.list(), []);
    client.setQueryData(queryKeys.search.tasks('a', false), { pages: [] });
    client.setQueryData(queryKeys.viewOptions.list(), []);
    client.setQueryData(queryKeys.filterValidation('today'), { parts: ['today'] });

    await invalidateData(client);

    expect(client.getQueryState(queryKeys.labels.list())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.filters.list())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.search.tasks('a', false))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.viewOptions.list())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.filterValidation('today'))?.isInvalidated).toBe(false);
  });
});
