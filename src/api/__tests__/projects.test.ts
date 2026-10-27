import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { makeProject } from '../../test/m1Fixtures';
import { projectsApi } from '../projects';

const pathOf = (url: string) => url.replace(/^.*\/api\/v1/, '');

describe('projectsApi', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('lists active projects by default and archived ones on request', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, [makeProject()]));

    await projectsApi.list();
    await projectsApi.list(true);

    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/projects');
    expect(pathOf(requestAt(fetchMock, 1).url)).toBe('/projects?archived=true');
  });

  it('creates with an Idempotency-Key, edits with PATCH and moves under another parent', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(201, makeProject({ id: 'p1' })));

    await projectsApi.create({ name: 'Nhà', color: 'red', description: 'Việc nhà', parentId: 'p0' }, 'key-1');
    await projectsApi.update('p1', { name: 'Nhà mới' });
    await projectsApi.move('p1', { parentId: null });

    const create = requestAt(fetchMock, 0);
    expect(create.method).toBe('POST');
    expect(create.headers['Idempotency-Key']).toBe('key-1');
    expect(create.body).toEqual({ name: 'Nhà', color: 'red', description: 'Việc nhà', parentId: 'p0' });
    expect(requestAt(fetchMock, 1)).toMatchObject({ method: 'PATCH', body: { name: 'Nhà mới' } });
    expect(pathOf(requestAt(fetchMock, 1).url)).toBe('/projects/p1');
    expect(requestAt(fetchMock, 2)).toMatchObject({ method: 'POST', body: { parentId: null } });
    expect(pathOf(requestAt(fetchMock, 2).url)).toBe('/projects/p1/move');
  });

  it('keeps "absent" and null apart: move always has parentId; afterId absent = last, null = first (spec 3.1)', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, makeProject({ id: 'p1' })));

    await projectsApi.move('p1', { parentId: null });
    await projectsApi.move('p1', { parentId: 'p0', afterId: null });
    await projectsApi.move('p1', { parentId: 'p0', afterId: 'p5' });

    const bodies = [0, 1, 2].map((i) => requestAt(fetchMock, i).body as Record<string, unknown>);
    expect(bodies[0]).toEqual({ parentId: null });
    expect('afterId' in bodies[0]).toBe(false);
    expect(bodies[1]).toEqual({ parentId: 'p0', afterId: null });
    expect(bodies[2]).toEqual({ parentId: 'p0', afterId: 'p5' });
  });

  it('archives, unarchives and favorites (each answers the project) and deletes for good', async () => {
    const fetchMock = mockFetch();
    const project = makeProject({ id: 'p1' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { ...project, archivedAt: '2026-10-23T03:00:00Z' }))
      .mockResolvedValueOnce(jsonResponse(200, project))
      .mockResolvedValueOnce(jsonResponse(200, { ...project, isFavorite: true }))
      .mockResolvedValueOnce(jsonResponse(200, project))
      .mockResolvedValueOnce(jsonResponse(204));

    await expect(projectsApi.archive('p1')).resolves.toMatchObject({ archivedAt: '2026-10-23T03:00:00Z' });
    await expect(projectsApi.unarchive('p1')).resolves.toMatchObject({ archivedAt: null });
    await expect(projectsApi.setFavorite('p1', true)).resolves.toMatchObject({ isFavorite: true });
    await projectsApi.setFavorite('p1', false);
    await expect(projectsApi.remove('p1')).resolves.toBeUndefined();

    const calls = [0, 1, 2, 3, 4].map((i) => requestAt(fetchMock, i));
    expect(calls.map((c) => `${c.method} ${pathOf(c.url)}`)).toEqual([
      'POST /projects/p1/archive',
      'POST /projects/p1/unarchive',
      'PUT /projects/p1/favorite',
      'DELETE /projects/p1/favorite',
      'DELETE /projects/p1',
    ]);
  });
});
