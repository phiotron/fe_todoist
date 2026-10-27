import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { makeFavorite, makeSection, reorderResult } from '../../test/m1Fixtures';
import { favoritesApi } from '../favorites';
import { reorderApi } from '../reorder';
import { sectionsApi } from '../sections';

const pathOf = (url: string) => url.replace(/^.*\/api\/v1/, '');

describe('sectionsApi / favoritesApi / reorderApi', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('section calls hit the project-scoped paths', async () => {
    const fetchMock = mockFetch();
    const section = makeSection({ id: 's1', projectId: 'p1' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [section]))
      .mockResolvedValueOnce(jsonResponse(201, section))
      .mockResolvedValueOnce(jsonResponse(200, section))
      .mockResolvedValueOnce(jsonResponse(200, { ...section, archivedAt: '2026-10-23T03:00:00Z' }))
      .mockResolvedValueOnce(jsonResponse(200, section))
      .mockResolvedValueOnce(jsonResponse(204));

    await sectionsApi.list('p1');
    await sectionsApi.create('p1', { name: 'Việc gấp', description: 'Làm trước' }, 'key-9');
    await sectionsApi.update('p1', 's1', { name: 'Đổi tên' });
    await expect(sectionsApi.archive('p1', 's1')).resolves.toMatchObject({ archivedAt: '2026-10-23T03:00:00Z' });
    await sectionsApi.unarchive('p1', 's1');
    await sectionsApi.remove('p1', 's1');

    const calls = [0, 1, 2, 3, 4, 5].map((i) => requestAt(fetchMock, i));
    expect(calls.map((c) => `${c.method} ${pathOf(c.url)}`)).toEqual([
      'GET /projects/p1/sections',
      'POST /projects/p1/sections',
      'PATCH /projects/p1/sections/s1',
      'POST /projects/p1/sections/s1/archive',
      'POST /projects/p1/sections/s1/unarchive',
      'DELETE /projects/p1/sections/s1',
    ]);
    expect(calls[1].body).toEqual({ name: 'Việc gấp', description: 'Làm trước' });
    expect(calls[1].headers['Idempotency-Key']).toBe('key-9');
    expect(calls[2].body).toEqual({ name: 'Đổi tên' });
  });

  it('lists favorites in the order they were added', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, [makeFavorite('p2'), makeFavorite('p1')]));

    await expect(favoritesApi.list()).resolves.toEqual([
      expect.objectContaining({ targetType: 'PROJECT', targetId: 'p2' }),
      expect.objectContaining({ targetId: 'p1' }),
    ]);
    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/favorites');
  });

  it('reorder posts type, id and afterId (null = top) and answers the new sort order', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, reorderResult('SECTION', 's2', 512)));

    await expect(reorderApi.reorder({ type: 'SECTION', id: 's2', afterId: null })).resolves.toEqual({
      type: 'SECTION',
      id: 's2',
      sortOrder: 512,
    });

    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/reorder');
    expect(requestAt(fetchMock, 0).body).toEqual({ type: 'SECTION', id: 's2', afterId: null });
  });

  it('reorder ALWAYS carries afterId in the body (spec 3.1: absent → 400), also when it is null', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, reorderResult('TASK', 't2')));

    await reorderApi.reorder({ type: 'TASK', id: 't2', afterId: null });
    await reorderApi.reorder({ type: 'TASK', id: 't2', afterId: 't1' });

    for (const [index, expected] of [null, 't1'].entries()) {
      const body = requestAt(fetchMock, index).body as Record<string, unknown>;
      expect(Object.keys(body)).toContain('afterId');
      expect(body.afterId).toBe(expected);
    }
  });

  it('section create may carry afterId (absent = last, null = first) and never an id in M1', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(201, makeSection({ id: 's9', projectId: 'p1' })));

    await sectionsApi.create('p1', { name: 'A' }, 'k-1');
    await sectionsApi.create('p1', { name: 'B', afterId: null }, 'k-2');

    expect(requestAt(fetchMock, 0).body).toEqual({ name: 'A' });
    expect(requestAt(fetchMock, 1).body).toEqual({ name: 'B', afterId: null });
  });
});
