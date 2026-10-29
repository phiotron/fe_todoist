import { QueryClient } from '@tanstack/react-query';
import { makeTask, page } from '../../../test/m1Fixtures';
import { WIDGET_REUSE_MS, freshTodayFirstPage } from '../WidgetSnapshotWriter';

const TODAY = '2026-10-29';
const key = (params: object) => ['tasks', 'list', params] as const;
const data = (n: number) => ({ pages: [page(Array.from({ length: n }, () => makeTask()), 'c1')], pageParams: [null] });

describe('freshTodayFirstPage (PERF3: the widget does not fetch what Today already holds)', () => {
  it('returns the first page of a fresh, unfiltered Today list', () => {
    const qc = new QueryClient();
    qc.setQueryData(key({ view: 'today', today: TODAY, sort: 'date', order: 'asc', group: 'none' }), data(3));
    expect(freshTodayFirstPage(qc, TODAY, Date.now())?.items).toHaveLength(3);
  });

  it('is null for another day, a filtered Today, an invalidated list or an old one', () => {
    const qc = new QueryClient();
    qc.setQueryData(key({ view: 'today', today: '2026-10-28' }), data(1));
    qc.setQueryData(key({ view: 'today', today: TODAY, filterPriority: 1 }), data(1));
    expect(freshTodayFirstPage(qc, TODAY, Date.now())).toBeNull();

    qc.setQueryData(key({ view: 'today', today: TODAY }), data(2));
    void qc.invalidateQueries({ queryKey: key({ view: 'today', today: TODAY }), refetchType: 'none' });
    expect(freshTodayFirstPage(qc, TODAY, Date.now())).toBeNull();

    const fresh = new QueryClient();
    fresh.setQueryData(key({ view: 'today', today: TODAY }), data(2));
    expect(freshTodayFirstPage(fresh, TODAY, Date.now() + WIDGET_REUSE_MS + 1)).toBeNull();
  });
});
