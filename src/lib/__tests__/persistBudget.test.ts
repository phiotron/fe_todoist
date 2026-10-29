import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { fillDemoCache } from '../../test/persistFixtures';
import {
  PERSIST_MAX_CHARS,
  PERSIST_MAX_PAGES,
  persistOptions,
  persistTier,
  serializePersistedClient,
} from '../queryClient';

/**
 * PERF3: what goes to AsyncStorage. Measured BEFORE the change on the demo cache (2221 tasks, 136 queries): 2 364 403
 * chars in ONE row, restore (JSON.parse + hydrate) 63 ms in node. That is over the 2 MB a single Android row can be
 * read back with, so the cache could silently stop restoring. The persisted cache is now an allowlist of roots, at
 * most PERSIST_MAX_PAGES pages per infinite list, under a budget.
 */
function snapshot(): { client: PersistedClient; json: string } {
  const qc = new QueryClient();
  fillDemoCache(qc);
  const clientState = dehydrate(qc, persistOptions.dehydrateOptions);
  const client: PersistedClient = { timestamp: 1, buster: persistOptions.buster, clientState };
  return { client, json: serializePersistedClient(client) };
}

describe('persisted query cache budget', () => {
  it('stays under the budget and far under the 2.36 M chars measured before', () => {
    const { json } = snapshot();
    expect(json.length).toBeLessThanOrEqual(PERSIST_MAX_CHARS);
    expect(json.length).toBeLessThan(1_000_000);
  });

  it('serialising and restoring the demo cache is fast (node; a weak phone is ~10x slower)', () => {
    const { client, json } = snapshot();
    let t = performance.now();
    serializePersistedClient(client);
    const stringifyMs = performance.now() - t;
    t = performance.now();
    const parsed = JSON.parse(json) as PersistedClient;
    hydrate(new QueryClient(), parsed.clientState);
    const restoreMs = performance.now() - t;
    expect(stringifyMs).toBeLessThan(150);
    expect(restoreMs).toBeLessThan(100);
  });

  it('persists no search / activity results and nothing that is not an allowlisted root', () => {
    const { json } = snapshot();
    const keys = (JSON.parse(json) as PersistedClient).clientState.queries.map((q) => String(q.queryKey[0]));
    expect(keys).not.toContain('search');
    expect(keys).not.toContain('activity');
    expect(keys).toEqual(expect.arrayContaining(['me', 'settings', 'projects', 'labels', 'tasks']));
  });

  it('keeps at most PERSIST_MAX_PAGES pages (and pageParams) of an infinite list, the first ones', () => {
    const { json } = snapshot();
    const lists = (JSON.parse(json) as PersistedClient).clientState.queries.filter((q) => q.queryKey[0] === 'tasks' && q.queryKey[1] === 'list');
    expect(lists.length).toBeGreaterThan(0);
    for (const q of lists) {
      const data = q.state.data as { pages: unknown[]; pageParams: unknown[] };
      expect(data.pages.length).toBeLessThanOrEqual(PERSIST_MAX_PAGES);
      expect(data.pageParams.length).toBe(data.pages.length);
    }
    const cut = lists.filter((q) => (q.state.data as { pages: unknown[] }).pages.length === PERSIST_MAX_PAGES);
    expect(cut.length).toBeGreaterThan(0);
    // More pages exist on the server: "load more" still works after a restore.
    const lastCursors = cut.map((q) => {
      const pages = (q.state.data as { pages: { nextCursor: string | null }[] }).pages;
      return pages[pages.length - 1].nextCursor;
    });
    expect(lastCursors.some((cursor) => cursor !== null)).toBe(true);
  });

  it('over the budget the big task lists go first; the small base data (me, settings, projects) stays', () => {
    const { client } = snapshot();
    const tiny = serializePersistedClient(client, 20_000);
    expect(tiny.length).toBeLessThanOrEqual(20_000);
    const roots = (JSON.parse(tiny) as PersistedClient).clientState.queries.map((q) => String(q.queryKey[0]));
    expect(roots).toEqual(expect.arrayContaining(['me', 'settings', 'projects', 'labels']));
  });

  it('never persists a query still loading, nor mutations', () => {
    const qc = new QueryClient();
    void qc.prefetchQuery({ queryKey: ['projects', 'list'], queryFn: () => new Promise(() => undefined) });
    const state = dehydrate(qc, persistOptions.dehydrateOptions);
    expect(state.queries).toHaveLength(0);
    expect(state.mutations).toHaveLength(0);
  });

  it('classifies keys: base data 0, task lists 1, one-task caches 2, everything else not persisted', () => {
    expect(persistTier(['me'])).toBe(0);
    expect(persistTier(['projects', 'list', { archived: false }])).toBe(0);
    expect(persistTier(['tasks', 'list', { view: 'today' }])).toBe(1);
    expect(persistTier(['tasks', 'upcoming', '2026-10-29', null])).toBe(1);
    expect(persistTier(['tasks', 'detail', 't1'])).toBe(2);
    expect(persistTier(['tasks', 'subtasks', 't1'])).toBe(2);
    expect(persistTier(['search', 'tasks', {}])).toBeNull();
    expect(persistTier(['activity', 'list', {}])).toBeNull();
    expect(persistTier(['workspaces', 'members', 'w1'])).toBeNull();
  });
});

describe('what the demo snapshot costs now', () => {
  it('prints the size (for the before/after table)', () => {
    const { json } = snapshot();
    const queries = (JSON.parse(json) as PersistedClient).clientState.queries.length;
    // eslint-disable-next-line no-console
    console.log(`PERF3 persisted: ${json.length} chars, ${queries} queries`);
  });
});
