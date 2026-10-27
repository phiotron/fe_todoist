import { QueryClient } from '@tanstack/react-query';
import { makeTask, taskChange } from '../../test/m1Fixtures';
import { queryKeys } from '../queryKeys';
import { applyTaskChange } from '../taskCache';

describe('applyTaskChange (spec 3.1: close / reopen answer → cache)', () => {
  const parent = makeTask({ id: 'p1', version: 1, subtaskCount: 1 });
  const child = makeTask({ id: 'c1', parentId: 'p1', version: 4 });
  const other = makeTask({ id: 'x1', version: 9 });

  function seeded() {
    const client = new QueryClient();
    client.setQueryData(queryKeys.tasks.detail('p1'), parent);
    client.setQueryData(queryKeys.tasks.detail('c1'), child);
    client.setQueryData(queryKeys.tasks.subtasks('p1'), [child]);
    client.setQueryData(queryKeys.tasks.list({ view: 'today' }), {
      pages: [{ items: [parent, other], nextCursor: null }],
      pageParams: [undefined],
    });
    return client;
  }

  it('writes the answered task and every cascaded version / completedAt into all cached copies', () => {
    const client = seeded();
    const done = { ...parent, version: 2, completedAt: '2026-10-23T03:00:00Z' };
    applyTaskChange(
      client,
      taskChange(done, [{ id: 'c1', version: 5, completedAt: '2026-10-23T03:00:00Z' }]),
    );

    expect(client.getQueryData(queryKeys.tasks.detail('p1'))).toMatchObject({ version: 2, completedAt: done.completedAt });
    expect(client.getQueryData(queryKeys.tasks.detail('c1'))).toMatchObject({ version: 5, completedAt: done.completedAt });
    expect(client.getQueryData<(typeof child)[]>(queryKeys.tasks.subtasks('p1'))?.[0]).toMatchObject({ id: 'c1', version: 5 });
    const list = client.getQueryData<{ pages: { items: (typeof parent)[] }[] }>(queryKeys.tasks.list({ view: 'today' }));
    expect(list?.pages[0].items.map((t) => [t.id, t.version])).toEqual([
      ['p1', 2],
      ['x1', 9],
    ]);
  });

  it('a reopen (completedAt null) clears completedAt on the cascaded tasks', () => {
    const client = seeded();
    applyTaskChange(client, taskChange({ ...parent, version: 3 }, [{ id: 'c1', version: 6, completedAt: null }]));
    expect(client.getQueryData(queryKeys.tasks.detail('c1'))).toMatchObject({ version: 6, completedAt: null });
  });

  it('leaves caches it does not hold alone and does not create entries', () => {
    const client = new QueryClient();
    applyTaskChange(client, taskChange(parent, [{ id: 'c1', version: 5, completedAt: null }]));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
