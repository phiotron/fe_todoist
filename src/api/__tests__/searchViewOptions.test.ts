import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { makeViewOptions } from '../../test/m2Fixtures';
import { searchApi, searchObjectsPath, searchTasksPath } from '../search';
import { viewOptionsApi, viewOptionsPath } from '../viewOptions';

beforeEach(async () => {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
});

describe('search paths (spec 12.6)', () => {
  it('sends only q for open tasks and encodes Vietnamese text', () => {
    expect(searchTasksPath('họp nhóm', false, null)).toBe('/api/v1/search?q=h%E1%BB%8Dp%20nh%C3%B3m');
  });

  it('adds completed=true and the cursor only when needed', () => {
    expect(searchTasksPath('a', true, 'c1')).toBe('/api/v1/search?q=a&completed=true&cursor=c1');
    expect(searchTasksPath('a', false, 'c1')).toBe('/api/v1/search?q=a&cursor=c1');
  });

  it('builds the objects path', () => {
    expect(searchObjectsPath('đi chợ')).toBe('/api/v1/search/objects?q=%C4%91i%20ch%E1%BB%A3');
  });

  it('calls both endpoints', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [], nextCursor: null }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { projects: [], sections: [], labels: [], filters: [] }));
    await searchApi.tasks('a', false, null);
    await expect(searchApi.objects('a')).resolves.toEqual({ projects: [], sections: [], labels: [], filters: [] });
    expect(new URL(requestAt(fetchMock, 0).url).pathname).toBe('/api/v1/search');
    expect(new URL(requestAt(fetchMock, 1).url).pathname).toBe('/api/v1/search/objects');
  });
});

describe('view-options (spec 12.7)', () => {
  it('keeps the colon of the view key in the path', () => {
    expect(viewOptionsPath('TODAY')).toBe('/api/v1/view-options/TODAY');
    expect(viewOptionsPath('project:p-1')).toBe('/api/v1/view-options/project:p-1');
    expect(viewOptionsPath('label:a/b')).toBe('/api/v1/view-options/label:a%2Fb');
  });

  it('lists, saves (PUT) and resets (DELETE)', async () => {
    const saved = makeViewOptions('TODAY', { sortBy: 'PRIORITY' });
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [saved]));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, saved));
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(viewOptionsApi.list()).resolves.toEqual([saved]);
    await viewOptionsApi.save('project:p-1', { sortBy: 'NAME', sortDirection: 'DESC', groupBy: 'NONE', showCompleted: true });
    await viewOptionsApi.reset('project:p-1');

    expect(requestAt(fetchMock, 0)).toMatchObject({ method: 'GET' });
    expect(new URL(requestAt(fetchMock, 0).url).pathname).toBe('/api/v1/view-options');
    expect(requestAt(fetchMock, 1)).toMatchObject({
      method: 'PUT',
      body: { sortBy: 'NAME', sortDirection: 'DESC', groupBy: 'NONE', showCompleted: true },
    });
    expect(new URL(requestAt(fetchMock, 1).url).pathname).toBe('/api/v1/view-options/project:p-1');
    expect(requestAt(fetchMock, 2)).toMatchObject({ method: 'DELETE' });
  });
});
